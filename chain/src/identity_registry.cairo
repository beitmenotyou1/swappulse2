use starknet::ContractAddress;

// Public identity state is intentionally pseudonymous. `identity_id` is an opaque
// application-generated felt and `account_address` is the public Starknet account
// bound to it. Human identity data must never be written into this structure.
#[derive(Copy, Drop, Serde)]
pub struct IdentityRecord {
    pub identity_id: felt252,
    pub account_address: ContractAddress,
    // 0 = none, 1 = active, 2 = merged. Kept numeric for ABI stability with
    // the Base44 reconciler and provisioning relay.
    pub status: u8,
    pub canonical_identity_id: felt252,
    pub created_at: u64,
    pub recovery_count: u64,
}

// Verification metadata deliberately contains commitments only. Raw identity
// claims (name, email, documents, date of birth, etc.) must remain off-chain.
// `verification_root` is intended to become a Merkle/Poseidon commitment to
// the verified claim set, while `schema_hash` identifies how that set was encoded.
// The off-chain commitment scheme MUST use domain separation plus secret
// salt/blinding. Never store a plain hash of low-entropy PII that can be guessed.
#[derive(Copy, Drop, Serde)]
pub struct IdentityVerification {
    pub verification_root: felt252,
    pub status: u8,
    pub schema_hash: felt252,
    pub attested_by: ContractAddress,
    pub verified_at: u64,
    pub expires_at: u64,
    pub revoked_at: u64,
    pub version: u64,
}

// Additive V2 assurance metadata. This is deliberately separate from
// `IdentityVerification` so the deployed Milestone 1 getter ABI remains stable
// for Base44 reconciliation during a staged registry upgrade.
#[derive(Copy, Drop, Serde)]
pub struct IdentityAssurance {
    // Opaque policy-defined category. Zero means the legacy V1 path/no V2 data.
    pub verification_type: u8,
    // Opaque assurance strength. Zero means the legacy V1 path/no V2 data.
    pub verification_level: u8,
    // Purpose-specific opaque replay identifier. Never encode private evidence.
    pub attestation_id: felt252,
}

#[starknet::interface]
pub trait IIdentityRegistry<TContractState> {
    fn register_identity(
        ref self: TContractState, identity_id: felt252, account_address: ContractAddress,
    );
    fn change_account(
        ref self: TContractState, identity_id: felt252, new_account: ContractAddress,
    );
    fn change_account_self(
        ref self: TContractState, identity_id: felt252, new_account: ContractAddress,
    );
    fn merge_identity(
        ref self: TContractState, source_identity_id: felt252, target_identity_id: felt252,
    );
    fn record_recovery(ref self: TContractState, identity_id: felt252);
    fn set_verifier(
        ref self: TContractState, verifier: ContractAddress, authorised: bool,
    );
    fn is_verifier(self: @TContractState, verifier: ContractAddress) -> bool;
    fn set_verification(
        ref self: TContractState,
        identity_id: felt252,
        verification_root: felt252,
        schema_hash: felt252,
        expires_at: u64,
    );
    fn set_verification_v2(
        ref self: TContractState,
        identity_id: felt252,
        verification_root: felt252,
        schema_hash: felt252,
        verification_type: u8,
        verification_level: u8,
        expires_at: u64,
        attestation_id: felt252,
    );
    fn require_verification_v2(ref self: TContractState);
    fn verification_v2_required(self: @TContractState) -> bool;
    fn is_attestation_used(self: @TContractState, attestation_id: felt252) -> bool;
    fn get_assurance(self: @TContractState, identity_id: felt252) -> IdentityAssurance;
    fn get_effective_assurance(self: @TContractState, identity_id: felt252) -> IdentityAssurance;
    fn revoke_verification(ref self: TContractState, identity_id: felt252);
    fn get_verification(
        self: @TContractState, identity_id: felt252,
    ) -> IdentityVerification;
    fn get_effective_verification(
        self: @TContractState, identity_id: felt252,
    ) -> IdentityVerification;
    fn is_verified(self: @TContractState, identity_id: felt252) -> bool;
    fn get_identity_record(self: @TContractState, identity_id: felt252) -> IdentityRecord;
    fn get_identity(
        self: @TContractState, identity_id: felt252,
    ) -> (ContractAddress, u8, felt252, u64, u64);
    fn get_identity_by_account(self: @TContractState, account_address: ContractAddress) -> felt252;
    fn resolve_canonical(self: @TContractState, identity_id: felt252) -> felt252;
}

