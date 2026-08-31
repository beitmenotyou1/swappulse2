use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use starknet::ContractAddress;
use swappulse_network::native_token::{INativeTokenDispatcher, INativeTokenDispatcherTrait};

#[starknet::interface]
trait IERC20Test<TContractState> {
    fn name(self: @TContractState) -> ByteArray;
    fn symbol(self: @TContractState) -> ByteArray;
    fn decimals(self: @TContractState) -> u8;
    fn total_supply(self: @TContractState) -> u256;
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
    fn allowance(
        self: @TContractState, owner: ContractAddress, spender: ContractAddress,
    ) -> u256;
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    fn transfer_from(
        ref self: TContractState,
        sender: ContractAddress,
        recipient: ContractAddress,
        amount: u256,
    ) -> bool;
    fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;
}

fn addr(value: felt252) -> ContractAddress {
    value.try_into().unwrap()
}

fn deploy_token(
    owner: ContractAddress, max_supply: u256,
) -> (ContractAddress, INativeTokenDispatcher, IERC20TestDispatcher) {
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
        IERC20TestDispatcher { contract_address },
    )
}

#[test]
fn metadata_and_cap_are_exposed() {
    let owner = addr(0x111);
    let max_supply = 1_000_000_u256;
    let (_, token, erc20) = deploy_token(owner, max_supply);

    assert(erc20.name() == "SwapPulse", 'name mismatch');
    assert(erc20.symbol() == "SWPX", 'symbol mismatch');
    assert(erc20.decimals() == 18_u8, 'decimals mismatch');
    assert(erc20.total_supply() == 0_u256, 'initial supply');
    assert(token.max_supply() == max_supply, 'cap mismatch');
}

#[test]
fn owner_can_mint_and_holder_can_burn() {
    let owner = addr(0x111);
    let holder = addr(0x222);
    let (token_address, token, erc20) = deploy_token(owner, 1_000_000_u256);

    start_cheat_caller_address(token_address, owner);
    token.mint(holder, 500_u256);
    stop_cheat_caller_address(token_address);

    assert(erc20.total_supply() == 500_u256, 'mint supply');
    assert(erc20.balance_of(holder) == 500_u256, 'mint balance');

    start_cheat_caller_address(token_address, holder);
    token.burn(125_u256);
    stop_cheat_caller_address(token_address);

    assert(erc20.total_supply() == 375_u256, 'burn supply');
    assert(erc20.balance_of(holder) == 375_u256, 'burn balance');
}

#[test]
fn standard_transfer_and_allowance_flow_uses_openzeppelin_erc20() {
    let owner = addr(0x111);
    let alice = addr(0x222);
    let bob = addr(0x333);
    let spender = addr(0x444);
    let (token_address, token, erc20) = deploy_token(owner, 1_000_000_u256);

    start_cheat_caller_address(token_address, owner);
    token.mint(alice, 1_000_u256);
    stop_cheat_caller_address(token_address);

    start_cheat_caller_address(token_address, alice);
    assert(erc20.transfer(bob, 200_u256), 'transfer failed');
    assert(erc20.approve(spender, 300_u256), 'approve failed');
    stop_cheat_caller_address(token_address);

    start_cheat_caller_address(token_address, spender);
    assert(erc20.transfer_from(alice, bob, 120_u256), 'transfer_from failed');
    stop_cheat_caller_address(token_address);

    assert(erc20.balance_of(alice) == 680_u256, 'alice balance');
    assert(erc20.balance_of(bob) == 320_u256, 'bob balance');
    assert(erc20.allowance(alice, spender) == 180_u256, 'allowance mismatch');
}

#[test]
fn owner_can_authorise_and_revoke_minter() {
    let owner = addr(0x111);
    let minter = addr(0x222);
    let recipient = addr(0x333);
    let (token_address, token, erc20) = deploy_token(owner, 1_000_000_u256);

    start_cheat_caller_address(token_address, owner);
    token.set_minter(minter, true);
    stop_cheat_caller_address(token_address);
    assert(token.is_minter(minter), 'minter not enabled');

    start_cheat_caller_address(token_address, minter);
    token.mint(recipient, 77_u256);
    stop_cheat_caller_address(token_address);
    assert(erc20.balance_of(recipient) == 77_u256, 'minter mint failed');

    start_cheat_caller_address(token_address, owner);
    token.set_minter(minter, false);
    stop_cheat_caller_address(token_address);
    assert(!token.is_minter(minter), 'minter not revoked');
}

#[test]
#[should_panic(expected: 'MINT_NOT_AUTHORISED')]
fn unauthorised_account_cannot_mint() {
    let owner = addr(0x111);
    let attacker = addr(0x999);
    let (token_address, token, _) = deploy_token(owner, 1_000_000_u256);

    start_cheat_caller_address(token_address, attacker);
    token.mint(attacker, 1_u256);
}

#[test]
#[should_panic(expected: 'MAX_SUPPLY_EXCEEDED')]
fn mint_cannot_exceed_cap() {
    let owner = addr(0x111);
    let recipient = addr(0x222);
    let (token_address, token, _) = deploy_token(owner, 100_u256);

    start_cheat_caller_address(token_address, owner);
    token.mint(recipient, 100_u256);
    token.mint(recipient, 1_u256);
}

#[test]
#[should_panic]
fn non_owner_cannot_authorise_minter() {
    let owner = addr(0x111);
    let attacker = addr(0x999);
    let (token_address, token, _) = deploy_token(owner, 1_000_000_u256);

    start_cheat_caller_address(token_address, attacker);
    token.set_minter(attacker, true);
}

#[test]
#[should_panic(expected: 'INVALID_AMOUNT')]
fn zero_burn_is_rejected() {
    let owner = addr(0x111);
    let (token_address, token, _) = deploy_token(owner, 1_000_000_u256);

    start_cheat_caller_address(token_address, owner);
    token.burn(0_u256);
}

#[test]
#[fuzzer(runs: 64, seed: 311)]
fn fuzz_mint_then_burn_preserves_supply_accounting(raw_amount: u128) {
    let owner = addr(0x111);
    let holder = addr(0x222);
    let max_supply = 1_000_000_u256;
    let bounded = raw_amount % 999_999_u128 + 1_u128;
    let amount: u256 = bounded.into();
    let burn_amount: u256 = (bounded / 2_u128).into();
    let (token_address, token, erc20) = deploy_token(owner, max_supply);

    start_cheat_caller_address(token_address, owner);
    token.mint(holder, amount);
    stop_cheat_caller_address(token_address);

    if burn_amount > 0_u256 {
        start_cheat_caller_address(token_address, holder);
        token.burn(burn_amount);
        stop_cheat_caller_address(token_address);
    }

    let expected = amount - burn_amount;
    assert(erc20.total_supply() == expected, 'fuzz supply mismatch');
    assert(erc20.balance_of(holder) == expected, 'fuzz balance mismatch');
}
