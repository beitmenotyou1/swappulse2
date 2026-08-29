use starknet::ContractAddress;

#[starknet::interface]
pub trait IHandleRegistry<TContractState> {
    fn set_handle(ref self: TContractState, identity_id: felt252, handle_hash: felt252);
    fn clear_handle(ref self: TContractState, identity_id: felt252);
    fn get_handle(self: @TContractState, identity_id: felt252) -> felt252;
    fn get_handle_owner(self: @TContractState, handle_hash: felt252) -> felt252;
    fn resolve_handle_owner(self: @TContractState, handle_hash: felt252) -> felt252;
    fn is_handle_active(self: @TContractState, handle_hash: felt252) -> bool;
    fn get_change_count(self: @TContractState, identity_id: felt252) -> u64;
    fn get_last_changed_at(self: @TContractState, identity_id: felt252) -> u64;
    fn get_identity_registry(self: @TContractState) -> ContractAddress;
}

#[starknet::contract]
pub mod HandleRegistry {
    use core::num::traits::Zero;
    use openzeppelin_access::ownable::OwnableComponent;
    use openzeppelin_interfaces::upgrades::IUpgradeable;
    use openzeppelin_upgrades::UpgradeableComponent;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{get_block_timestamp, ClassHash, ContractAddress};

    use crate::identity_registry::{IIdentityRegistryDispatcher, IIdentityRegistryDispatcherTrait};
    use super::IHandleRegistry;

    const STATUS_ACTIVE: u8 = 1;

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
        identity_registry: ContractAddress,
        identity_to_handle: Map<felt252, felt252>,
        handle_to_identity: Map<felt252, felt252>,
        handle_active: Map<felt252, bool>,
        change_count: Map<felt252, u64>,
        last_changed_at: Map<felt252, u64>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        #[flat]
        UpgradeableEvent: UpgradeableComponent::Event,
        HandleSet: HandleSet,
        HandleCleared: HandleCleared,
    }

    #[derive(Drop, starknet::Event)]
    struct HandleSet {
        #[key]
        identity_id: felt252,
        #[key]
        handle_hash: felt252,
        old_handle_hash: felt252,
        change_count: u64,
        changed_at: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct HandleCleared {
        #[key]
        identity_id: felt252,
        #[key]
        handle_hash: felt252,
        change_count: u64,
        changed_at: u64,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress, identity_registry: ContractAddress) {
        assert(!identity_registry.is_zero(), 'INVALID_IDENTITY_REGISTRY');
        self.ownable.initializer(owner);
        self.identity_registry.write(identity_registry);
    }

    #[abi(embed_v0)]
    impl HandleRegistryImpl of IHandleRegistry<ContractState> {
        fn set_handle(ref self: ContractState, identity_id: felt252, handle_hash: felt252) {
            self.ownable.assert_only_owner();
            assert(handle_hash != 0, 'INVALID_HANDLE');
            self.assert_active_identity(identity_id);

            let registry = self.registry();
            let reserved_owner = self.handle_to_identity.read(handle_hash);
            if reserved_owner != 0 {
                let canonical_owner = registry.resolve_canonical(reserved_owner);
                assert(canonical_owner == identity_id, 'HANDLE_RESERVED');
            } else {
                self.handle_to_identity.write(handle_hash, identity_id);
            }

            let old_handle = self.identity_to_handle.read(identity_id);
            if old_handle == handle_hash && self.handle_active.read(handle_hash) {
                return;
            }

            if old_handle != 0 && old_handle != handle_hash {
                self.handle_active.write(old_handle, false);
            }

            self.identity_to_handle.write(identity_id, handle_hash);
            self.handle_active.write(handle_hash, true);
            let (next_count, changed_at) = self.record_change(identity_id);
            self.emit(
                HandleSet {
                    identity_id,
                    handle_hash,
                    old_handle_hash: old_handle,
                    change_count: next_count,
                    changed_at,
                },
            );
        }

        fn clear_handle(ref self: ContractState, identity_id: felt252) {
            self.ownable.assert_only_owner();
            self.assert_active_identity(identity_id);

            let old_handle = self.identity_to_handle.read(identity_id);
            assert(old_handle != 0, 'HANDLE_NOT_SET');
            self.identity_to_handle.write(identity_id, 0);
            self.handle_active.write(old_handle, false);
            let (next_count, changed_at) = self.record_change(identity_id);
            self.emit(
                HandleCleared {
                    identity_id,
                    handle_hash: old_handle,
                    change_count: next_count,
                    changed_at,
                },
            );
        }

        fn get_handle(self: @ContractState, identity_id: felt252) -> felt252 {
            let canonical = self.registry().resolve_canonical(identity_id);
            if canonical == 0 {
                return 0;
            }
            self.identity_to_handle.read(canonical)
        }

        fn get_handle_owner(self: @ContractState, handle_hash: felt252) -> felt252 {
            self.handle_to_identity.read(handle_hash)
        }

        fn resolve_handle_owner(self: @ContractState, handle_hash: felt252) -> felt252 {
            let reserved_owner = self.handle_to_identity.read(handle_hash);
            if reserved_owner == 0 {
                return 0;
            }
            self.registry().resolve_canonical(reserved_owner)
        }

        fn is_handle_active(self: @ContractState, handle_hash: felt252) -> bool {
            if handle_hash == 0 || !self.handle_active.read(handle_hash) {
                return false;
            }

            let registry = self.registry();
            let reserved_owner = self.handle_to_identity.read(handle_hash);
            if reserved_owner == 0 {
                return false;
            }
            let canonical_owner = registry.resolve_canonical(reserved_owner);
            if canonical_owner == 0 {
                return false;
            }
            let (_, status, canonical, _, _) = registry.get_identity(canonical_owner);
            status == STATUS_ACTIVE
                && canonical == canonical_owner
                && self.identity_to_handle.read(canonical_owner) == handle_hash
        }

        fn get_change_count(self: @ContractState, identity_id: felt252) -> u64 {
            let canonical = self.registry().resolve_canonical(identity_id);
            if canonical == 0 {
                return 0;
            }
            self.change_count.read(canonical)
        }

        fn get_last_changed_at(self: @ContractState, identity_id: felt252) -> u64 {
            let canonical = self.registry().resolve_canonical(identity_id);
            if canonical == 0 {
                return 0;
            }
            self.last_changed_at.read(canonical)
        }

        fn get_identity_registry(self: @ContractState) -> ContractAddress {
            self.identity_registry.read()
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
        fn registry(self: @ContractState) -> IIdentityRegistryDispatcher {
            IIdentityRegistryDispatcher { contract_address: self.identity_registry.read() }
        }

        fn assert_active_identity(self: @ContractState, identity_id: felt252) {
            assert(identity_id != 0, 'INVALID_IDENTITY_ID');
            let (_, status, canonical, _, _) = self.registry().get_identity(identity_id);
            assert(status == STATUS_ACTIVE, 'IDENTITY_NOT_ACTIVE');
            assert(canonical == identity_id, 'IDENTITY_NOT_CANONICAL');
        }

        fn record_change(ref self: ContractState, identity_id: felt252) -> (u64, u64) {
            let next_count = self.change_count.read(identity_id) + 1;
            let changed_at = get_block_timestamp();
            self.change_count.write(identity_id, next_count);
            self.last_changed_at.write(identity_id, changed_at);
            (next_count, changed_at)
        }
    }
}
