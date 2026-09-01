use starknet::ContractAddress;

// NOTE: the public product calls these participants "community operators".
// This undeployed Phase 2 contract retains validator-named structs/functions for
// compatibility with the existing Base44 draft/submit ABI. On the current
// single-runtime Devnet these bonds secure accountable services, not consensus.
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
    // Active stake participating in staking accounting. Funds in an unbonding
    // period are excluded from this value but remain in total_locked_stake.
    fn total_staked(self: @TContractState) -> u128;
    // All SWPX still escrowed by the pool, including pending unbonding funds.
    fn total_locked_stake(self: @TContractState) -> u128;
    fn validator_count(self: @TContractState) -> u32;
    fn validator_at(self: @TContractState, index: u32) -> ContractAddress;
    fn min_self_stake(self: @TContractState) -> u128;
    fn stake_token(self: @TContractState) -> ContractAddress;
    fn identity_registry(self: @TContractState) -> ContractAddress;
    fn usership(self: @TContractState) -> ContractAddress;
    fn unbonding_period(self: @TContractState) -> u64;
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
    // Slashed SWPX is burned from the pool rather than accumulating in an
    // owner-controlled treasury or becoming permanently stranded.
    fn burn(ref self: TContractState, amount: u256);
}

#[starknet::interface]
trait IIdentityBinding<TContractState> {
    fn get_identity(
        self: @TContractState, identity_id: felt252,
    ) -> (ContractAddress, u8, felt252, u64, u64);
    fn is_verified(self: @TContractState, identity_id: felt252) -> bool;
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
        DelegationInfo, IIdentityBindingDispatcher, IIdentityBindingDispatcherTrait, IStakingPool,
        ITokenTransferDispatcher, ITokenTransferDispatcherTrait, IUsershipWeightDispatcher,
        IUsershipWeightDispatcherTrait, ValidatorInfo,
    };

    const STATUS_NONE: u8 = 0;
    const STATUS_ACTIVE: u8 = 1;
    const STATUS_EXITING: u8 = 2;
    const STATUS_SLASHED: u8 = 3;

    const MAX_COMMISSION_BPS: u16 = 3000;

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
        identity_registry: ContractAddress,
        usership: ContractAddress,
        min_self_stake: u128,
        unbonding_period: u64,
        total_staked: u128,
        total_locked_stake: u128,
        validator_identity: Map<ContractAddress, felt252>,
        validator_self_stake: Map<ContractAddress, u128>,
        validator_delegated: Map<ContractAddress, u128>,
        // True while this validator's delegations are included in total_staked.
        // It flips false when the validator exits or is forced out by slashing,
        // while the underlying delegator funds remain in total_locked_stake.
        validator_delegations_counted: Map<ContractAddress, bool>,
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
        identity_registry: ContractAddress,
        usership: ContractAddress,
        min_self_stake: u128,
        unbonding_period: u64,
    ) {
        self.ownable.initializer(owner);
        assert(!stake_token.is_zero(), 'INVALID_STAKE_TOKEN');
        assert(!identity_registry.is_zero(), 'INVALID_ID_REGISTRY');
        assert(min_self_stake > 0_u128, 'INVALID_MIN_STAKE');
        self.stake_token.write(stake_token);
        self.identity_registry.write(identity_registry);
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

            // A validator may only claim the active, verified identity currently
            // bound to its own smart account. This prevents borrowing another
            // user's Proof-of-Usership reputation by submitting their identity_id.
            let registry = IIdentityBindingDispatcher {
                contract_address: self.identity_registry.read(),
            };
            let (identity_account, identity_status, canonical_identity, _, _) =
                registry.get_identity(identity_id);
            assert(identity_status == STATUS_ACTIVE, 'IDENTITY_NOT_ACTIVE');
            assert(canonical_identity == identity_id, 'IDENTITY_NOT_CANONICAL');
            assert(identity_account == caller, 'IDENTITY_NOT_OWNED');
            assert(registry.is_verified(identity_id), 'IDENTITY_NOT_VERIFIED');

            self.pull_tokens(caller, amount);

            let index = self.validator_count.read();
            self.validator_identity.write(caller, identity_id);
            self.validator_self_stake.write(caller, amount);
            self.validator_delegations_counted.write(caller, true);
            self.validator_commission.write(caller, commission_bps);
            self.validator_status.write(caller, STATUS_ACTIVE);
            self.validator_registered_at.write(caller, get_block_timestamp());
            self.validator_index.write(index, caller);
            self.validator_count.write(index + 1_u32);
            self.total_staked.write(self.total_staked.read() + amount);
            self.total_locked_stake.write(self.total_locked_stake.read() + amount);

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
            self.total_locked_stake.write(self.total_locked_stake.read() + amount);

            self.emit(SelfStakeIncreased { validator: caller, amount, self_stake });
        }

        fn delegate(ref self: ContractState, validator: ContractAddress, amount: u128) {
            let caller = get_caller_address();
            assert(self.validator_status.read(validator) == STATUS_ACTIVE, 'VALIDATOR_NOT_ACTIVE');
            assert(caller != validator, 'SELF_DELEGATION_NOT_ALLOWED');
            assert(amount > 0_u128, 'INVALID_AMOUNT');

            self.pull_tokens(caller, amount);
            let total = self.delegation_amount.read((caller, validator)) + amount;
            self.delegation_amount.write((caller, validator), total);
            self
                .validator_delegated
                .write(validator, self.validator_delegated.read(validator) + amount);
            self.total_staked.write(self.total_staked.read() + amount);
            self.total_locked_stake.write(self.total_locked_stake.read() + amount);

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
            assert(
                self.delegation_pending.read((caller, validator)) == 0_u128,
                'UNDELEGATION_ALREADY_PENDING',
            );

            self.delegation_amount.write((caller, validator), staked - amount);
            self
                .validator_delegated
                .write(validator, self.validator_delegated.read(validator) - amount);
            if self.validator_delegations_counted.read(validator) {
                self.total_staked.write(self.total_staked.read() - amount);
            }

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
            self.total_locked_stake.write(self.total_locked_stake.read() - pending);
            self.push_tokens(caller, pending);

            self.emit(Withdrawn { delegator: caller, validator, amount: pending });
        }

        fn exit_validator(ref self: ContractState) {
            let caller = get_caller_address();
            assert(self.validator_status.read(caller) == STATUS_ACTIVE, 'VALIDATOR_NOT_ACTIVE');

            let self_stake = self.validator_self_stake.read(caller);
            assert(
                self.delegation_pending.read((caller, caller)) == 0_u128,
                'EXIT_ALREADY_PENDING',
            );
            self.validator_status.write(caller, STATUS_EXITING);
            self.validator_self_stake.write(caller, 0_u128);
            let delegated = self.validator_delegated.read(caller);
            self.total_staked.write(self.total_staked.read() - self_stake - delegated);
            self.validator_delegations_counted.write(caller, false);

            let pending = self.delegation_pending.read((caller, caller)) + self_stake;
            self.delegation_pending.write((caller, caller), pending);
            self
                .delegation_unlock_at
                .write((caller, caller), get_block_timestamp() + self.unbonding_period.read());

            self.emit(ValidatorExited { validator: caller, returned: self_stake });
        }

        fn slash(ref self: ContractState, validator: ContractAddress, amount: u128) {
            self.ownable.assert_only_owner();

            // Self-stake remains slashable while it is unbonding. exit_validator
            // moves it into the validator's self-delegation pending slot, so an
            // exit cannot be used to escape a slash during the delay window.
            let active_self_stake = self.validator_self_stake.read(validator);
            let pending_self_stake = self.delegation_pending.read((validator, validator));
            let slashable = active_self_stake + pending_self_stake;
            assert(slashable > 0_u128, 'NOTHING_TO_SLASH');
            let max_slash = slashable / 2_u128;
            assert(amount > 0_u128 && amount <= max_slash, 'SLASH_AMOUNT_INVALID');

            let active_slash = if amount <= active_self_stake { amount } else { active_self_stake };
            let pending_slash = amount - active_slash;

            if active_slash > 0_u128 {
                self.validator_self_stake.write(validator, active_self_stake - active_slash);
                self.total_staked.write(self.total_staked.read() - active_slash);
            }
            if pending_slash > 0_u128 {
                self
                    .delegation_pending
                    .write((validator, validator), pending_self_stake - pending_slash);
            }

            self.total_locked_stake.write(self.total_locked_stake.read() - amount);
            self.burn_tokens(amount);

            let mut remaining_active = self.validator_self_stake.read(validator);
            if self.validator_status.read(validator) == STATUS_ACTIVE
                && remaining_active < self.min_self_stake.read()
            {
                // Falling below the minimum removes the validator and all of its
                // delegations from active security weight immediately. Remaining
                // self-stake is moved into the same timed withdrawal path used by
                // a voluntary exit, so it is not stranded.
                let delegated = self.validator_delegated.read(validator);
                self.total_staked.write(self.total_staked.read() - remaining_active - delegated);
                self.validator_delegations_counted.write(validator, false);
                self.validator_status.write(validator, STATUS_SLASHED);
                self.validator_self_stake.write(validator, 0_u128);

                if remaining_active > 0_u128 {
                    let existing_pending = self.delegation_pending.read((validator, validator));
                    self
                        .delegation_pending
                        .write((validator, validator), existing_pending + remaining_active);
                    self
                        .delegation_unlock_at
                        .write(
                            (validator, validator),
                            get_block_timestamp() + self.unbonding_period.read(),
                        );
                }
                remaining_active = 0_u128;
            }

            let remaining = remaining_active
                + self.delegation_pending.read((validator, validator));
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

        fn total_locked_stake(self: @ContractState) -> u128 {
            self.total_locked_stake.read()
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

        fn stake_token(self: @ContractState) -> ContractAddress {
            self.stake_token.read()
        }

        fn identity_registry(self: @ContractState) -> ContractAddress {
            self.identity_registry.read()
        }

        fn usership(self: @ContractState) -> ContractAddress {
            self.usership.read()
        }

        fn unbonding_period(self: @ContractState) -> u64 {
            self.unbonding_period.read()
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

        fn burn_tokens(ref self: ContractState, amount: u128) {
            ITokenTransferDispatcher { contract_address: self.stake_token.read() }
                .burn(amount.into());
        }
    }
}