use starknet::ContractAddress;

#[derive(Copy, Drop, Serde)]
pub struct ValidatorInfo {
    pub account: ContractAddress,
    pub identity_id: felt252,
    pub self_stake: u128,
    pub delegated_stake: u128,
    pub commission_bps: u16,
    // 0 = none, 1 = active, 2 = exiting, 3 = slashed.
    pub status: u8,
    pub registered_at: u64,
}

#[derive(Copy, Drop, Serde)]
pub struct DelegationInfo {
    pub delegator: ContractAddress,
    pub validator: ContractAddress,
    pub amount: u128,
    pub unlock_at: u64,
    pub pending_withdrawal: u128,
}

#[starknet::interface]
pub trait IStakingPool<TContractState> {
    fn register_validator(
        ref self: TContractState, identity_id: felt252, amount: u128, commission_bps: u16,
    );
    fn increase_self_stake(ref self: TContractState, amount: u128);
    fn delegate(ref self: TContractState, validator: ContractAddress, amount: u128);
    fn request_undelegate(ref self: TContractState, validator: ContractAddress, amount: u128);
    fn withdraw(ref self: TContractState, validator: ContractAddress);
    fn exit_validator(ref self: TContractState);
    fn slash(ref self: TContractState, validator: ContractAddress, amount: u128);
    fn get_validator(self: @TContractState, validator: ContractAddress) -> ValidatorInfo;
    fn get_delegation(
        self: @TContractState, delegator: ContractAddress, validator: ContractAddress,
    ) -> DelegationInfo;
    fn validator_weight(self: @TContractState, validator: ContractAddress) -> u128;
    fn total_staked(self: @TContractState) -> u128;
    fn validator_count(self: @TContractState) -> u32;
    fn validator_at(self: @TContractState, index: u32) -> ContractAddress;
    fn min_self_stake(self: @TContractState) -> u128;
}

#[starknet::interface]
trait ITokenTransfer<TContractState> {
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    fn transfer_from(
        ref self: TContractState,
        sender: ContractAddress,
        recipient: ContractAddress,
        amount: u256,
    ) -> bool;
}

#[starknet::interface]
trait IUsershipWeight<TContractState> {
    fn security_weight(self: @TContractState, identity_id: felt252, stake: u128) -> u128;
}

#[starknet::contract]
pub mod StakingPool {
    use core::num::traits::Zero;
    use openzeppelin_access::ownable::OwnableComponent;
    use openzeppelin_interfaces::upgrades::IUpgradeable;
    use openzeppelin_upgrades::UpgradeableComponent;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{
        get_block_timestamp, get_caller_address, get_contract_address, ClassHash, ContractAddress,
    };

    use super::{
        DelegationInfo, IStakingPool, ITokenTransferDispatcher, ITokenTransferDispatcherTrait,
        IUsershipWeightDispatcher, IUsershipWeightDispatcherTrait, ValidatorInfo,
    };

    const STATUS_NONE: u8 = 0;
    const STATUS_ACTIVE: u8 = 1;
    const STATUS_EXITING: u8 = 2;
    const STATUS_SLASHED: u8 = 3;