#[starknet::contract]
pub mod IdentityRegistry {
    use core::num::traits::Zero;
    use openzeppelin_access::ownable::OwnableComponent;
    use openzeppelin_interfaces::upgrades::IUpgradeable;
    use openzeppelin_upgrades::UpgradeableComponent;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{get_block_timestamp, get_caller_address, ClassHash, ContractAddress};

    use super::{IIdentityRegistry, IdentityAssurance, IdentityRecord, IdentityVerification};

    const STATUS_NONE: u8 = 0;
    const STATUS_ACTIVE: u8 = 1;
    const STATUS_MERGED: u8 = 2;

    const VERIFICATION_NONE: u8 = 0;
    const VERIFICATION_VERIFIED: u8 = 1;
    const VERIFICATION_REVOKED: u8 = 2;

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
        identity_to_account: Map<felt252, ContractAddress>,
        account_to_identity: Map<ContractAddress, felt252>,
        identity_status: Map<felt252, u8>,
        canonical_identity: Map<felt252, felt252>,
        created_at: Map<felt252, u64>,
        recovery_count: Map<felt252, u64>,

        // Verification authority is deliberately separate from registry
        // ownership. The owner appoints/revokes verifier addresses, but only an
        // authorised verifier can create or revoke identity attestations.
        authorised_verifier: Map<ContractAddress, bool>,

        // Privacy-preserving verification layer. These fields hold only
        // commitments and audit metadata, never plaintext identity claims.
        verification_root: Map<felt252, felt252>,
        verification_status: Map<felt252, u8>,
        verification_schema_hash: Map<felt252, felt252>,
        verification_attested_by: Map<felt252, ContractAddress>,
        verification_verified_at: Map<felt252, u64>,
        verification_expires_at: Map<felt252, u64>,
        verification_revoked_at: Map<felt252, u64>,
        verification_version: Map<felt252, u64>,

