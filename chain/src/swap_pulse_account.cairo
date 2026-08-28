use starknet::{ClassHash, ContractAddress};

#[starknet::interface]
pub trait ISwapPulseAccount<TContractState> {
    fn get_recovery_controller(self: @TContractState) -> ContractAddress;
    fn get_recovery_delay(self: @TContractState) -> u64;
    fn get_recovery_nonce(self: @TContractState) -> u64;
    fn get_pending_recovery(self: @TContractState) -> (felt252, u64);
    fn set_recovery_controller(ref self: TContractState, controller: ContractAddress);
    fn set_recovery_delay(ref self: TContractState, delay_seconds: u64);
    fn propose_recovery(ref self: TContractState, new_public_key: felt252);
    fn cancel_recovery(ref self: TContractState);
    fn execute_recovery(ref self: TContractState);
}

#[starknet::contract(account)]
pub mod SwapPulseAccount {
    use core::num::traits::Zero;
    use openzeppelin_account::AccountComponent;
    use openzeppelin_introspection::src5::SRC5Component;
    use openzeppelin_upgrades::{interface::IUpgradeable, UpgradeableComponent};
    use starknet::{
        get_block_timestamp, get_caller_address, get_contract_address, ClassHash, ContractAddress,
    };

    use super::ISwapPulseAccount;

    component!(path: AccountComponent, storage: account, event: AccountEvent);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);
    component!(path: UpgradeableComponent, storage: upgradeable, event: UpgradeableEvent);

    #[abi(embed_v0)]
    impl AccountMixinImpl = AccountComponent::AccountMixinImpl<ContractState>;
    impl AccountInternalImpl = AccountComponent::InternalImpl<ContractState>;
    impl UpgradeableInternalImpl = UpgradeableComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        account: AccountComponent::Storage,
        #[substorage(v0)]
        src5: SRC5Component::Storage,
        #[substorage(v0)]
        upgradeable: UpgradeableComponent::Storage,
        recovery_controller: ContractAddress,
        recovery_delay: u64,
        pending_recovery_public_key: felt252,
        pending_recovery_execute_after: u64,
        recovery_nonce: u64,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        AccountEvent: AccountComponent::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
        #[flat]
        UpgradeableEvent: UpgradeableComponent::Event,
        RecoveryControllerChanged: RecoveryControllerChanged,
        RecoveryDelayChanged: RecoveryDelayChanged,
        RecoveryProposed: RecoveryProposed,
        RecoveryCancelled: RecoveryCancelled,
        RecoveryExecuted: RecoveryExecuted,
    }

    #[derive(Drop, starknet::Event)]
    struct RecoveryControllerChanged {
        old_controller: ContractAddress,
        new_controller: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct RecoveryDelayChanged {
        old_delay: u64,
        new_delay: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct RecoveryProposed {
        new_public_key: felt252,
        execute_after: u64,
        nonce: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct RecoveryCancelled {
        nonce: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct RecoveryExecuted {
        new_public_key: felt252,
        nonce: u64,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        public_key: felt252,
        recovery_controller: ContractAddress,
        recovery_delay: u64,
    ) {
        assert(public_key != 0, 'INVALID_PUBLIC_KEY');
        self.account.initializer(public_key);
        self.recovery_controller.write(recovery_controller);
        self.recovery_delay.write(recovery_delay);
    }

    #[abi(embed_v0)]
    impl SwapPulseAccountImpl of ISwapPulseAccount<ContractState> {
        fn get_recovery_controller(self: @ContractState) -> ContractAddress {
            self.recovery_controller.read()
        }

        fn get_recovery_delay(self: @ContractState) -> u64 {
            self.recovery_delay.read()
        }

        fn get_recovery_nonce(self: @ContractState) -> u64 {
            self.recovery_nonce.read()
        }

        fn get_pending_recovery(self: @ContractState) -> (felt252, u64) {
            (
                self.pending_recovery_public_key.read(),
                self.pending_recovery_execute_after.read(),
            )
        }

        fn set_recovery_controller(ref self: ContractState, controller: ContractAddress) {
            self.account.assert_only_self();
            let old_controller = self.recovery_controller.read();
            self.recovery_controller.write(controller);
            self.emit(RecoveryControllerChanged { old_controller, new_controller: controller });
        }

        fn set_recovery_delay(ref self: ContractState, delay_seconds: u64) {
            self.account.assert_only_self();
            let old_delay = self.recovery_delay.read();
            self.recovery_delay.write(delay_seconds);
            self.emit(RecoveryDelayChanged { old_delay, new_delay: delay_seconds });
        }

        fn propose_recovery(ref self: ContractState, new_public_key: felt252) {
            self.assert_recovery_controller();
            assert(new_public_key != 0, 'INVALID_PUBLIC_KEY');
            assert(self.pending_recovery_public_key.read() == 0, 'RECOVERY_ALREADY_PENDING');

            let execute_after = get_block_timestamp() + self.recovery_delay.read();
            let nonce = self.recovery_nonce.read() + 1;
            self.pending_recovery_public_key.write(new_public_key);
            self.pending_recovery_execute_after.write(execute_after);
            self.recovery_nonce.write(nonce);

            self.emit(RecoveryProposed { new_public_key, execute_after, nonce });
        }

        fn cancel_recovery(ref self: ContractState) {
            let caller = get_caller_address();
            let controller = self.recovery_controller.read();
            let account_address = get_contract_address();
            assert(caller == controller || caller == account_address, 'NOT_AUTHORIZED');
            assert(self.pending_recovery_public_key.read() != 0, 'NO_PENDING_RECOVERY');

            let nonce = self.recovery_nonce.read();
            self.pending_recovery_public_key.write(0);
            self.pending_recovery_execute_after.write(0);
            self.emit(RecoveryCancelled { nonce });
        }

        fn execute_recovery(ref self: ContractState) {
            self.assert_recovery_controller();
            let new_public_key = self.pending_recovery_public_key.read();
            let execute_after = self.pending_recovery_execute_after.read();
            assert(new_public_key != 0, 'NO_PENDING_RECOVERY');
            assert(get_block_timestamp() >= execute_after, 'RECOVERY_NOT_READY');

            // AccountComponent intentionally exposes this internal primitive for
            // exceptional account extensions. The recovery controller and delay
            // above are the authorization boundary for this testnet-only path.
            self.account._set_public_key(new_public_key);
            self.pending_recovery_public_key.write(0);
            self.pending_recovery_execute_after.write(0);

            let nonce = self.recovery_nonce.read();
            self.emit(RecoveryExecuted { new_public_key, nonce });
        }
    }

    #[abi(embed_v0)]
    impl UpgradeableImpl of IUpgradeable<ContractState> {
        fn upgrade(ref self: ContractState, new_class_hash: ClassHash) {
            self.account.assert_only_self();
            assert(!new_class_hash.is_zero(), 'CLASS_HASH_ZERO');
            self.upgradeable.upgrade(new_class_hash);
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn assert_recovery_controller(self: @ContractState) {
            let controller = self.recovery_controller.read();
            assert(!controller.is_zero(), 'RECOVERY_DISABLED');
            assert(get_caller_address() == controller, 'NOT_RECOVERY_CONTROLLER');
        }
    }
}
