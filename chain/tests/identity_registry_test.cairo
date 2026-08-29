use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_block_timestamp,
    start_cheat_caller_address, stop_cheat_block_timestamp, stop_cheat_caller_address,
};
use openzeppelin_interfaces::upgrades::{IUpgradeableDispatcher, IUpgradeableDispatcherTrait};
use starknet::ContractAddress;
use swappulse_network::identity_registry::{
    IIdentityRegistryDispatcher, IIdentityRegistryDispatcherTrait,
};

fn addr(value: felt252) -> ContractAddress {
    value.try_into().unwrap()
}

fn deploy_registry(owner: ContractAddress) -> (ContractAddress, IIdentityRegistryDispatcher) {
    let contract = declare("IdentityRegistry").unwrap().contract_class();
    let (contract_address, _) = contract.deploy(@array![owner.into()]).unwrap();
    let dispatcher = IIdentityRegistryDispatcher { contract_address };
    (contract_address, dispatcher)
}

#[test]
fn register_identity_and_reverse_lookup() {
    let owner = addr(0x111);
    let account = addr(0x222);
    let identity_id = 0xabc;
    let (registry_address, registry) = deploy_registry(owner);

    start_cheat_block_timestamp(registry_address, 1_234_u64);
    start_cheat_caller_address(registry_address, owner);
    registry.register_identity(identity_id, account);
    stop_cheat_caller_address(registry_address);
    stop_cheat_block_timestamp(registry_address);

    let (stored_account, status, canonical, created_at, recovery_count) =
        registry.get_identity(identity_id);

    assert(stored_account == account, 'account mismatch');
    assert(status == 1_u8, 'status not active');
    assert(canonical == identity_id, 'canonical mismatch');
    assert(created_at == 1_234_u64, 'created_at mismatch');
    assert(recovery_count == 0_u64, 'recovery count');
    assert(registry.get_identity_by_account(account) == identity_id, 'reverse lookup');
}

#[test]
#[should_panic]
fn non_owner_cannot_register_identity() {
    let owner = addr(0x111);
    let attacker = addr(0x999);
    let account = addr(0x222);
    let (registry_address, registry) = deploy_registry(owner);

    start_cheat_caller_address(registry_address, attacker);
    registry.register_identity(0xabc, account);
}

#[test]
#[should_panic(expected: 'IDENTITY_EXISTS')]
fn identity_id_cannot_be_registered_twice() {
    let owner = addr(0x111);
    let (registry_address, registry) = deploy_registry(owner);

    start_cheat_caller_address(registry_address, owner);
    registry.register_identity(0xabc, addr(0x222));
    registry.register_identity(0xabc, addr(0x333));
}

#[test]
#[should_panic(expected: 'ACCOUNT_ALREADY_BOUND')]
fn account_cannot_be_bound_to_two_active_identities() {
    let owner = addr(0x111);
    let account = addr(0x222);
    let (registry_address, registry) = deploy_registry(owner);

    start_cheat_caller_address(registry_address, owner);
    registry.register_identity(0xabc, account);
    registry.register_identity(0xdef, account);
}

#[test]
fn account_change_updates_reverse_lookup() {
    let owner = addr(0x111);
    let old_account = addr(0x222);
    let new_account = addr(0x333);
    let identity_id = 0xabc;
    let (registry_address, registry) = deploy_registry(owner);

    start_cheat_caller_address(registry_address, owner);
    registry.register_identity(identity_id, old_account);
    registry.change_account(identity_id, new_account);
    stop_cheat_caller_address(registry_address);

    let (stored_account, status, canonical, _, _) = registry.get_identity(identity_id);
    assert(stored_account == new_account, 'new account missing');
    assert(status == 1_u8, 'status changed');
    assert(canonical == identity_id, 'canonical changed');
    assert(registry.get_identity_by_account(old_account) == 0, 'old reverse remains');
    assert(registry.get_identity_by_account(new_account) == identity_id, 'new reverse missing');
}

#[test]
fn merge_preserves_source_history_and_resolves_canonical() {
    let owner = addr(0x111);
    let source_id = 0xaaa;
    let target_id = 0xbbb;
    let source_account = addr(0x222);
    let target_account = addr(0x333);
    let (registry_address, registry) = deploy_registry(owner);

    start_cheat_block_timestamp(registry_address, 2_000_u64);
    start_cheat_caller_address(registry_address, owner);
    registry.register_identity(source_id, source_account);
    registry.register_identity(target_id, target_account);
    let (_, _, _, source_created_before, _) = registry.get_identity(source_id);
    registry.merge_identity(source_id, target_id);
    stop_cheat_caller_address(registry_address);
    stop_cheat_block_timestamp(registry_address);

    let (stored_source_account, source_status, source_canonical, source_created_at, _) =
        registry.get_identity(source_id);
    let (_, target_status, target_canonical, _, _) = registry.get_identity(target_id);

    assert(stored_source_account == source_account, 'source history lost');
    assert(source_status == 2_u8, 'source not merged');
    assert(source_canonical == target_id, 'source canonical wrong');
    assert(source_created_at == source_created_before, 'source time changed');
    assert(target_status == 1_u8, 'target not active');
    assert(target_canonical == target_id, 'target canonical wrong');
    assert(registry.get_identity_by_account(source_account) == source_id, 'source reverse history lost');
}

