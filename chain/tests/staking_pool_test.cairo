use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_block_timestamp,
    start_cheat_caller_address, stop_cheat_block_timestamp, stop_cheat_caller_address,
};
use starknet::ContractAddress;
use swappulse_network::identity_registry::{
    IIdentityRegistryDispatcher, IIdentityRegistryDispatcherTrait,
};
use swappulse_network::native_token::{INativeTokenDispatcher, INativeTokenDispatcherTrait};
use swappulse_network::staking_pool::{
    IStakingPoolDispatcher, IStakingPoolDispatcherTrait,
};

#[starknet::interface]
trait IERC20StakingTest<TContractState> {
    fn total_supply(self: @TContractState) -> u256;
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
    fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;
}

fn addr(value: felt252) -> ContractAddress {
    value.try_into().unwrap()
}

fn deploy_registry(owner: ContractAddress) -> (ContractAddress, IIdentityRegistryDispatcher) {
    let contract = declare("IdentityRegistry").unwrap().contract_class();
    let (contract_address, _) = contract.deploy(@array![owner.into()]).unwrap();
    (contract_address, IIdentityRegistryDispatcher { contract_address })
}

fn deploy_token(
    owner: ContractAddress, max_supply: u256,
) -> (ContractAddress, INativeTokenDispatcher, IERC20StakingTestDispatcher) {
    let contract = declare("NativeToken").unwrap().contract_class();
    let mut calldata = ArrayTrait::new();
    owner.serialize(ref calldata);
    "SwapPulse".serialize(ref calldata);
    "SWPX".serialize(ref calldata);
    max_supply.serialize(ref calldata);
    let (contract_address, _) = contract.deploy(@calldata).unwrap();
    (
        contract_address,
        INativeTokenDispatcher { contract_address },
        IERC20StakingTestDispatcher { contract_address },
    )
}

fn deploy_staking(
    owner: ContractAddress,
    token_address: ContractAddress,
    registry_address: ContractAddress,
    min_self_stake: u128,
    unbonding_period: u64,
) -> (ContractAddress, IStakingPoolDispatcher) {
    let contract = declare("StakingPool").unwrap().contract_class();
    let mut calldata = ArrayTrait::new();
    owner.serialize(ref calldata);
    token_address.serialize(ref calldata);
    registry_address.serialize(ref calldata);
    addr(0).serialize(ref calldata); // Proof-of-Usership weighting disabled in these tests.
    min_self_stake.serialize(ref calldata);
    unbonding_period.serialize(ref calldata);
    let (contract_address, _) = contract.deploy(@calldata).unwrap();
    (contract_address, IStakingPoolDispatcher { contract_address })
}

fn bind_and_verify_identity(
    registry_address: ContractAddress,
    registry: IIdentityRegistryDispatcher,
    owner: ContractAddress,
    verifier: ContractAddress,
    identity_id: felt252,
    account: ContractAddress,
) {
    start_cheat_caller_address(registry_address, owner);
    registry.register_identity(identity_id, account);
    registry.set_verifier(verifier, true);
    stop_cheat_caller_address(registry_address);

    start_cheat_caller_address(registry_address, verifier);
    registry.set_verification(identity_id, 0x12345, 0x535750585f4944, 0_u64);
    stop_cheat_caller_address(registry_address);
}

fn fund_and_approve(
    token_address: ContractAddress,
    token: INativeTokenDispatcher,
    erc20: IERC20StakingTestDispatcher,
    owner: ContractAddress,
    account: ContractAddress,
    pool_address: ContractAddress,
    amount: u128,
) {
    start_cheat_caller_address(token_address, owner);
    token.mint(account, amount.into());
    stop_cheat_caller_address(token_address);

    start_cheat_caller_address(token_address, account);
    assert(erc20.approve(pool_address, amount.into()), 'approve failed');
    stop_cheat_caller_address(token_address);
}

