use starknet::ContractAddress;

// Proof-of-Usership score for one collector. The score is a commitment-backed
// aggregate of verified platform activity (trades completed, vouches given,
// journals published, pack openings). Only the aggregate and a commitment to the
// underlying activity set are stored — never the activity records themselves.
#[derive(Copy, Drop, Serde)]
pub struct UsershipRecord {
    pub identity_id: felt252,
    pub account: ContractAddress,
    pub score: u64,
    pub activity_root: felt252,
    pub epoch: u64,
    pub updated_at: u64,
}

#[starknet::interface]
pub trait IProofOfUsership<TContractState> {
    fn submit_score(
        ref self: TContractState,
        identity_id: felt252,
        account: ContractAddress,
        score: u64,
        activity_root: felt252,
        epoch: u64,
    );
    fn get_score(self: @TContractState, identity_id: felt252) -> UsershipRecord;
    fn security_weight(self: @TContractState, identity_id: felt252, stake: u128) -> u128;
    fn current_epoch(self: @TContractState) -> u64;
    fn set_epoch(ref self: TContractState, epoch: u64);
    fn set_reputation_weight_bps(ref self: TContractState, weight_bps: u16);
    fn reputation_weight_bps(self: @TContractState) -> u16;
    fn total_score(self: @TContractState) -> u64;
}

#[starknet::contract]
pub mod ProofOfUsership {
    use core::num::traits::Zero;
    use openzeppelin_access::ownable::OwnableComponent;
    use openzeppelin_interfaces::upgrades::IUpgradeable;
    use openzeppelin_upgrades::UpgradeableComponent;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{get_block_timestamp, ClassHash, ContractAddress};

    use super::{IProofOfUsership, UsershipRecord};

    // A single collector's reputation can never dominate the validator set,
    // however active they are. Cap the per-identity score contribution.
    const MAX_SCORE: u64 = 1000000;
    // Reputation may augment stake by at most this share, so security remains
    // primarily stake-backed. 2000 bps = 20%.
    const MAX_REPUTATION_WEIGHT_BPS: u16 = 2000;

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    component!(path: UpgradeableComponent, storage: upgradeable, event: UpgradeableEvent);

