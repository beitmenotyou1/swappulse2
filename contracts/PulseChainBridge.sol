// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title PulseChainBridge
 * @author SwapPulse / Michael Burgess
 * @notice Receives relayed bridge events from Polygon and mints
 *         mirrored assets on PulseChain.
 *
 * This contract holds the BRIDGE_ROLE on both SwapPulseCardNFTV2
 * and SwapPulseUsernameV2, allowing it to mint mirrored tokens
 * when the relayer confirms a bridge event from Polygon.
 *
 * Security:
 * - Only authorised relayers can trigger mirror mints
 * - Each bridge event is tracked by a unique nonce to prevent duplicates
 * - Emergency pause functionality
 * - Admin can reverse mirrors in case of errors
 *
 * @dev Uses OpenZeppelin v5 AccessControl, Pausable.
 *      Pre-compiled bytecode stored in base44/shared/pulseCompiledArtifacts.ts.
 */

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface ICardNFT {
    function bridgeMint(
        address to,
        string calldata cardId,
        string calldata variant,
        uint256 amount
    ) external;

    function bridgeBurn(
        address from,
        string calldata cardId,
        string calldata variant,
        uint256 amount
    ) external;
}

interface IUsernameNFT {
    function bridgeMint(
        address to,
        string calldata username,
        string calldata did,
        uint256 originalTokenId
    ) external returns (uint256);

    function bridgeBurn(uint256 tokenId) external;
}