#[test]
fn validator_registration_requires_owned_verified_identity_and_tracks_locked_stake() {
    let owner = addr(0x111);
    let verifier = addr(0x777);
    let validator = addr(0x222);
    let identity_id = 0xabc;
    let (registry_address, registry) = deploy_registry(owner);
    bind_and_verify_identity(registry_address, registry, owner, verifier, identity_id, validator);
    let (token_address, token, erc20) = deploy_token(owner, 1_000_000_u256);
    let (pool_address, pool) = deploy_staking(owner, token_address, registry_address, 100_u128, 60_u64);
    fund_and_approve(token_address, token, erc20, owner, validator, pool_address, 200_u128);

    start_cheat_caller_address(pool_address, validator);
    pool.register_validator(identity_id, 150_u128, 500_u16);
    stop_cheat_caller_address(pool_address);

    let info = pool.get_validator(validator);
    assert(info.identity_id == identity_id, 'identity mismatch');
    assert(info.self_stake == 150_u128, 'self stake mismatch');
    assert(info.status == 1_u8, 'validator not active');
    assert(pool.total_staked() == 150_u128, 'active total mismatch');
    assert(pool.total_locked_stake() == 150_u128, 'locked total mismatch');
}

#[test]
#[should_panic(expected: 'IDENTITY_NOT_OWNED')]
fn validator_cannot_borrow_another_accounts_identity() {
    let owner = addr(0x111);
    let verifier = addr(0x777);
    let identity_owner = addr(0x222);
    let attacker = addr(0x999);
    let identity_id = 0xabc;
    let (registry_address, registry) = deploy_registry(owner);
    bind_and_verify_identity(
        registry_address, registry, owner, verifier, identity_id, identity_owner,
    );
    let (token_address, token, erc20) = deploy_token(owner, 1_000_000_u256);
    let (pool_address, pool) = deploy_staking(owner, token_address, registry_address, 100_u128, 60_u64);
    fund_and_approve(token_address, token, erc20, owner, attacker, pool_address, 200_u128);

    start_cheat_caller_address(pool_address, attacker);
    pool.register_validator(identity_id, 150_u128, 500_u16);
}

#[test]
#[should_panic(expected: 'IDENTITY_NOT_VERIFIED')]
fn unverified_identity_cannot_register_validator() {
    let owner = addr(0x111);
    let validator = addr(0x222);
    let identity_id = 0xabc;
    let (registry_address, registry) = deploy_registry(owner);
    start_cheat_caller_address(registry_address, owner);
    registry.register_identity(identity_id, validator);
    stop_cheat_caller_address(registry_address);

    let (token_address, token, erc20) = deploy_token(owner, 1_000_000_u256);
    let (pool_address, pool) = deploy_staking(owner, token_address, registry_address, 100_u128, 60_u64);
    fund_and_approve(token_address, token, erc20, owner, validator, pool_address, 200_u128);

    start_cheat_caller_address(pool_address, validator);
    pool.register_validator(identity_id, 150_u128, 500_u16);
}

#[test]
fn undelegation_removes_active_weight_but_keeps_funds_locked_until_withdrawal() {
    let owner = addr(0x111);
    let verifier = addr(0x777);
    let validator = addr(0x222);
    let delegator = addr(0x333);
    let identity_id = 0xabc;
    let (registry_address, registry) = deploy_registry(owner);
    bind_and_verify_identity(registry_address, registry, owner, verifier, identity_id, validator);
    let (token_address, token, erc20) = deploy_token(owner, 1_000_000_u256);
    let (pool_address, pool) = deploy_staking(owner, token_address, registry_address, 100_u128, 60_u64);
    fund_and_approve(token_address, token, erc20, owner, validator, pool_address, 150_u128);
    fund_and_approve(token_address, token, erc20, owner, delegator, pool_address, 80_u128);

    start_cheat_caller_address(pool_address, validator);
    pool.register_validator(identity_id, 150_u128, 500_u16);
    stop_cheat_caller_address(pool_address);
    start_cheat_caller_address(pool_address, delegator);
    pool.delegate(validator, 80_u128);
    stop_cheat_caller_address(pool_address);

    assert(pool.total_staked() == 230_u128, 'pre-unbond active');
    assert(pool.total_locked_stake() == 230_u128, 'pre-unbond locked');

    start_cheat_block_timestamp(pool_address, 1_000_u64);
    start_cheat_caller_address(pool_address, delegator);
    pool.request_undelegate(validator, 50_u128);
    stop_cheat_caller_address(pool_address);
    stop_cheat_block_timestamp(pool_address);

    assert(pool.total_staked() == 180_u128, 'pending still active');
    assert(pool.total_locked_stake() == 230_u128, 'pending not locked');
    let pending = pool.get_delegation(delegator, validator);
    assert(pending.amount == 30_u128, 'remaining delegation');
    assert(pending.pending_withdrawal == 50_u128, 'pending amount');
    assert(pending.unlock_at == 1_060_u64, 'unlock time');

    start_cheat_block_timestamp(pool_address, 1_060_u64);
    start_cheat_caller_address(pool_address, delegator);
    pool.withdraw(validator);
    stop_cheat_caller_address(pool_address);
    stop_cheat_block_timestamp(pool_address);

    assert(pool.total_staked() == 180_u128, 'withdraw changed active');
    assert(pool.total_locked_stake() == 180_u128, 'withdraw locked total');
    assert(erc20.balance_of(delegator) == 50_u256, 'withdraw balance');
}