#[test]
#[should_panic(expected: 'IDENTITY_NOT_ACTIVE')]
fn merged_identity_cannot_be_merged_again() {
    let owner = addr(0x111);
    let (registry_address, registry) = deploy_registry(owner);

    start_cheat_caller_address(registry_address, owner);
    registry.register_identity(0xaaa, addr(0x222));
    registry.register_identity(0xbbb, addr(0x333));
    registry.register_identity(0xccc, addr(0x444));
    registry.merge_identity(0xaaa, 0xbbb);
    registry.merge_identity(0xaaa, 0xccc);
}

#[test]
fn recovery_counter_is_auditable() {
    let owner = addr(0x111);
    let identity_id = 0xabc;
    let account = addr(0x222);
    let (registry_address, registry) = deploy_registry(owner);

    start_cheat_caller_address(registry_address, owner);
    registry.register_identity(identity_id, account);
    registry.record_recovery(identity_id);
    registry.record_recovery(identity_id);
    stop_cheat_caller_address(registry_address);

    let (_, _, _, _, recovery_count) = registry.get_identity(identity_id);
    assert(recovery_count == 2_u64, 'recovery count mismatch');
}

#[test]
#[should_panic(expected: 'INVALID_IDENTITY_ID')]
fn zero_identity_id_is_rejected() {
    let owner = addr(0x111);
    let (registry_address, registry) = deploy_registry(owner);

    start_cheat_caller_address(registry_address, owner);
    registry.register_identity(0, addr(0x222));
}

#[test]
#[should_panic]
fn non_owner_cannot_change_account() {
    let owner = addr(0x111);
    let attacker = addr(0x999);
    let (registry_address, registry) = deploy_registry(owner);

    start_cheat_caller_address(registry_address, owner);
    registry.register_identity(0xabc, addr(0x222));
    stop_cheat_caller_address(registry_address);

    start_cheat_caller_address(registry_address, attacker);
    registry.change_account(0xabc, addr(0x333));
}

#[test]
#[should_panic]
fn non_owner_cannot_merge_identities() {
    let owner = addr(0x111);
    let attacker = addr(0x999);
    let (registry_address, registry) = deploy_registry(owner);

    start_cheat_caller_address(registry_address, owner);
    registry.register_identity(0xaaa, addr(0x222));
    registry.register_identity(0xbbb, addr(0x333));
    stop_cheat_caller_address(registry_address);

    start_cheat_caller_address(registry_address, attacker);
    registry.merge_identity(0xaaa, 0xbbb);
}

#[test]
#[should_panic]
fn non_owner_cannot_record_recovery() {
    let owner = addr(0x111);
    let attacker = addr(0x999);
    let (registry_address, registry) = deploy_registry(owner);

    start_cheat_caller_address(registry_address, owner);
    registry.register_identity(0xabc, addr(0x222));
    stop_cheat_caller_address(registry_address);

    start_cheat_caller_address(registry_address, attacker);
    registry.record_recovery(0xabc);
}

#[test]
fn chained_merges_resolve_to_final_active_identity() {
    let owner = addr(0x111);
    let (registry_address, registry) = deploy_registry(owner);

    start_cheat_caller_address(registry_address, owner);
    registry.register_identity(0xaaa, addr(0x222));
    registry.register_identity(0xbbb, addr(0x333));
    registry.register_identity(0xccc, addr(0x444));
    registry.merge_identity(0xaaa, 0xbbb);
    registry.merge_identity(0xbbb, 0xccc);
    stop_cheat_caller_address(registry_address);

    assert(registry.resolve_canonical(0xaaa) == 0xccc, 'source not fully resolved');
    assert(registry.resolve_canonical(0xbbb) == 0xccc, 'middle not fully resolved');
    assert(registry.resolve_canonical(0xccc) == 0xccc, 'active not self canonical');

    let (_, source_status, source_canonical, _, _) = registry.get_identity(0xaaa);
    assert(source_status == 2_u8, 'source not merged');
    assert(source_canonical == 0xccc, 'get_identity not canonical');
}

#[test]
#[should_panic]
fn non_owner_cannot_upgrade_registry() {
    let owner = addr(0x111);
    let attacker = addr(0x999);
    let (registry_address, _) = deploy_registry(owner);
    let upgradeable = IUpgradeableDispatcher { contract_address: registry_address };

    start_cheat_caller_address(registry_address, attacker);
    upgradeable.upgrade(0x123.try_into().unwrap());
}
