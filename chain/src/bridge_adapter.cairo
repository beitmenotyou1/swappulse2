use starknet::ContractAddress;

// An outbound bridge request. The asset is locked (token) or burned (card NFT)
// on the SwapPulse appchain, and this record is the canonical proof the relay
// uses to mint/release on the destination chain. The appchain stays the
// authoritative home for the asset.
#[derive(Copy, Drop, Serde)]
pub struct OutboundTransfer {
    pub nonce: u64,
    pub sender: ContractAddress,
    // 0 = native token, 1 = card NFT.
    pub asset_kind: u8,
    // Destination chain key: 1 = Ethereum, 2 = L2, 3 = Solana.
    pub destination_chain: u8,
    pub amount_or_token_id: u256,
    pub recipient_hash: felt252,
    // 0 = pending, 1 = relayed, 2 = refunded.
    pub status: u8,
    pub created_at: u64,
}

#[starknet::interface]
pub trait IBridgeAdapter<TContractState> {
    fn bridge_out_token(
        ref self: TContractState, destination_chain: u8, amount: u256, recipient_hash: felt252,
    ) -> u64;
    fn bridge_out_card(
        ref self: TContractState, destination_chain: u8, token_id: u256, recipient_hash: felt252,
    ) -> u64;
    fn confirm_relayed(ref self: TContractState, nonce: u64);
    fn refund(ref self: TContractState, nonce: u64);
    fn release_inbound(
        ref self: TContractState,
        source_chain: u8,
        source_tx_hash: felt252,
        recipient: ContractAddress,
        amount: u256,
    );
    fn get_outbound(self: @TContractState, nonce: u64) -> OutboundTransfer;
    fn set_chain_enabled(ref self: TContractState, destination_chain: u8, enabled: bool);
    fn is_chain_enabled(self: @TContractState, destination_chain: u8) -> bool;
    fn locked_token_balance(self: @TContractState) -> u256;
    fn outbound_count(self: @TContractState) -> u64;
}

#[starknet::interface]
trait IBridgeToken<TContractState> {
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    fn transfer_from(
        ref self: TContractState,
        sender: ContractAddress,
        recipient: ContractAddress,
        amount: u256,
    ) -> bool;
    fn mint(ref self: TContractState, recipient: ContractAddress, amount: u256);
}

#[starknet::interface]
trait IBridgeCard<TContractState> {
    fn owner_of(self: @TContractState, token_id: u256) -> ContractAddress;
    fn burn(ref self: TContractState, token_id: u256);
}

