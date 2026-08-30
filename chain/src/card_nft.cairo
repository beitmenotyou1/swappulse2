use starknet::ContractAddress;

// A minted card ownership record. `verification_level` is the achieved
// CardVerificationSession level (0 = self-attested .. 3 = graded cert) and is
// stored on-chain so it survives federation and external indexing.
#[derive(Copy, Drop, Serde)]
pub struct CardRecord {
    pub token_id: u256,
    pub owner: ContractAddress,
    pub card_id: felt252,
    pub verification_level: u8,
    pub attestation_hash: felt252,
    pub minted_at: u64,
    // 0 = transferable, 1 = soulbound (bound to the verifying collector).
    pub soulbound: u8,
}

#[starknet::interface]
pub trait ICardNft<TContractState> {
    fn mint(
        ref self: TContractState,
        to: ContractAddress,
        card_id: felt252,
        verification_level: u8,
        attestation_hash: felt252,
        metadata_uri: ByteArray,
        soulbound: u8,
    ) -> u256;
    fn burn(ref self: TContractState, token_id: u256);
    fn transfer(ref self: TContractState, to: ContractAddress, token_id: u256);
    fn owner_of(self: @TContractState, token_id: u256) -> ContractAddress;
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
    fn token_uri(self: @TContractState, token_id: u256) -> ByteArray;
    fn get_card(self: @TContractState, token_id: u256) -> CardRecord;
    fn total_minted(self: @TContractState) -> u256;
    fn set_bridge(ref self: TContractState, bridge: ContractAddress);
}

#[starknet::contract]
pub mod CardNft {
    use core::num::traits::Zero;
    use openzeppelin_access::ownable::OwnableComponent;
    use openzeppelin_interfaces::upgrades::IUpgradeable;
    use openzeppelin_upgrades::UpgradeableComponent;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{get_block_timestamp, get_caller_address, ClassHash, ContractAddress};

    use super::{CardRecord, ICardNft};