#[test]
#[should_panic(expected: 'UNDELEGATION_ALREADY_PENDING')]
fn second_undelegation_cannot_reset_existing_unlock_window() {
    let owner = addr(0x111);
    let verifier = addr(0x777);
    let validator = addr(0x222);
    let delegator = addr(0x333);
    let identity_id = 0xabc;
    let (registry_address, registry) = deploy_registry(owner);
    bind_and_verify_identity(registry_address, registry, owner, verifier, identity_id, validator);
    let (token_address, token, erc20) = deploy_token(owner, 1_000_000_u256);
    let (pool_address, pool) = deploy_staking(owner, token_address, registry_address, 100_u128, 60_u64);
    fund_and_approve(token_address, token, erc20, owner, validator, pool_address, 150_u128);
    fund_and_approve(token_address, token, erc20, owner, delegator, pool_address, 80_u128);

    start_cheat_caller_address(pool_address, validator);
    pool.register_validator(identity_id, 150_u128, 500_u16);
    stop_cheat_caller_address(pool_address);
    start_cheat_caller_address(pool_address, delegator);
    pool.delegate(validator, 80_u128);
    pool.request_undelegate(validator, 20_u128);
    pool.request_undelegate(validator, 10_u128);
}

#[test]
fn validator_exit_removes_self_and_delegated_security_weight_but_not_locked_funds() {
    let owner = addr(0x111);
    let verifier = addr(0x777);
    let validator = addr(0x222);
    let delegator = addr(0x333);
    let identity_id = 0xabc;
    let (registry_address, registry) = deploy_registry(owner);
    bind_and_verify_identity(registry_address, registry, owner, verifier, identity_id, validator);
    let (token_address, token, erc20) = deploy_token(owner, 1_000_000_u256);
    let (pool_address, pool) = deploy_staking(owner, token_address, registry_address, 100_u128, 60_u64);
    fund_and_approve(token_address, token, erc20, owner, validator, pool_address, 150_u128);
    fund_and_approve(token_address, token, erc20, owner, delegator, pool_address, 80_u128);

    start_cheat_caller_address(pool_address, validator);
    pool.register_validator(identity_id, 150_u128, 500_u16);
    stop_cheat_caller_address(pool_address);
    start_cheat_caller_address(pool_address, delegator);
    pool.delegate(validator, 80_u128);
    stop_cheat_caller_address(pool_address);

    start_cheat_block_timestamp(pool_address, 2_000_u64);
    start_cheat_caller_address(pool_address, validator);
    pool.exit_validator();
    stop_cheat_caller_address(pool_address);
    stop_cheat_block_timestamp(pool_address);

    assert(pool.total_staked() == 0_u128, 'exited stake still active');
    assert(pool.total_locked_stake() == 230_u128, 'exit unlocked funds');
    let self_pending = pool.get_delegation(validator, validator);
    assert(self_pending.pending_withdrawal == 150_u128, 'self stake not pending');

    // Delegator funds were already removed from active security weight by the
    // validator exit, so requesting them must not subtract total_staked again.
    start_cheat_caller_address(pool_address, delegator);
    pool.request_undelegate(validator, 80_u128);
    stop_cheat_caller_address(pool_address);
    assert(pool.total_staked() == 0_u128, 'inactive delegation double-counted');
    assert(pool.total_locked_stake() == 230_u128, 'request unlocked funds');
}

