use starknet::ContractAddress;

#[starknet::interface]
pub trait IIdentityRegistry<TContractState> {
    fn register_identity(
        ref self: TContractState, identity_id: felt252, account_address: ContractAddress,
    );
    fn change_account(
        ref self: TContractState, identity_id: felt252, new_account: ContractAddress,
    );
    fn merge_identity(
        ref self: TContractState, source_identity_id: felt252, target_identity_id: felt252,
    );
    fn record_recovery(ref self: TContractState, identity_id: felt252);
    fn get_identity(
        self: @TContractState, identity_id: felt252,
    ) -> (ContractAddress, u8, felt252, u64, u64);
    fn get_identity_by_account(self: @TContractState, account_address: ContractAddress) -> felt252;
    fn resolve_canonical(self: @TContractState, identity_id: felt252) -> felt252;
}

#[starknet::contract]
pub mod IdentityRegistry {
    use core::num::traits::Zero;
    use openzeppelin_access::ownable::OwnableComponent;
    use openzeppelin_interfaces::upgrades::IUpgradeable;
    use openzeppelin_upgrades::UpgradeableComponent;
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess};
    use starknet::{get_block_timestamp, ClassHash, ContractAddress};

    use super::IIdentityRegistry;

    const STATUS_NONE: u8 = 0;
    const STATUS_ACTIVE: u8 = 1;
    const STATUS_MERGED: u8 = 2;

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
        identity_to_account: Map<felt252, ContractAddress>,
        account_to_identity: Map<ContractAddress, felt252>,
        identity_status: Map<felt252, u8>,
        canonical_identity: Map<felt252, felt252>,
        created_at: Map<felt252, u64>,
        recovery_count: Map<felt252, u64>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        #[flat]
        UpgradeableEvent: UpgradeableComponent::Event,
        IdentityCreated: IdentityCreated,
        AccountChanged: AccountChanged,
        IdentityMerged: IdentityMerged,
        IdentityRecovered: IdentityRecovered,
    }

    #[derive(Drop, starknet::Event)]
    struct IdentityCreated {
        #[key]
        identity_id: felt252,
        #[key]
        account_address: ContractAddress,
        created_at: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct AccountChanged {
        #[key]
        identity_id: felt252,
        old_account: ContractAddress,
        new_account: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct IdentityMerged {
        #[key]
        source_identity_id: felt252,
        #[key]
        target_identity_id: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct IdentityRecovered {
        #[key]
        identity_id: felt252,
        account_address: ContractAddress,
        recovery_count: u64,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.ownable.initializer(owner);
    }

    #[abi(embed_v0)]
    impl IdentityRegistryImpl of IIdentityRegistry<ContractState> {
        fn register_identity(
            ref self: ContractState, identity_id: felt252, account_address: ContractAddress,
        ) {
            self.ownable.assert_only_owner();
            assert(identity_id != 0, 'INVALID_IDENTITY_ID');
            assert(!account_address.is_zero(), 'INVALID_ACCOUNT');
            assert(self.identity_status.read(identity_id) == STATUS_NONE, 'IDENTITY_EXISTS');
            assert(self.account_to_identity.read(account_address) == 0, 'ACCOUNT_ALREADY_BOUND');

            let created_at = get_block_timestamp();
            self.identity_to_account.write(identity_id, account_address);
            self.account_to_identity.write(account_address, identity_id);
            self.identity_status.write(identity_id, STATUS_ACTIVE);
            self.canonical_identity.write(identity_id, identity_id);
            self.created_at.write(identity_id, created_at);

            self.emit(IdentityCreated { identity_id, account_address, created_at });
        }

        fn change_account(
            ref self: ContractState, identity_id: felt252, new_account: ContractAddress,
        ) {
            self.ownable.assert_only_owner();
            self.assert_active(identity_id);
            assert(!new_account.is_zero(), 'INVALID_ACCOUNT');
            assert(self.account_to_identity.read(new_account) == 0, 'ACCOUNT_ALREADY_BOUND');

            let old_account = self.identity_to_account.read(identity_id);
            assert(!old_account.is_zero(), 'IDENTITY_ACCOUNT_MISSING');

            self.account_to_identity.write(old_account, 0);
            self.identity_to_account.write(identity_id, new_account);
            self.account_to_identity.write(new_account, identity_id);

            self.emit(AccountChanged { identity_id, old_account, new_account });
        }

        fn merge_identity(
            ref self: ContractState, source_identity_id: felt252, target_identity_id: felt252,
        ) {
            self.ownable.assert_only_owner();
            assert(source_identity_id != target_identity_id, 'SAME_IDENTITY');
            self.assert_active(source_identity_id);
            self.assert_active(target_identity_id);

            // The source identity remains queryable forever. It is never deleted,
            // and historical account -> source mappings remain intact. Consumers
            // resolve it through resolve_canonical() to the surviving identity.
            self.identity_status.write(source_identity_id, STATUS_MERGED);
            self.canonical_identity.write(source_identity_id, target_identity_id);

            self.emit(IdentityMerged { source_identity_id, target_identity_id });
        }

        fn record_recovery(ref self: ContractState, identity_id: felt252) {
            self.ownable.assert_only_owner();
            self.assert_active(identity_id);
            let next_count = self.recovery_count.read(identity_id) + 1;
            self.recovery_count.write(identity_id, next_count);
            self.emit(
                IdentityRecovered {
                    identity_id,
                    account_address: self.identity_to_account.read(identity_id),
                    recovery_count: next_count,
                },
            );
        }

        fn get_identity(
            self: @ContractState, identity_id: felt252,
        ) -> (ContractAddress, u8, felt252, u64, u64) {
            (
                self.identity_to_account.read(identity_id),
                self.identity_status.read(identity_id),
                self.resolve_canonical(identity_id),
                self.created_at.read(identity_id),
                self.recovery_count.read(identity_id),
            )
        }

        fn get_identity_by_account(
            self: @ContractState, account_address: ContractAddress,
        ) -> felt252 {
            self.account_to_identity.read(account_address)
        }

        fn resolve_canonical(self: @ContractState, identity_id: felt252) -> felt252 {
            let mut current = identity_id;
            let mut hops: u8 = 0;

            loop {
                let status = self.identity_status.read(current);
                if status == STATUS_NONE {
                    return 0;
                }
                if status == STATUS_ACTIVE {
                    return current;
                }

                assert(status == STATUS_MERGED, 'INVALID_IDENTITY_STATUS');
                let next = self.canonical_identity.read(current);
                assert(next != 0 && next != current, 'INVALID_CANONICAL_LINK');

                current = next;
                hops += 1;
                assert(hops <= 32_u8, 'MERGE_CHAIN_TOO_DEEP');
            }
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
        fn assert_active(self: @ContractState, identity_id: felt252) {
            assert(self.identity_status.read(identity_id) == STATUS_ACTIVE, 'IDENTITY_NOT_ACTIVE');
        }
    }
}