    const SOULBOUND: u8 = 1;
    const MAX_VERIFICATION_LEVEL: u8 = 3;

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
        next_token_id: u256,
        total_minted: u256,
        token_owner: Map<u256, ContractAddress>,
        token_balance: Map<ContractAddress, u256>,
        token_card_id: Map<u256, felt252>,
        token_level: Map<u256, u8>,
        token_attestation: Map<u256, felt252>,
        token_minted_at: Map<u256, u64>,
        token_soulbound: Map<u256, u8>,
        token_uri: Map<u256, ByteArray>,
        // One mint per (collector, card) attestation pair — prevents the same
        // verified scan being minted repeatedly into supply.
        minted_attestation: Map<felt252, bool>,
        // The bridge adapter is the only non-owner allowed to burn for lock-and-mint.
        bridge: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        #[flat]
        UpgradeableEvent: UpgradeableComponent::Event,
        CardMinted: CardMinted,
        CardBurned: CardBurned,
        CardTransferred: CardTransferred,
        BridgeUpdated: BridgeUpdated,
    }

    #[derive(Drop, starknet::Event)]
    struct CardMinted {
        #[key]
        token_id: u256,
        #[key]
        owner: ContractAddress,
        #[key]
        card_id: felt252,
        verification_level: u8,
        attestation_hash: felt252,
        metadata_uri: ByteArray,
        soulbound: u8,
        minted_at: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct CardBurned {
        #[key]
        token_id: u256,
        #[key]
        owner: ContractAddress,
        burned_by: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct CardTransferred {
        #[key]
        token_id: u256,
        #[key]
        from: ContractAddress,
        #[key]
        to: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct BridgeUpdated {
        old_bridge: ContractAddress,
        new_bridge: ContractAddress,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.ownable.initializer(owner);
        self.next_token_id.write(1_u256);
    }

    #[abi(embed_v0)]
    impl CardNftImpl of ICardNft<ContractState> {
        // Minting is owner-gated: the SwapPulse relay mints only after a
        // CardVerificationSession has been verified off-chain. `attestation_hash`
        // is the commitment to that session so the mint is auditable.
        fn mint(
            ref self: ContractState,
            to: ContractAddress,
            card_id: felt252,
            verification_level: u8,
            attestation_hash: felt252,
            metadata_uri: ByteArray,
            soulbound: u8,
        ) -> u256 {
            self.ownable.assert_only_owner();
            assert(!to.is_zero(), 'INVALID_RECIPIENT');
            assert(card_id != 0, 'INVALID_CARD_ID');
            assert(verification_level <= MAX_VERIFICATION_LEVEL, 'INVALID_LEVEL');
            assert(attestation_hash != 0, 'INVALID_ATTESTATION');
            assert(!self.minted_attestation.read(attestation_hash), 'ATTESTATION_USED');
            assert(soulbound <= SOULBOUND, 'INVALID_SOULBOUND');

            let token_id = self.next_token_id.read();
            let minted_at = get_block_timestamp();

            self.minted_attestation.write(attestation_hash, true);
            self.token_owner.write(token_id, to);
            self.token_balance.write(to, self.token_balance.read(to) + 1_u256);
            self.token_card_id.write(token_id, card_id);
            self.token_level.write(token_id, verification_level);
            self.token_attestation.write(token_id, attestation_hash);
            self.token_minted_at.write(token_id, minted_at);
            self.token_soulbound.write(token_id, soulbound);
            self.token_uri.write(token_id, metadata_uri.clone());
            self.next_token_id.write(token_id + 1_u256);
            self.total_minted.write(self.total_minted.read() + 1_u256);

            self
                .emit(
                    CardMinted {
                        token_id,
                        owner: to,
                        card_id,
                        verification_level,
                        attestation_hash,
                        metadata_uri,
                        soulbound,
                        minted_at,
                    },
                );

            token_id
        }

        // Burn is used by the bridge adapter for lock-and-mint, and by the owner
        // for administrative correction. The holder may also burn their own token.
        fn burn(ref self: ContractState, token_id: u256) {
            let holder = self.token_owner.read(token_id);
            assert(!holder.is_zero(), 'TOKEN_NOT_FOUND');

            let caller = get_caller_address();
            let bridge = self.bridge.read();
            let is_authorised = caller == holder
                || (!bridge.is_zero() && caller == bridge)
                || caller == self.ownable.Ownable_owner.read();
            assert(is_authorised, 'BURN_NOT_AUTHORISED');

            self.token_owner.write(token_id, Zero::zero());
            self.token_balance.write(holder, self.token_balance.read(holder) - 1_u256);
            self.total_minted.write(self.total_minted.read() - 1_u256);

            self.emit(CardBurned { token_id, owner: holder, burned_by: caller });
        }

        fn transfer(ref self: ContractState, to: ContractAddress, token_id: u256) {
            let holder = self.token_owner.read(token_id);
            assert(!holder.is_zero(), 'TOKEN_NOT_FOUND');
            assert(get_caller_address() == holder, 'NOT_TOKEN_OWNER');
            assert(!to.is_zero(), 'INVALID_RECIPIENT');
            assert(self.token_soulbound.read(token_id) != SOULBOUND, 'TOKEN_SOULBOUND');

            self.token_owner.write(token_id, to);
            self.token_balance.write(holder, self.token_balance.read(holder) - 1_u256);
            self.token_balance.write(to, self.token_balance.read(to) + 1_u256);

            self.emit(CardTransferred { token_id, from: holder, to });
        }

        fn owner_of(self: @ContractState, token_id: u256) -> ContractAddress {
            self.token_owner.read(token_id)
        }

        fn balance_of(self: @ContractState, account: ContractAddress) -> u256 {
            self.token_balance.read(account)
        }

        fn token_uri(self: @ContractState, token_id: u256) -> ByteArray {
            self.token_uri.read(token_id)
        }

        fn get_card(self: @ContractState, token_id: u256) -> CardRecord {
            CardRecord {
                token_id,
                owner: self.token_owner.read(token_id),
                card_id: self.token_card_id.read(token_id),
                verification_level: self.token_level.read(token_id),
                attestation_hash: self.token_attestation.read(token_id),
                minted_at: self.token_minted_at.read(token_id),
                soulbound: self.token_soulbound.read(token_id),
            }
        }

        fn total_minted(self: @ContractState) -> u256 {
            self.total_minted.read()
        }

        fn set_bridge(ref self: ContractState, bridge: ContractAddress) {
            self.ownable.assert_only_owner();
            let old_bridge = self.bridge.read();
            self.bridge.write(bridge);
            self.emit(BridgeUpdated { old_bridge, new_bridge: bridge });
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