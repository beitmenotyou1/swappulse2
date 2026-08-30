use starknet::ContractAddress;

// The SwapPulse appchain native staking token.
//
// TICKER IS NOT FINAL. The symbol is a constructor argument so the deployed
// ticker can be set once branding is cleared. It must never be PULSE or PLS —
// those belong to PulseChain, a live traded token, and would guarantee market
// confusion. Clean candidates verified against CoinGecko / CoinMarketCap /
// DexScreener: SWPX, TCGX.
//
// This token pays for nothing at the user level: the appchain enforces a zero
// protocol fee for user transactions at the sequencer fee policy. The token
// exists to secure the chain through staking, not to charge collectors.
#[starknet::interface]
pub trait INativeToken<TContractState> {
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
    fn mint(ref self: TContractState, recipient: ContractAddress, amount: u256);
    fn burn(ref self: TContractState, amount: u256);
    fn set_minter(ref self: TContractState, minter: ContractAddress, allowed: bool);
    fn is_minter(self: @TContractState, minter: ContractAddress) -> bool;
}

#[starknet::contract]
pub mod NativeToken {
    use core::num::traits::Zero;
    use openzeppelin_access::ownable::OwnableComponent;
    use openzeppelin_interfaces::upgrades::IUpgradeable;
    use openzeppelin_upgrades::UpgradeableComponent;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{get_caller_address, ClassHash, ContractAddress};

    use super::INativeToken;

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
        token_name: ByteArray,
        token_symbol: ByteArray,
        total_supply: u256,
        max_supply: u256,
        balances: Map<ContractAddress, u256>,
        allowances: Map<(ContractAddress, ContractAddress), u256>,
        minters: Map<ContractAddress, bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        #[flat]
        UpgradeableEvent: UpgradeableComponent::Event,
        Transfer: Transfer,
        Approval: Approval,
        MinterUpdated: MinterUpdated,
    }

    #[derive(Drop, starknet::Event)]
    struct Transfer {
        #[key]
        from: ContractAddress,
        #[key]
        to: ContractAddress,
        value: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Approval {
        #[key]
        owner: ContractAddress,
        #[key]
        spender: ContractAddress,
        value: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct MinterUpdated {
        #[key]
        minter: ContractAddress,
        allowed: bool,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        name: ByteArray,
        symbol: ByteArray,
        max_supply: u256,
    ) {
        self.ownable.initializer(owner);
        assert(max_supply > 0_u256, 'INVALID_MAX_SUPPLY');
        self.token_name.write(name);
        self.token_symbol.write(symbol);
        self.max_supply.write(max_supply);
    }

    #[abi(embed_v0)]
    impl NativeTokenImpl of INativeToken<ContractState> {
        fn name(self: @ContractState) -> ByteArray {
            self.token_name.read()
        }

        fn symbol(self: @ContractState) -> ByteArray {
            self.token_symbol.read()
        }

        fn decimals(self: @ContractState) -> u8 {
            18_u8
        }

        fn total_supply(self: @ContractState) -> u256 {
            self.total_supply.read()
        }

        fn balance_of(self: @ContractState, account: ContractAddress) -> u256 {
            self.balances.read(account)
        }

        fn allowance(
            self: @ContractState, owner: ContractAddress, spender: ContractAddress,
        ) -> u256 {
            self.allowances.read((owner, spender))
        }

        fn transfer(ref self: ContractState, recipient: ContractAddress, amount: u256) -> bool {
            self.move_tokens(get_caller_address(), recipient, amount);
            true
        }

        fn transfer_from(
            ref self: ContractState,
            sender: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
        ) -> bool {
            let spender = get_caller_address();
            let allowed = self.allowances.read((sender, spender));
            assert(allowed >= amount, 'INSUFFICIENT_ALLOWANCE');
            self.allowances.write((sender, spender), allowed - amount);
            self.move_tokens(sender, recipient, amount);
            true
        }

        fn approve(ref self: ContractState, spender: ContractAddress, amount: u256) -> bool {
            let owner = get_caller_address();
            assert(!spender.is_zero(), 'INVALID_SPENDER');
            self.allowances.write((owner, spender), amount);
            self.emit(Approval { owner, spender, value: amount });
            true
        }

        // Minting is restricted to the owner plus explicitly allowlisted minters
        // (the staking pool for rewards, the bridge adapter for inbound release).
        fn mint(ref self: ContractState, recipient: ContractAddress, amount: u256) {
            let caller = get_caller_address();
            let authorised = caller == self.ownable.Ownable_owner.read()
                || self.minters.read(caller);
            assert(authorised, 'MINT_NOT_AUTHORISED');
            assert(!recipient.is_zero(), 'INVALID_RECIPIENT');
            assert(amount > 0_u256, 'INVALID_AMOUNT');

            let new_supply = self.total_supply.read() + amount;
            assert(new_supply <= self.max_supply.read(), 'MAX_SUPPLY_EXCEEDED');

            self.total_supply.write(new_supply);
            self.balances.write(recipient, self.balances.read(recipient) + amount);
            self.emit(Transfer { from: Zero::zero(), to: recipient, value: amount });
        }

        fn burn(ref self: ContractState, amount: u256) {
            let caller = get_caller_address();
            let balance = self.balances.read(caller);
            assert(balance >= amount, 'INSUFFICIENT_BALANCE');
            self.balances.write(caller, balance - amount);
            self.total_supply.write(self.total_supply.read() - amount);
            self.emit(Transfer { from: caller, to: Zero::zero(), value: amount });
        }

        fn set_minter(ref self: ContractState, minter: ContractAddress, allowed: bool) {
            self.ownable.assert_only_owner();
            assert(!minter.is_zero(), 'INVALID_MINTER');
            self.minters.write(minter, allowed);
            self.emit(MinterUpdated { minter, allowed });
        }

        fn is_minter(self: @ContractState, minter: ContractAddress) -> bool {
            self.minters.read(minter)
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
        fn move_tokens(
            ref self: ContractState,
            from: ContractAddress,
            to: ContractAddress,
            amount: u256,
        ) {
            assert(!to.is_zero(), 'INVALID_RECIPIENT');
            let balance = self.balances.read(from);
            assert(balance >= amount, 'INSUFFICIENT_BALANCE');
            self.balances.write(from, balance - amount);
            self.balances.write(to, self.balances.read(to) + amount);
            self.emit(Transfer { from, to, value: amount });
        }
    }
}