#[starknet::contract]
pub mod BridgeAdapter {
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
        IBridgeAdapter, IBridgeCardDispatcher, IBridgeCardDispatcherTrait, IBridgeTokenDispatcher,
        IBridgeTokenDispatcherTrait, OutboundTransfer,
    };

    const ASSET_TOKEN: u8 = 0;
    const ASSET_CARD: u8 = 1;

    const STATUS_PENDING: u8 = 0;
    const STATUS_RELAYED: u8 = 1;
    const STATUS_REFUNDED: u8 = 2;

    const CHAIN_MAX: u8 = 3;

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
        bridge_token: ContractAddress,
        card_nft: ContractAddress,
        next_nonce: u64,
        locked_token_balance: u256,
        chain_enabled: Map<u8, bool>,
        out_sender: Map<u64, ContractAddress>,
        out_asset_kind: Map<u64, u8>,
        out_chain: Map<u64, u8>,
        out_amount: Map<u64, u256>,
        out_recipient_hash: Map<u64, felt252>,
        out_status: Map<u64, u8>,
        out_created_at: Map<u64, u64>,
        // Inbound replay protection keyed by (source_chain, source_tx_hash).
        inbound_processed: Map<(u8, felt252), bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        #[flat]
        UpgradeableEvent: UpgradeableComponent::Event,
        BridgeOutInitiated: BridgeOutInitiated,
        BridgeOutRelayed: BridgeOutRelayed,
        BridgeOutRefunded: BridgeOutRefunded,
        InboundReleased: InboundReleased,
        ChainEnabledUpdated: ChainEnabledUpdated,
    }

    #[derive(Drop, starknet::Event)]
    struct BridgeOutInitiated {
        #[key]
        nonce: u64,
        #[key]
        sender: ContractAddress,
        #[key]
        destination_chain: u8,
        asset_kind: u8,
        amount_or_token_id: u256,
        recipient_hash: felt252,
        created_at: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct BridgeOutRelayed {
        #[key]
        nonce: u64,
        confirmed_by: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct BridgeOutRefunded {
        #[key]
        nonce: u64,
        #[key]
        sender: ContractAddress,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct InboundReleased {
        #[key]
        source_chain: u8,
        #[key]
        source_tx_hash: felt252,
        recipient: ContractAddress,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct ChainEnabledUpdated {
        #[key]
        destination_chain: u8,
        enabled: bool,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        bridge_token: ContractAddress,
        card_nft: ContractAddress,
    ) {
        self.ownable.initializer(owner);
        assert(!bridge_token.is_zero(), 'INVALID_BRIDGE_TOKEN');
        self.bridge_token.write(bridge_token);
        self.card_nft.write(card_nft);
        self.next_nonce.write(1_u64);
    }

    #[abi(embed_v0)]
    impl BridgeAdapterImpl of IBridgeAdapter<ContractState> {
        // Lock-and-mint: the token is escrowed in this contract and the relay
        // mints the wrapped representation on the destination chain. Nothing is
        // released here until the relay reports success or the request is refunded.
        fn bridge_out_token(
            ref self: ContractState, destination_chain: u8, amount: u256, recipient_hash: felt252,
        ) -> u64 {
            self.assert_chain(destination_chain);
            assert(amount > 0_u256, 'INVALID_AMOUNT');
            assert(recipient_hash != 0, 'INVALID_RECIPIENT');

            let sender = get_caller_address();
            let ok = IBridgeTokenDispatcher { contract_address: self.bridge_token.read() }
                .transfer_from(sender, get_contract_address(), amount);
            assert(ok, 'LOCK_TRANSFER_FAILED');
            self.locked_token_balance.write(self.locked_token_balance.read() + amount);

            self.record_outbound(sender, ASSET_TOKEN, destination_chain, amount, recipient_hash)
        }

        // Burn-and-mint for cards: the appchain NFT is burned so the same card can
        // never be live on two chains at once. Re-entry happens via release_inbound.
        fn bridge_out_card(
            ref self: ContractState, destination_chain: u8, token_id: u256, recipient_hash: felt252,
        ) -> u64 {
            self.assert_chain(destination_chain);
            assert(recipient_hash != 0, 'INVALID_RECIPIENT');
            let card_nft = self.card_nft.read();
            assert(!card_nft.is_zero(), 'CARD_BRIDGE_DISABLED');

            let sender = get_caller_address();
            let card = IBridgeCardDispatcher { contract_address: card_nft };
            assert(card.owner_of(token_id) == sender, 'NOT_CARD_OWNER');
            card.burn(token_id);

            self.record_outbound(sender, ASSET_CARD, destination_chain, token_id, recipient_hash)
        }

        fn confirm_relayed(ref self: ContractState, nonce: u64) {
            self.ownable.assert_only_owner();
            assert(self.out_status.read(nonce) == STATUS_PENDING, 'TRANSFER_NOT_PENDING');
            assert(!self.out_sender.read(nonce).is_zero(), 'TRANSFER_NOT_FOUND');
            self.out_status.write(nonce, STATUS_RELAYED);
            self.emit(BridgeOutRelayed { nonce, confirmed_by: get_caller_address() });
        }

        // Refund path for a permanently failed relay. Only unlocks what was
        // actually escrowed; burned cards are re-minted through the card contract
        // by the relay, not here, so no supply is created by a refund.
        fn refund(ref self: ContractState, nonce: u64) {
            self.ownable.assert_only_owner();
            assert(self.out_status.read(nonce) == STATUS_PENDING, 'TRANSFER_NOT_PENDING');

            let sender = self.out_sender.read(nonce);
            assert(!sender.is_zero(), 'TRANSFER_NOT_FOUND');
            let amount = self.out_amount.read(nonce);
            self.out_status.write(nonce, STATUS_REFUNDED);

            if self.out_asset_kind.read(nonce) == ASSET_TOKEN {
                let locked = self.locked_token_balance.read();
                assert(locked >= amount, 'LOCKED_BALANCE_TOO_LOW');
                self.locked_token_balance.write(locked - amount);
                let ok = IBridgeTokenDispatcher { contract_address: self.bridge_token.read() }
                    .transfer(sender, amount);
                assert(ok, 'REFUND_TRANSFER_FAILED');
            }

            self.emit(BridgeOutRefunded { nonce, sender, amount });
        }

        // Inbound from an external chain. Keyed on the source transaction hash so
        // a replayed relay message can never mint twice.
        fn release_inbound(
            ref self: ContractState,
            source_chain: u8,
            source_tx_hash: felt252,
            recipient: ContractAddress,
            amount: u256,
        ) {
            self.ownable.assert_only_owner();
            self.assert_chain(source_chain);
            assert(source_tx_hash != 0, 'INVALID_SOURCE_TX');
            assert(!recipient.is_zero(), 'INVALID_RECIPIENT');
            assert(amount > 0_u256, 'INVALID_AMOUNT');
            assert(
                !self.inbound_processed.read((source_chain, source_tx_hash)),
                'INBOUND_ALREADY_PROCESSED',
            );

            self.inbound_processed.write((source_chain, source_tx_hash), true);

            let token = IBridgeTokenDispatcher { contract_address: self.bridge_token.read() };
            let locked = self.locked_token_balance.read();
            if locked >= amount {
                // Prefer releasing previously escrowed supply over minting new.
                self.locked_token_balance.write(locked - amount);
                let ok = token.transfer(recipient, amount);
                assert(ok, 'RELEASE_TRANSFER_FAILED');
            } else {
                token.mint(recipient, amount);
            }

            self.emit(InboundReleased { source_chain, source_tx_hash, recipient, amount });
        }

        fn get_outbound(self: @ContractState, nonce: u64) -> OutboundTransfer {
            OutboundTransfer {
                nonce,
                sender: self.out_sender.read(nonce),
                asset_kind: self.out_asset_kind.read(nonce),
                destination_chain: self.out_chain.read(nonce),
                amount_or_token_id: self.out_amount.read(nonce),
                recipient_hash: self.out_recipient_hash.read(nonce),
                status: self.out_status.read(nonce),
                created_at: self.out_created_at.read(nonce),
            }
        }

        fn set_chain_enabled(ref self: ContractState, destination_chain: u8, enabled: bool) {
            self.ownable.assert_only_owner();
            assert(destination_chain > 0 && destination_chain <= CHAIN_MAX, 'INVALID_CHAIN');
            self.chain_enabled.write(destination_chain, enabled);
            self.emit(ChainEnabledUpdated { destination_chain, enabled });
        }

        fn is_chain_enabled(self: @ContractState, destination_chain: u8) -> bool {
            self.chain_enabled.read(destination_chain)
        }

        fn locked_token_balance(self: @ContractState) -> u256 {
            self.locked_token_balance.read()
        }

        fn outbound_count(self: @ContractState) -> u64 {
            self.next_nonce.read() - 1_u64
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
        fn assert_chain(self: @ContractState, destination_chain: u8) {
            assert(destination_chain > 0 && destination_chain <= CHAIN_MAX, 'INVALID_CHAIN');
            assert(self.chain_enabled.read(destination_chain), 'CHAIN_DISABLED');
        }

        fn record_outbound(
            ref self: ContractState,
            sender: ContractAddress,
            asset_kind: u8,
            destination_chain: u8,
            amount_or_token_id: u256,
            recipient_hash: felt252,
        ) -> u64 {
            let nonce = self.next_nonce.read();
            let created_at = get_block_timestamp();

            self.out_sender.write(nonce, sender);
            self.out_asset_kind.write(nonce, asset_kind);
            self.out_chain.write(nonce, destination_chain);
            self.out_amount.write(nonce, amount_or_token_id);
            self.out_recipient_hash.write(nonce, recipient_hash);
            self.out_status.write(nonce, STATUS_PENDING);
            self.out_created_at.write(nonce, created_at);
            self.next_nonce.write(nonce + 1_u64);

            self
                .emit(
                    BridgeOutInitiated {
                        nonce,
                        sender,
                        destination_chain,
                        asset_kind,
                        amount_or_token_id,
                        recipient_hash,
                        created_at,
                    },
                );

            nonce
        }
    }
}