    #[abi(embed_v0)]
    impl OwnableMixinImpl = OwnableComponent::OwnableMixinImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;
    impl UpgradeableInternalImpl = UpgradeableComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        #[substorage(v0)]
        upgradeable: UpgradeableComponent::Storage,
        score: Map<felt252, u64>,
        account: Map<felt252, ContractAddress>,
        activity_root: Map<felt252, felt252>,
        score_epoch: Map<felt252, u64>,
        updated_at: Map<felt252, u64>,
        current_epoch: u64,
        reputation_weight_bps: u16,
        total_score: u64,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        #[flat]
        UpgradeableEvent: UpgradeableComponent::Event,
        ScoreSubmitted: ScoreSubmitted,
        EpochAdvanced: EpochAdvanced,
        ReputationWeightUpdated: ReputationWeightUpdated,
    }

    #[derive(Drop, starknet::Event)]
    struct ScoreSubmitted {
        #[key]
        identity_id: felt252,
        #[key]
        account: ContractAddress,
        score: u64,
        previous_score: u64,
        activity_root: felt252,
        epoch: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct EpochAdvanced {
        previous_epoch: u64,
        epoch: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct ReputationWeightUpdated {
        previous_bps: u16,
        weight_bps: u16,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress, reputation_weight_bps: u16) {
        self.ownable.initializer(owner);
        assert(reputation_weight_bps <= MAX_REPUTATION_WEIGHT_BPS, 'WEIGHT_TOO_HIGH');
        self.reputation_weight_bps.write(reputation_weight_bps);
        self.current_epoch.write(1_u64);
    }

    #[abi(embed_v0)]
    impl ProofOfUsershipImpl of IProofOfUsership<ContractState> {
        // Scores are submitted by the SwapPulse aggregator (contract owner) once
        // per epoch per identity. Resubmitting the same epoch is rejected so a
        // replayed aggregation cannot inflate a collector's weight.
        fn submit_score(
            ref self: ContractState,
            identity_id: felt252,
            account: ContractAddress,
            score: u64,
            activity_root: felt252,
            epoch: u64,
        ) {
            self.ownable.assert_only_owner();
            assert(identity_id != 0, 'INVALID_IDENTITY_ID');
            assert(!account.is_zero(), 'INVALID_ACCOUNT');
            assert(score <= MAX_SCORE, 'SCORE_TOO_HIGH');
            assert(activity_root != 0, 'INVALID_ACTIVITY_ROOT');
            assert(epoch == self.current_epoch.read(), 'EPOCH_MISMATCH');
            assert(self.score_epoch.read(identity_id) < epoch, 'EPOCH_ALREADY_SCORED');

            let previous_score = self.score.read(identity_id);
            self.score.write(identity_id, score);
            self.account.write(identity_id, account);
            self.activity_root.write(identity_id, activity_root);
            self.score_epoch.write(identity_id, epoch);
            self.updated_at.write(identity_id, get_block_timestamp());
            self.total_score.write(self.total_score.read() - previous_score + score);

            self
                .emit(
                    ScoreSubmitted {
                        identity_id, account, score, previous_score, activity_root, epoch,
                    },
                );
        }

        fn get_score(self: @ContractState, identity_id: felt252) -> UsershipRecord {
            UsershipRecord {
                identity_id,
                account: self.account.read(identity_id),
                score: self.score.read(identity_id),
                activity_root: self.activity_root.read(identity_id),
                epoch: self.score_epoch.read(identity_id),
                updated_at: self.updated_at.read(identity_id),
            }
        }

        // Security weight = stake + (stake * reputation_share * weight_bps).
        // Reputation scales the collector's own stake rather than adding free
        // weight, so usership can never substitute for having skin in the game:
        // a collector with zero stake always has zero weight.
        fn security_weight(self: @ContractState, identity_id: felt252, stake: u128) -> u128 {
            if stake == 0_u128 {
                return 0_u128;
            }

            let score: u128 = self.score.read(identity_id).into();
            if score == 0_u128 {
                return stake;
            }

            let max_score: u128 = MAX_SCORE.into();
            let weight_bps: u128 = self.reputation_weight_bps.read().into();
            let bonus = stake * weight_bps * score / (10000_u128 * max_score);
            stake + bonus
        }

        fn current_epoch(self: @ContractState) -> u64 {
            self.current_epoch.read()
        }

        fn set_epoch(ref self: ContractState, epoch: u64) {
            self.ownable.assert_only_owner();
            let previous_epoch = self.current_epoch.read();
            assert(epoch > previous_epoch, 'EPOCH_NOT_ADVANCING');
            self.current_epoch.write(epoch);
            self.emit(EpochAdvanced { previous_epoch, epoch });
        }

        fn set_reputation_weight_bps(ref self: ContractState, weight_bps: u16) {
            self.ownable.assert_only_owner();
            assert(weight_bps <= MAX_REPUTATION_WEIGHT_BPS, 'WEIGHT_TOO_HIGH');
            let previous_bps = self.reputation_weight_bps.read();
            self.reputation_weight_bps.write(weight_bps);
            self.emit(ReputationWeightUpdated { previous_bps, weight_bps });
        }

        fn reputation_weight_bps(self: @ContractState) -> u16 {
            self.reputation_weight_bps.read()
        }

        fn total_score(self: @ContractState) -> u64 {
            self.total_score.read()
        }
    }

    #[abi(embed_v0)]
    impl UpgradeableImpl of IUpgradeable<ContractState> {
        fn upgrade(ref self: ContractState, new_class_hash: ClassHash) {
            self.ownable.assert_only_owner();
            assert(!new_class_hash.is_zero(), 'CLASS_HASH_ZERO');
            self.upgradeable.upgrade(new_class_hash);
        }
    }
}