    const MAX_COMMISSION_BPS: u16 = 3000;
    // Slashing can never take more than half a validator's stake in one action.
    const MAX_SLASH_BPS: u128 = 5000;

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
        stake_token: ContractAddress,
        usership: ContractAddress,
        min_self_stake: u128,
        unbonding_period: u64,
        total_staked: u128,
        validator_identity: Map<ContractAddress, felt252>,
        validator_self_stake: Map<ContractAddress, u128>,
        validator_delegated: Map<ContractAddress, u128>,
        validator_commission: Map<ContractAddress, u16>,
        validator_status: Map<ContractAddress, u8>,
        validator_registered_at: Map<ContractAddress, u64>,
        validator_index: Map<u32, ContractAddress>,
        validator_count: u32,
        delegation_amount: Map<(ContractAddress, ContractAddress), u128>,
        delegation_pending: Map<(ContractAddress, ContractAddress), u128>,
        delegation_unlock_at: Map<(ContractAddress, ContractAddress), u64>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        #[flat]
        UpgradeableEvent: UpgradeableComponent::Event,
        ValidatorRegistered: ValidatorRegistered,
        SelfStakeIncreased: SelfStakeIncreased,
        Delegated: Delegated,
        UndelegateRequested: UndelegateRequested,
        Withdrawn: Withdrawn,
        ValidatorExited: ValidatorExited,
        ValidatorSlashed: ValidatorSlashed,
    }

    #[derive(Drop, starknet::Event)]
    struct ValidatorRegistered {
        #[key]
        validator: ContractAddress,
        #[key]
        identity_id: felt252,
        self_stake: u128,
        commission_bps: u16,
    }

    #[derive(Drop, starknet::Event)]
    struct SelfStakeIncreased {
        #[key]
        validator: ContractAddress,
        amount: u128,
        self_stake: u128,
    }

    #[derive(Drop, starknet::Event)]
    struct Delegated {
        #[key]
        delegator: ContractAddress,
        #[key]
        validator: ContractAddress,
        amount: u128,
        total: u128,
    }

    #[derive(Drop, starknet::Event)]
    struct UndelegateRequested {
        #[key]
        delegator: ContractAddress,
        #[key]
        validator: ContractAddress,
        amount: u128,
        unlock_at: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct Withdrawn {
        #[key]
        delegator: ContractAddress,
        #[key]
        validator: ContractAddress,
        amount: u128,
    }

    #[derive(Drop, starknet::Event)]
    struct ValidatorExited {
        #[key]
        validator: ContractAddress,
        returned: u128,
    }

    #[derive(Drop, starknet::Event)]
    struct ValidatorSlashed {
        #[key]
        validator: ContractAddress,
        amount: u128,
        remaining: u128,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        stake_token: ContractAddress,
        usership: ContractAddress,
        min_self_stake: u128,
        unbonding_period: u64,
    ) {
        self.ownable.initializer(owner);
        assert(!stake_token.is_zero(), 'INVALID_STAKE_TOKEN');
        assert(min_self_stake > 0_u128, 'INVALID_MIN_STAKE');
        self.stake_token.write(stake_token);
        self.usership.write(usership);
        self.min_self_stake.write(min_self_stake);
        self.unbonding_period.write(unbonding_period);
    }

    #[abi(embed_v0)]
    impl StakingPoolImpl of IStakingPool<ContractState> {
        fn register_validator(
            ref self: ContractState, identity_id: felt252, amount: u128, commission_bps: u16,
        ) {
            let caller = get_caller_address();
            assert(identity_id != 0, 'INVALID_IDENTITY_ID');
            assert(self.validator_status.read(caller) == STATUS_NONE, 'VALIDATOR_EXISTS');
            assert(amount >= self.min_self_stake.read(), 'BELOW_MIN_SELF_STAKE');
            assert(commission_bps <= MAX_COMMISSION_BPS, 'COMMISSION_TOO_HIGH');

            self.pull_tokens(caller, amount);

            let index = self.validator_count.read();
            self.validator_identity.write(caller, identity_id);
            self.validator_self_stake.write(caller, amount);
            self.validator_commission.write(caller, commission_bps);
            self.validator_status.write(caller, STATUS_ACTIVE);
            self.validator_registered_at.write(caller, get_block_timestamp());
            self.validator_index.write(index, caller);
            self.validator_count.write(index + 1_u32);
            self.total_staked.write(self.total_staked.read() + amount);

            self
                .emit(
                    ValidatorRegistered {
                        validator: caller, identity_id, self_stake: amount, commission_bps,
                    },
                );
        }

        fn increase_self_stake(ref self: ContractState, amount: u128) {
            let caller = get_caller_address();
            assert(self.validator_status.read(caller) == STATUS_ACTIVE, 'VALIDATOR_NOT_ACTIVE');
            assert(amount > 0_u128, 'INVALID_AMOUNT');

            self.pull_tokens(caller, amount);
            let self_stake = self.validator_self_stake.read(caller) + amount;
            self.validator_self_stake.write(caller, self_stake);
            self.total_staked.write(self.total_staked.read() + amount);

            self.emit(SelfStakeIncreased { validator: caller, amount, self_stake });
        }

        fn delegate(ref self: ContractState, validator: ContractAddress, amount: u128) {
            let caller = get_caller_address();
            assert(self.validator_status.read(validator) == STATUS_ACTIVE, 'VALIDATOR_NOT_ACTIVE');
            assert(amount > 0_u128, 'INVALID_AMOUNT');

            self.pull_tokens(caller, amount);
            let total = self.delegation_amount.read((caller, validator)) + amount;
            self.delegation_amount.write((caller, validator), total);
            self
                .validator_delegated
                .write(validator, self.validator_delegated.read(validator) + amount);
            self.total_staked.write(self.total_staked.read() + amount);

            self.emit(Delegated { delegator: caller, validator, amount, total });
        }

        // Undelegation is a two-step flow: the amount leaves the security weight
        // immediately, then becomes withdrawable after the unbonding period. This
        // prevents a validator unstaking to escape a pending slash.
        fn request_undelegate(
            ref self: ContractState, validator: ContractAddress, amount: u128,
        ) {
            let caller = get_caller_address();
            let staked = self.delegation_amount.read((caller, validator));
            assert(amount > 0_u128, 'INVALID_AMOUNT');
            assert(staked >= amount, 'INSUFFICIENT_DELEGATION');

            self.delegation_amount.write((caller, validator), staked - amount);
            self
                .validator_delegated
                .write(validator, self.validator_delegated.read(validator) - amount);
            self.total_staked.write(self.total_staked.read() - amount);

            let pending = self.delegation_pending.read((caller, validator)) + amount;
            let unlock_at = get_block_timestamp() + self.unbonding_period.read();
            self.delegation_pending.write((caller, validator), pending);
            self.delegation_unlock_at.write((caller, validator), unlock_at);

            self.emit(UndelegateRequested { delegator: caller, validator, amount, unlock_at });
        }

        fn withdraw(ref self: ContractState, validator: ContractAddress) {
            let caller = get_caller_address();
            let pending = self.delegation_pending.read((caller, validator));
            assert(pending > 0_u128, 'NOTHING_PENDING');
            assert(
                get_block_timestamp() >= self.delegation_unlock_at.read((caller, validator)),
                'STILL_UNBONDING',
            );

            self.delegation_pending.write((caller, validator), 0_u128);
            self.delegation_unlock_at.write((caller, validator), 0_u64);
            self.push_tokens(caller, pending);

            self.emit(Withdrawn { delegator: caller, validator, amount: pending });
        }

        fn exit_validator(ref self: ContractState) {
            let caller = get_caller_address();
            assert(self.validator_status.read(caller) == STATUS_ACTIVE, 'VALIDATOR_NOT_ACTIVE');

            let self_stake = self.validator_self_stake.read(caller);
            self.validator_status.write(caller, STATUS_EXITING);
            self.validator_self_stake.write(caller, 0_u128);
            self.total_staked.write(self.total_staked.read() - self_stake);

            let pending = self.delegation_pending.read((caller, caller)) + self_stake;
            self.delegation_pending.write((caller, caller), pending);
            self
                .delegation_unlock_at
                .write((caller, caller), get_block_timestamp() + self.unbonding_period.read());

            self.emit(ValidatorExited { validator: caller, returned: self_stake });
        }

        fn slash(ref self: ContractState, validator: ContractAddress, amount: u128) {
            self.ownable.assert_only_owner();
            let self_stake = self.validator_self_stake.read(validator);
            assert(self_stake > 0_u128, 'NOTHING_TO_SLASH');
            let max_slash = self_stake * MAX_SLASH_BPS / 10000_u128;
            assert(amount > 0_u128 && amount <= max_slash, 'SLASH_AMOUNT_INVALID');

            let remaining = self_stake - amount;
            self.validator_self_stake.write(validator, remaining);
            self.total_staked.write(self.total_staked.read() - amount);
            if remaining < self.min_self_stake.read() {
                self.validator_status.write(validator, STATUS_SLASHED);
            }

            self.emit(ValidatorSlashed { validator, amount, remaining });
        }

        fn get_validator(self: @ContractState, validator: ContractAddress) -> ValidatorInfo {
            ValidatorInfo {
                account: validator,
                identity_id: self.validator_identity.read(validator),
                self_stake: self.validator_self_stake.read(validator),
                delegated_stake: self.validator_delegated.read(validator),
                commission_bps: self.validator_commission.read(validator),
                status: self.validator_status.read(validator),
                registered_at: self.validator_registered_at.read(validator),
            }
        }

        fn get_delegation(
            self: @ContractState, delegator: ContractAddress, validator: ContractAddress,
        ) -> DelegationInfo {
            DelegationInfo {
                delegator,
                validator,
                amount: self.delegation_amount.read((delegator, validator)),
                unlock_at: self.delegation_unlock_at.read((delegator, validator)),
                pending_withdrawal: self.delegation_pending.read((delegator, validator)),
            }
        }

        // Total security weight for a validator: raw stake, augmented by the
        // validator's Proof-of-Usership reputation. Reputation only scales stake
        // that already exists, so it can never replace economic commitment.
        fn validator_weight(self: @ContractState, validator: ContractAddress) -> u128 {
            if self.validator_status.read(validator) != STATUS_ACTIVE {
                return 0_u128;
            }

            let stake = self.validator_self_stake.read(validator)
                + self.validator_delegated.read(validator);
            let usership = self.usership.read();
            if usership.is_zero() {
                return stake;
            }

            IUsershipWeightDispatcher { contract_address: usership }
                .security_weight(self.validator_identity.read(validator), stake)
        }

        fn total_staked(self: @ContractState) -> u128 {
            self.total_staked.read()
        }

        fn validator_count(self: @ContractState) -> u32 {
            self.validator_count.read()
        }

        fn validator_at(self: @ContractState, index: u32) -> ContractAddress {
            self.validator_index.read(index)
        }

        fn min_self_stake(self: @ContractState) -> u128 {
            self.min_self_stake.read()
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

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn pull_tokens(ref self: ContractState, from: ContractAddress, amount: u128) {
            let ok = ITokenTransferDispatcher { contract_address: self.stake_token.read() }
                .transfer_from(from, get_contract_address(), amount.into());
            assert(ok, 'STAKE_TRANSFER_FAILED');
        }

        fn push_tokens(ref self: ContractState, to: ContractAddress, amount: u128) {
            let ok = ITokenTransferDispatcher { contract_address: self.stake_token.read() }
                .transfer(to, amount.into());
            assert(ok, 'UNSTAKE_TRANSFER_FAILED');
        }
    }
}