contract PulseChainBridge is AccessControl, Pausable {
    // ============================================================
    // Roles
    // ============================================================

    bytes32 public constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    // ============================================================
    // Storage
    // ============================================================

    /// @dev Address of the SwapPulseCardNFTV2 on PulseChain
    address public cardNFTContract;

    /// @dev Address of the SwapPulseUsernameV2 on PulseChain
    address public usernameNFTContract;

    /// @dev Address of the PolygonBridge on the source chain
    address public polygonBridgeAddress;

    /// @dev Maps source chain bridge ID to mirror status
    mapping(uint256 => bool) public mirroredBridgeIds;

    /// @dev Maps mirror record ID to details
    mapping(uint256 => MirrorRecord) public mirrorRecords;

    /// @dev Mirror record counter
    uint256 public mirrorCount;

    struct MirrorRecord {
        uint256 sourceBridgeId;   // Bridge ID on Polygon
        address owner;            // Asset owner
        bool isERC1155;           // True if ERC-1155
        string cardId;            // TCGDex card ID
        string variant;           // Print variant
        string username;          // Username (for ERC-721)
        string did;               // DID (for ERC-721)
        uint256 mirroredTokenId;  // Token ID on PulseChain
        uint256 amount;           // Amount mirrored
        uint256 timestamp;        // When the mirror was created
        bool reversed;            // Whether the mirror was reversed
    }

    // ============================================================
    // Events
    // ============================================================

    event AssetMirrored(
        uint256 indexed sourceBridgeId,
        uint256 indexed mirrorId,
        address indexed owner,
        bool isERC1155,
        string cardId,
        string variant,
        string username,
        string did,
        uint256 mirroredTokenId,
        uint256 amount,
        uint256 timestamp
    );

    event MirrorReversed(
        uint256 indexed mirrorId,
        uint256 timestamp
    );

    event ContractsUpdated(
        address cardNFT,
        address usernameNFT,
        address polygonBridge
    );

    // ============================================================
    // Constructor
    // ============================================================

    constructor(address admin) {
        require(admin != address(0), "Admin cannot be zero");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(RELAYER_ROLE, admin);
    }

    // ============================================================
    // Configuration
    // ============================================================

    function setContracts(
        address _cardNFTContract,
        address _usernameNFTContract,
        address _polygonBridgeAddress
    ) external onlyRole(ADMIN_ROLE) {
        cardNFTContract = _cardNFTContract;
        usernameNFTContract = _usernameNFTContract;
        polygonBridgeAddress = _polygonBridgeAddress;
        emit ContractsUpdated(_cardNFTContract, _usernameNFTContract, _polygonBridgeAddress);
    }

    // ============================================================
    // Mirror: ERC-1155 (Card NFTs)
    // ============================================================

    /**
     * @notice Mirrors a bridged card NFT from Polygon.
     *         Called by the relayer after detecting a bridge event.
     */
    function mirrorCard(
        uint256 sourceBridgeId,
        address owner,
        string calldata cardId,
        string calldata variant,
        uint256 amount
    ) external onlyRole(RELAYER_ROLE) whenNotPaused {
        require(cardNFTContract != address(0), "Card NFT not configured");
        require(owner != address(0), "Owner cannot be zero");
        require(amount > 0, "Amount must be > 0");
        require(!mirroredBridgeIds[sourceBridgeId], "Already mirrored");

        mirroredBridgeIds[sourceBridgeId] = true;

        // Mint the mirrored asset
        ICardNFT(cardNFTContract).bridgeMint(owner, cardId, variant, amount);

        uint256 mirrorId = mirrorCount++;
        mirrorRecords[mirrorId] = MirrorRecord({
            sourceBridgeId: sourceBridgeId,
            owner: owner,
            isERC1155: true,
            cardId: cardId,
            variant: variant,
            username: "",
            did: "",
            mirroredTokenId: 0, // Derived inside the NFT contract
            amount: amount,
            timestamp: block.timestamp,
            reversed: false
        });

        emit AssetMirrored(
            sourceBridgeId,
            mirrorId,
            owner,
            true,
            cardId,
            variant,
            "",
            "",
            0,
            amount,
            block.timestamp
        );
    }

    // ============================================================
    // Mirror: ERC-721 (Usernames)
    // ============================================================

    /**
     * @notice Mirrors a bridged username NFT from Polygon.
     */
    function mirrorUsername(
        uint256 sourceBridgeId,
        address owner,
        string calldata username,
        string calldata did,
        uint256 originalTokenId
    ) external onlyRole(RELAYER_ROLE) whenNotPaused returns (uint256) {
        require(usernameNFTContract != address(0), "Username NFT not configured");
        require(owner != address(0), "Owner cannot be zero");
        require(!mirroredBridgeIds[sourceBridgeId], "Already mirrored");

        mirroredBridgeIds[sourceBridgeId] = true;

        // Mint the mirrored username
        uint256 newTokenId = IUsernameNFT(usernameNFTContract).bridgeMint(
            owner,
            username,
            did,
            originalTokenId
        );

        uint256 mirrorId = mirrorCount++;
        mirrorRecords[mirrorId] = MirrorRecord({
            sourceBridgeId: sourceBridgeId,
            owner: owner,
            isERC1155: false,
            cardId: "",
            variant: "",
            username: username,
            did: did,
            mirroredTokenId: newTokenId,
            amount: 1,
            timestamp: block.timestamp,
            reversed: false
        });

        emit AssetMirrored(
            sourceBridgeId,
            mirrorId,
            owner,
            false,
            "",
            "",
            username,
            did,
            newTokenId,
            1,
            block.timestamp
        );

        return mirrorId;
    }

    // ============================================================
    // Reverse Mirror (Unbridge)
    // ============================================================

    /**
     * @notice Reverses a mirror (burns the mirrored asset).
     *         Called when a user unbridges (returns asset to Polygon).
     */
    function reverseMirror(uint256 mirrorId) external onlyRole(RELAYER_ROLE) whenNotPaused {
        MirrorRecord storage record = mirrorRecords[mirrorId];
        require(!record.reversed, "Already reversed");
        require(record.owner != address(0), "Invalid mirror record");

        if (record.isERC1155) {
            ICardNFT(cardNFTContract).bridgeBurn(
                record.owner,
                record.cardId,
                record.variant,
                record.amount
            );
        } else {
            IUsernameNFT(usernameNFTContract).bridgeBurn(record.mirroredTokenId);
        }

        record.reversed = true;
        mirroredBridgeIds[record.sourceBridgeId] = false;

        emit MirrorReversed(mirrorId, block.timestamp);
    }

    // ============================================================
    // View Functions
    // ============================================================

    function isMirrored(uint256 sourceBridgeId) external view returns (bool) {
        return mirroredBridgeIds[sourceBridgeId];
    }

    function getMirrorRecord(uint256 mirrorId) external view returns (MirrorRecord memory) {
        return mirrorRecords[mirrorId];
    }

    // ============================================================
    // Admin Functions
    // ============================================================

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    function grantRelayerRole(address relayer) external onlyRole(ADMIN_ROLE) {
        _grantRole(RELAYER_ROLE, relayer);
    }

    function revokeRelayerRole(address relayer) external onlyRole(ADMIN_ROLE) {
        _revokeRole(RELAYER_ROLE, relayer);
    }

    // ============================================================
    // Overrides
    // ============================================================

    function supportsInterface(bytes4 interfaceId)
        public view override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}