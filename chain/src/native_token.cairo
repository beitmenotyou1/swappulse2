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
//
// Standard ERC-20 behaviour is intentionally provided by OpenZeppelin's
// ERC20Component. This interface contains only SwapPulse-specific extensions.
#[starknet::interface]
pub trait INativeToken<TContractState> {
    fn mint(ref self: TContractState, recipient: ContractAddress, amount: u256);
    fn burn(ref self: TContractState, amount: u256);
    fn set_minter(ref self: TContractState, minter: ContractAddress, allowed: bool);
    fn is_minter(self: @TContractState, minter: ContractAddress) -> bool;
    fn max_supply(self: @TContractState) -> u256;
}

#[starknet::contract]
pub mod NativeToken {
    use core::num::traits::Zero;
    use openzeppelin_access::ownable::OwnableComponent;
    use openzeppelin_interfaces::upgrades::IUpgradeable;
    use openzeppelin_token::erc20::{DefaultConfig, ERC20Component, ERC20HooksEmptyImpl};
    use openzeppelin_upgrades::UpgradeableComponent;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{get_caller_address, ClassHash, ContractAddress};

    use super::INativeToken;

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    component!(path: ERC20Component, storage: erc20, event: ERC20Event);
    component!(path: UpgradeableComponent, storage: upgradeable, event: UpgradeableEvent);

    #[abi(embed_v0)]
    impl OwnableMixinImpl = OwnableComponent::OwnableMixinImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    #[abi(embed_v0)]
    impl ERC20MixinImpl = ERC20Component::ERC20MixinImpl<ContractState>;
    impl ERC20InternalImpl = ERC20Component::InternalImpl<ContractState>;

    impl UpgradeableInternalImpl = UpgradeableComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        #[substorage(v0)]
        erc20: ERC20Component::Storage,
        #[substorage(v0)]
        upgradeable: UpgradeableComponent::Storage,
        max_supply: u256,
        minters: Map<ContractAddress, bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        #[flat]
        ERC20Event: ERC20Component::Event,
        #[flat]
        UpgradeableEvent: UpgradeableComponent::Event,
        MinterUpdated: MinterUpdated,
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
        self.erc20.initializer(name, symbol);
        self.max_supply.write(max_supply);
    }

    #[abi(embed_v0)]
    impl NativeTokenImpl of INativeToken<ContractState> {
        // Minting is restricted to the owner plus explicitly allowlisted minters
        // (the staking/reward path and bridge adapter where enabled). ERC-20
        // balance and supply updates are delegated to OpenZeppelin.
        fn mint(ref self: ContractState, recipient: ContractAddress, amount: u256) {
            let caller = get_caller_address();
            let authorised = caller == self.ownable.Ownable_owner.read()
                || self.minters.read(caller);
            assert(authorised, 'MINT_NOT_AUTHORISED');
            assert(!recipient.is_zero(), 'INVALID_RECIPIENT');
            assert(amount > 0_u256, 'INVALID_AMOUNT');

            let current_supply = self.erc20.ERC20_total_supply.read();
            let new_supply = current_supply + amount;
            assert(new_supply <= self.max_supply.read(), 'MAX_SUPPLY_EXCEEDED');
            self.erc20.mint(recipient, amount);
        }

        fn burn(ref self: ContractState, amount: u256) {
            assert(amount > 0_u256, 'INVALID_AMOUNT');
            self.erc20.burn(get_caller_address(), amount);
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

        fn max_supply(self: @ContractState) -> u256 {
            self.max_supply.read()
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