#[test]
fn exiting_validator_remains_slashable_and_slashed_tokens_are_burned() {
    let owner = addr(0x111);
    let verifier = addr(0x777);
    let validator = addr(0x222);
    let identity_id = 0xabc;
    let (registry_address, registry) = deploy_registry(owner);
    bind_and_verify_identity(registry_address, registry, owner, verifier, identity_id, validator);
    let (token_address, token, erc20) = deploy_token(owner, 1_000_000_u256);
    let (pool_address, pool) = deploy_staking(owner, token_address, registry_address, 100_u128, 60_u64);
    fund_and_approve(token_address, token, erc20, owner, validator, pool_address, 200_u128);

    start_cheat_caller_address(pool_address, validator);
    pool.register_validator(identity_id, 200_u128, 500_u16);
    pool.exit_validator();
    stop_cheat_caller_address(pool_address);

    let supply_before = erc20.total_supply();
    start_cheat_caller_address(pool_address, owner);
    pool.slash(validator, 50_u128);
    stop_cheat_caller_address(pool_address);

    let pending = pool.get_delegation(validator, validator);
    assert(pending.pending_withdrawal == 150_u128, 'pending slash mismatch');
    assert(pool.total_staked() == 0_u128, 'exiting stake became active');
    assert(pool.total_locked_stake() == 150_u128, 'slash locked total');
    assert(erc20.total_supply() == supply_before - 50_u256, 'slash was not burned');
}

#[test]
fn slash_below_minimum_forces_validator_out_and_unbonds_remaining_self_stake() {
    let owner = addr(0x111);
    let verifier = addr(0x777);
    let validator = addr(0x222);
    let identity_id = 0xabc;
    let (registry_address, registry) = deploy_registry(owner);
    bind_and_verify_identity(registry_address, registry, owner, verifier, identity_id, validator);
    let (token_address, token, erc20) = deploy_token(owner, 1_000_000_u256);
    let (pool_address, pool) = deploy_staking(owner, token_address, registry_address, 100_u128, 60_u64);
    fund_and_approve(token_address, token, erc20, owner, validator, pool_address, 150_u128);

    start_cheat_caller_address(pool_address, validator);
    pool.register_validator(identity_id, 150_u128, 500_u16);
    stop_cheat_caller_address(pool_address);

    start_cheat_block_timestamp(pool_address, 3_000_u64);
    start_cheat_caller_address(pool_address, owner);
    pool.slash(validator, 75_u128);
    stop_cheat_caller_address(pool_address);
    stop_cheat_block_timestamp(pool_address);

    let info = pool.get_validator(validator);
    let pending = pool.get_delegation(validator, validator);
    assert(info.status == 3_u8, 'validator not slashed');
    assert(info.self_stake == 0_u128, 'slashed self stake still active');
    assert(pool.total_staked() == 0_u128, 'slashed stake still counted');
    assert(pool.total_locked_stake() == 75_u128, 'remaining escrow mismatch');
    assert(pending.pending_withdrawal == 75_u128, 'remaining not unbonding');
    assert(pending.unlock_at == 3_060_u64, 'forced exit unlock');
}

#[test]
#[should_panic(expected: 'SELF_DELEGATION_NOT_ALLOWED')]
fn validator_cannot_create_parallel_self_delegation() {
    let owner = addr(0x111);
    let verifier = addr(0x777);
    let validator = addr(0x222);
    let identity_id = 0xabc;
    let (registry_address, registry) = deploy_registry(owner);
    bind_and_verify_identity(registry_address, registry, owner, verifier, identity_id, validator);
    let (token_address, token, erc20) = deploy_token(owner, 1_000_000_u256);
    let (pool_address, pool) = deploy_staking(owner, token_address, registry_address, 100_u128, 60_u64);
    fund_and_approve(token_address, token, erc20, owner, validator, pool_address, 200_u128);

    start_cheat_caller_address(pool_address, validator);
    pool.register_validator(identity_id, 150_u128, 500_u16);
    pool.delegate(validator, 10_u128);
}
