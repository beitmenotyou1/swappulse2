use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_block_timestamp,
    start_cheat_caller_address, stop_cheat_block_timestamp, stop_cheat_caller_address,
};
use starknet::ContractAddress;
use swappulse_network::swap_pulse_account::{
    ISwapPulseAccountDispatcher, ISwapPulseAccountDispatcherTrait,
};

const MAX_RECOVERY_DELAY_SECONDS: u64 = 2_592_000;

fn addr(value: felt252) -> ContractAddress {
    value.try_into().unwrap()
}

fn deploy_account(
    public_key: felt252, recovery_controller: ContractAddress, recovery_delay: u64,
) -> (ContractAddress, ISwapPulseAccountDispatcher) {
    let contract = declare("SwapPulseAccount").unwrap().contract_class();
    let calldata = array![public_key];
    let (contract_address, _) = contract.deploy(@calldata).unwrap();
    let dispatcher = ISwapPulseAccountDispatcher { contract_address };

    // Standard Starknet deploy-account validation requires the constructor to
    // match OpenZeppelin's public_key-only deploy ABI. Recovery is therefore
    // configured after deployment through account-self calls.
    if recovery_controller != addr(0) || recovery_delay != 0_u64 {
        start_cheat_caller_address(contract_address, contract_address);
        if recovery_controller != addr(0) {
            dispatcher.set_recovery_controller(recovery_controller);
        }
        if recovery_delay != 0_u64 {
            dispatcher.set_recovery_delay(recovery_delay);
        }
        stop_cheat_caller_address(contract_address);
    }

    (contract_address, dispatcher)
}

#[test]
fn constructor_rejects_zero_public_key() {
    let contract = declare("SwapPulseAccount").unwrap().contract_class();
    let calldata = array![0];
    let mut err = starknet::syscalls::deploy_syscall(
        *contract.class_hash, 0, calldata.span(), false,
    )
        .unwrap_err();
    assert(err.pop_front().unwrap() == 'INVALID_PUBLIC_KEY', 'wrong constructor error');
}

#[test]
fn recovery_starts_disabled() {
    let zero = addr(0);
    let (_account_address, account) = deploy_account(0x12345, zero, 0);
    assert(account.get_recovery_controller() == zero, 'controller not disabled');
    assert(account.get_recovery_delay() == 0_u64, 'delay should start at zero');
}

#[test]
#[should_panic(expected: 'RECOVERY_DISABLED')]
fn recovery_is_impossible_when_controller_is_disabled() {
    let zero = addr(0);
    let (account_address, account) = deploy_account(0x12345, zero, 172800);

    start_cheat_caller_address(account_address, addr(0x999));
    account.propose_recovery(0x54321);
}

#[test]
#[should_panic(expected: 'NOT_RECOVERY_CONTROLLER')]
fn only_recovery_controller_can_propose() {
    let controller = addr(0x777);
    let attacker = addr(0x999);
    let (account_address, account) = deploy_account(0x12345, controller, 172800);

    start_cheat_caller_address(account_address, attacker);
    account.propose_recovery(0x54321);
}

#[test]
fn controller_can_propose_and_cancel_recovery() {
    let controller = addr(0x777);
    let (account_address, account) = deploy_account(0x12345, controller, 172800);

    start_cheat_block_timestamp(account_address, 1_000_u64);
    start_cheat_caller_address(account_address, controller);
    account.propose_recovery(0x54321);

    let (pending_key, execute_after) = account.get_pending_recovery();
    assert(pending_key == 0x54321, 'pending key mismatch');
    assert(execute_after == 173800_u64, 'execute_after mismatch');
    assert(account.get_recovery_nonce() == 1_u64, 'nonce mismatch');

    account.cancel_recovery();
    let (cleared_key, cleared_execute_after) = account.get_pending_recovery();
    assert(cleared_key == 0, 'pending key not cleared');
    assert(cleared_execute_after == 0_u64, 'pending time not cleared');

    stop_cheat_caller_address(account_address);
    stop_cheat_block_timestamp(account_address);
}

#[test]
fn account_self_call_can_cancel_recovery() {
    let controller = addr(0x777);
    let (account_address, account) = deploy_account(0x12345, controller, 172800);

    start_cheat_caller_address(account_address, controller);
    account.propose_recovery(0x54321);
    stop_cheat_caller_address(account_address);

    // A real user cancellation is performed through account execution, which
    // makes the account contract itself the caller of cancel_recovery.
    start_cheat_caller_address(account_address, account_address);
    account.cancel_recovery();
    stop_cheat_caller_address(account_address);

    let (pending_key, execute_after) = account.get_pending_recovery();
    assert(pending_key == 0, 'pending key not cleared');
    assert(execute_after == 0_u64, 'pending time not cleared');
}

#[test]
#[should_panic(expected: 'RECOVERY_NOT_READY')]
fn recovery_cannot_execute_before_delay() {
    let controller = addr(0x777);
    let (account_address, account) = deploy_account(0x12345, controller, 60);

    start_cheat_block_timestamp(account_address, 1_000_u64);
    start_cheat_caller_address(account_address, controller);
    account.propose_recovery(0x54321);

    start_cheat_block_timestamp(account_address, 1_059_u64);
    account.execute_recovery();
}

#[test]
fn recovery_executes_after_delay_and_clears_pending_state() {
    let controller = addr(0x777);
    let (account_address, account) = deploy_account(0x12345, controller, 60);

    start_cheat_block_timestamp(account_address, 1_000_u64);
    start_cheat_caller_address(account_address, controller);
    account.propose_recovery(0x54321);

    start_cheat_block_timestamp(account_address, 1_060_u64);
    account.execute_recovery();

    let (pending_key, execute_after) = account.get_pending_recovery();
    assert(pending_key == 0, 'pending key not cleared');
    assert(execute_after == 0_u64, 'pending time not cleared');
    assert(account.get_recovery_nonce() == 1_u64, 'nonce unexpectedly changed');

    stop_cheat_caller_address(account_address);
    stop_cheat_block_timestamp(account_address);
}

#[test]
#[should_panic(expected: 'RECOVERY_ALREADY_PENDING')]
fn second_recovery_cannot_replace_pending_proposal() {
    let controller = addr(0x777);
    let (account_address, account) = deploy_account(0x12345, controller, 60);

    start_cheat_caller_address(account_address, controller);
    account.propose_recovery(0x54321);
    account.propose_recovery(0x67890);
}

#[test]
#[should_panic(expected: 'RECOVERY_DELAY_TOO_LONG')]
fn self_call_cannot_set_delay_above_contract_maximum() {
    let controller = addr(0x777);
    let (account_address, account) = deploy_account(0x12345, controller, 60);

    start_cheat_caller_address(account_address, account_address);
    account.set_recovery_delay(MAX_RECOVERY_DELAY_SECONDS + 1);
}