        // V2 assurance metadata is additive so the V1 storage/getter ABI stays
        // intact across a staged class upgrade. `attestation_identity` is never
        // cleared: once a replay identifier has been consumed it remains spent.
        verification_type: Map<felt252, u8>,
        verification_level: Map<felt252, u8>,
        verification_attestation_id: Map<felt252, felt252>,
        attestation_identity: Map<felt252, felt252>,
        verification_v2_required: bool,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        #[flat]
        UpgradeableEvent: UpgradeableComponent::Event,
        IdentityCreated: IdentityCreated,
        AccountChanged: AccountChanged,
        IdentityMerged: IdentityMerged,
        IdentityRecovered: IdentityRecovered,
        VerifierAuthorisationChanged: VerifierAuthorisationChanged,
        IdentityVerified: IdentityVerified,
        IdentityAssuranceRecorded: IdentityAssuranceRecorded,
        VerificationV2Required: VerificationV2Required,
        IdentityVerificationRevoked: IdentityVerificationRevoked,
    }

    #[derive(Drop, starknet::Event)]
    struct IdentityCreated {
        #[key]
        identity_id: felt252,
        #[key]
        account_address: ContractAddress,
        created_at: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct AccountChanged {
        #[key]
        identity_id: felt252,
        old_account: ContractAddress,
        new_account: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct IdentityMerged {
        #[key]
        source_identity_id: felt252,
        #[key]
        target_identity_id: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct IdentityRecovered {
        #[key]
        identity_id: felt252,
        account_address: ContractAddress,
        recovery_count: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct VerifierAuthorisationChanged {
        #[key]
        verifier: ContractAddress,
        authorised: bool,
    }

    #[derive(Drop, starknet::Event)]
    struct IdentityVerified {
        #[key]
        identity_id: felt252,
        #[key]
        schema_hash: felt252,
        verification_root: felt252,
        attested_by: ContractAddress,
        verified_at: u64,
        expires_at: u64,
        version: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct IdentityAssuranceRecorded {
        #[key]
        identity_id: felt252,
        #[key]
        attestation_id: felt252,
        verification_type: u8,
        verification_level: u8,
        version: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct VerificationV2Required {
        enabled_at: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct IdentityVerificationRevoked {
        #[key]
        identity_id: felt252,
        revoked_by: ContractAddress,
        revoked_at: u64,
        version: u64,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.ownable.initializer(owner);
    }

    #[abi(embed_v0)]
    impl IdentityRegistryImpl of IIdentityRegistry<ContractState> {
        fn register_identity(
            ref self: ContractState, identity_id: felt252, account_address: ContractAddress,
        ) {
            self.ownable.assert_only_owner();
            assert(identity_id != 0, 'INVALID_IDENTITY_ID');
            assert(!account_address.is_zero(), 'INVALID_ACCOUNT');
            assert(self.identity_status.read(identity_id) == STATUS_NONE, 'IDENTITY_EXISTS');
            assert(self.account_to_identity.read(account_address) == 0, 'ACCOUNT_ALREADY_BOUND');

            let created_at = get_block_timestamp();
            self.identity_to_account.write(identity_id, account_address);
            self.account_to_identity.write(account_address, identity_id);
            self.identity_status.write(identity_id, STATUS_ACTIVE);
            self.canonical_identity.write(identity_id, identity_id);
            self.created_at.write(identity_id, created_at);

            self.emit(IdentityCreated { identity_id, account_address, created_at });
        }

        fn change_account(
            ref self: ContractState, identity_id: felt252, new_account: ContractAddress,
        ) {
            self.ownable.assert_only_owner();
            self.apply_account_change(identity_id, new_account);
        }

        // Self-sovereign migration path. When called through a Starknet account's
        // __execute__, get_caller_address() is the current account contract, so a
        // user explicitly authorises their own identity/account migration without
        // giving Base44 or the registry owner their signing key.
        fn change_account_self(
            ref self: ContractState, identity_id: felt252, new_account: ContractAddress,
        ) {
            self.assert_active(identity_id);
            let current_account = self.identity_to_account.read(identity_id);
            assert(get_caller_address() == current_account, 'ONLY_CURRENT_ACCOUNT');
            self.apply_account_change(identity_id, new_account);
        }

        fn merge_identity(
            ref self: ContractState, source_identity_id: felt252, target_identity_id: felt252,
        ) {
            self.ownable.assert_only_owner();
            assert(source_identity_id != target_identity_id, 'SAME_IDENTITY');
            self.assert_active(source_identity_id);
            self.assert_active(target_identity_id);

            // The source identity remains queryable forever. It is never deleted,
            // and historical account -> source mappings remain intact. Consumers
            // resolve it through resolve_canonical() to the surviving identity.
            self.identity_status.write(source_identity_id, STATUS_MERGED);
            self.canonical_identity.write(source_identity_id, target_identity_id);

            self.emit(IdentityMerged { source_identity_id, target_identity_id });
        }

        fn record_recovery(ref self: ContractState, identity_id: felt252) {
            self.ownable.assert_only_owner();
            self.assert_active(identity_id);
            let next_count = self.recovery_count.read(identity_id) + 1;
            self.recovery_count.write(identity_id, next_count);
            self.emit(
                IdentityRecovered {
                    identity_id,
                    account_address: self.identity_to_account.read(identity_id),
                    recovery_count: next_count,
                },
            );
        }

        fn set_verifier(
            ref self: ContractState, verifier: ContractAddress, authorised: bool,
        ) {
            self.ownable.assert_only_owner();
            assert(!verifier.is_zero(), 'INVALID_VERIFIER');
            self.authorised_verifier.write(verifier, authorised);
            self.emit(VerifierAuthorisationChanged { verifier, authorised });
        }

        fn is_verifier(self: @ContractState, verifier: ContractAddress) -> bool {
            self.authorised_verifier.read(verifier)
        }

        fn set_verification(
            ref self: ContractState,
            identity_id: felt252,
            verification_root: felt252,
            schema_hash: felt252,
            expires_at: u64,
        ) {
            self.assert_verifier();
            assert(!self.verification_v2_required.read(), 'VERIFY_V2_REQUIRED');
            self.assert_active(identity_id);
            assert(verification_root != 0, 'INVALID_VERIFY_ROOT');
            assert(schema_hash != 0, 'INVALID_SCHEMA_HASH');

            let verified_at = get_block_timestamp();
            assert(expires_at == 0 || expires_at > verified_at, 'VERIFY_EXPIRY_PAST');

            let next_version = self.verification_version.read(identity_id) + 1;
            let attested_by = get_caller_address();

            self.verification_root.write(identity_id, verification_root);
            self.verification_status.write(identity_id, VERIFICATION_VERIFIED);
            self.verification_schema_hash.write(identity_id, schema_hash);
            self.verification_attested_by.write(identity_id, attested_by);
            self.verification_verified_at.write(identity_id, verified_at);
            self.verification_expires_at.write(identity_id, expires_at);
            self.verification_revoked_at.write(identity_id, 0);
            self.verification_version.write(identity_id, next_version);

            self.emit(
                IdentityVerified {
                    identity_id,
                    schema_hash,
                    verification_root,
                    attested_by,
                    verified_at,
                    expires_at,
                    version: next_version,
                },
            );
        }

        fn set_verification_v2(
            ref self: ContractState,
            identity_id: felt252,
            verification_root: felt252,
            schema_hash: felt252,
            verification_type: u8,
            verification_level: u8,
            expires_at: u64,
            attestation_id: felt252,
        ) {
            self.assert_verifier();
            self.assert_active(identity_id);
            assert(verification_root != 0, 'INVALID_VERIFY_ROOT');
            assert(schema_hash != 0, 'INVALID_SCHEMA_HASH');
            assert(verification_type != 0, 'INVALID_VERIFY_TYPE');
            assert(verification_level != 0, 'INVALID_VERIFY_LEVEL');
            assert(attestation_id != 0, 'INVALID_ATTESTATION_ID');
            assert(self.attestation_identity.read(attestation_id) == 0, 'ATTESTATION_REPLAY');

            let verified_at = get_block_timestamp();
            assert(expires_at == 0 || expires_at > verified_at, 'VERIFY_EXPIRY_PAST');

            let next_version = self.verification_version.read(identity_id) + 1;
            let attested_by = get_caller_address();

            // Spend the replay id in the same atomic transaction as the
            // verification write. A reverted transaction consumes nothing.
            self.attestation_identity.write(attestation_id, identity_id);
            self.verification_root.write(identity_id, verification_root);
            self.verification_status.write(identity_id, VERIFICATION_VERIFIED);
            self.verification_schema_hash.write(identity_id, schema_hash);
            self.verification_attested_by.write(identity_id, attested_by);
            self.verification_verified_at.write(identity_id, verified_at);
            self.verification_expires_at.write(identity_id, expires_at);
            self.verification_revoked_at.write(identity_id, 0);
            self.verification_version.write(identity_id, next_version);
            self.verification_type.write(identity_id, verification_type);
            self.verification_level.write(identity_id, verification_level);
            self.verification_attestation_id.write(identity_id, attestation_id);

            self.emit(
                IdentityVerified {
                    identity_id,
                    schema_hash,
                    verification_root,
                    attested_by,
                    verified_at,
                    expires_at,
                    version: next_version,
                },
            );
            self.emit(
                IdentityAssuranceRecorded {
                    identity_id,
                    attestation_id,
                    verification_type,
                    verification_level,
                    version: next_version,
                },
            );
        }

        // One-way cut-over guard. Upgrade operators can deploy the additive V2
        // class, update the relay, then permanently disable the replay-less V1
        // attestation entrypoint. There is intentionally no method to turn it off.
        fn require_verification_v2(ref self: ContractState) {
            self.ownable.assert_only_owner();
            if self.verification_v2_required.read() {
                return;
            }
            self.verification_v2_required.write(true);
            self.emit(VerificationV2Required { enabled_at: get_block_timestamp() });
        }

        fn verification_v2_required(self: @ContractState) -> bool {
            self.verification_v2_required.read()
        }

        fn is_attestation_used(self: @ContractState, attestation_id: felt252) -> bool {
            if attestation_id == 0 {
                return false;
            }
            self.attestation_identity.read(attestation_id) != 0
        }

        fn get_assurance(self: @ContractState, identity_id: felt252) -> IdentityAssurance {
            IdentityAssurance {
                verification_type: self.verification_type.read(identity_id),
                verification_level: self.verification_level.read(identity_id),
                attestation_id: self.verification_attestation_id.read(identity_id),
            }
        }

        fn get_effective_assurance(
            self: @ContractState, identity_id: felt252,
        ) -> IdentityAssurance {
            let canonical = self.resolve_canonical(identity_id);
            let subject = if canonical == 0 { identity_id } else { canonical };
            IdentityAssurance {
                verification_type: self.verification_type.read(subject),
                verification_level: self.verification_level.read(subject),
                attestation_id: self.verification_attestation_id.read(subject),
            }
        }

        fn revoke_verification(ref self: ContractState, identity_id: felt252) {
            self.assert_verifier();
            self.assert_active(identity_id);
            assert(
                self.verification_status.read(identity_id) == VERIFICATION_VERIFIED,
                'VERIFY_NOT_ACTIVE',
            );

            let next_version = self.verification_version.read(identity_id) + 1;
            let revoked_at = get_block_timestamp();
            self.verification_status.write(identity_id, VERIFICATION_REVOKED);
            self.verification_revoked_at.write(identity_id, revoked_at);
            self.verification_version.write(identity_id, next_version);

            self.emit(
                IdentityVerificationRevoked {
                    identity_id,
                    revoked_by: get_caller_address(),
                    revoked_at,
                    version: next_version,
                },
            );
        }

        fn get_verification(
            self: @ContractState, identity_id: felt252,
        ) -> IdentityVerification {
            IdentityVerification {
                verification_root: self.verification_root.read(identity_id),
                status: self.verification_status.read(identity_id),
                schema_hash: self.verification_schema_hash.read(identity_id),
                attested_by: self.verification_attested_by.read(identity_id),
                verified_at: self.verification_verified_at.read(identity_id),
                expires_at: self.verification_expires_at.read(identity_id),
                revoked_at: self.verification_revoked_at.read(identity_id),
                version: self.verification_version.read(identity_id),
            }
        }

        fn get_effective_verification(
            self: @ContractState, identity_id: felt252,
        ) -> IdentityVerification {
            let canonical = self.resolve_canonical(identity_id);
            let subject = if canonical == 0 { identity_id } else { canonical };
            IdentityVerification {
                verification_root: self.verification_root.read(subject),
                status: self.verification_status.read(subject),
                schema_hash: self.verification_schema_hash.read(subject),
                attested_by: self.verification_attested_by.read(subject),
                verified_at: self.verification_verified_at.read(subject),
                expires_at: self.verification_expires_at.read(subject),
                revoked_at: self.verification_revoked_at.read(subject),
                version: self.verification_version.read(subject),
            }
        }

        fn is_verified(self: @ContractState, identity_id: felt252) -> bool {
            let canonical = self.resolve_canonical(identity_id);
            if canonical == 0 {
                return false;
            }

            if self.verification_status.read(canonical) != VERIFICATION_VERIFIED {
                return false;
            }

            let expires_at = self.verification_expires_at.read(canonical);
            expires_at == 0 || expires_at > get_block_timestamp()
        }

        fn get_identity_record(self: @ContractState, identity_id: felt252) -> IdentityRecord {
            IdentityRecord {
                identity_id,
                account_address: self.identity_to_account.read(identity_id),
                status: self.identity_status.read(identity_id),
                canonical_identity_id: self.resolve_canonical(identity_id),
                created_at: self.created_at.read(identity_id),
                recovery_count: self.recovery_count.read(identity_id),
            }
        }

        fn get_identity(
            self: @ContractState, identity_id: felt252,
        ) -> (ContractAddress, u8, felt252, u64, u64) {
            (
                self.identity_to_account.read(identity_id),
                self.identity_status.read(identity_id),
                self.resolve_canonical(identity_id),
                self.created_at.read(identity_id),
                self.recovery_count.read(identity_id),
            )
        }

        fn get_identity_by_account(
            self: @ContractState, account_address: ContractAddress,
        ) -> felt252 {
            self.account_to_identity.read(account_address)
        }

        fn resolve_canonical(self: @ContractState, identity_id: felt252) -> felt252 {
            let mut current = identity_id;
            let mut hops: u8 = 0;

            loop {
                let status = self.identity_status.read(current);
                if status == STATUS_NONE {
                    return 0;
                }
                if status == STATUS_ACTIVE {
                    return current;
                }

                assert(status == STATUS_MERGED, 'INVALID_IDENTITY_STATUS');
                let next = self.canonical_identity.read(current);
                assert(next != 0 && next != current, 'INVALID_CANONICAL_LINK');

                current = next;
                hops += 1;
                assert(hops <= 32_u8, 'MERGE_CHAIN_TOO_DEEP');
            }
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
        fn apply_account_change(
            ref self: ContractState, identity_id: felt252, new_account: ContractAddress,
        ) {
            self.assert_active(identity_id);
            assert(!new_account.is_zero(), 'INVALID_ACCOUNT');

            let old_account = self.identity_to_account.read(identity_id);
            assert(!old_account.is_zero(), 'IDENTITY_ACCOUNT_MISSING');
            assert(old_account != new_account, 'ACCOUNT_UNCHANGED');
            assert(self.account_to_identity.read(new_account) == 0, 'ACCOUNT_ALREADY_BOUND');

            self.account_to_identity.write(old_account, 0);
            self.identity_to_account.write(identity_id, new_account);
            self.account_to_identity.write(new_account, identity_id);

            self.emit(AccountChanged { identity_id, old_account, new_account });
        }

        fn assert_active(self: @ContractState, identity_id: felt252) {
            assert(self.identity_status.read(identity_id) == STATUS_ACTIVE, 'IDENTITY_NOT_ACTIVE');
        }

        fn assert_verifier(self: @ContractState) {
            let caller = get_caller_address();
            assert(self.authorised_verifier.read(caller), 'VERIFIER_NOT_AUTHORISED');
        }
    }
}
