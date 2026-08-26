// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title PolygonBridge
 * @author SwapPulse / Michael Burgess
 * @notice Locks NFT assets on Polygon and emits bridge events.
 *         A relayer service watches these events and triggers
 *         the corresponding mint on PulseChain.
 *
 * Bridge Flow:
 *   1. User calls bridgeToPulseChain() on Polygon
 *   2. Contract locks the NFT (transfers to this bridge contract)
 *   3. Contract emits Bridged event with all metadata
 *   4. Relayer detects event, calls PulseChainBridge.mirrorAsset()
 *   5. Asset is minted on PulseChain to the same user
 *
 * @dev Uses OpenZeppelin v5 IERC721Receiver, IERC1155Receiver, AccessControl, Pausable.
 *      Pre-compiled bytecode stored in base44/shared/polygonCompiledArtifacts.ts.
 */

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract PolygonBridge is
    IERC721Receiver,
    ERC1155Holder,
    AccessControl,
    Pausable
{
    // ============================================================
    // Roles
    // ============================================================

    bytes32 public constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    // ============================================================
    // Storage
    // ============================================================

    /// @dev Bridge transaction counter
    uint256 private _bridgeCounter;

    /// @dev Maps bridge ID to bridge record
    mapping(uint256 => BridgeRecord) public bridgeRecords;

    /// @dev Address of the SwapPulseCardNFTV2 contract
    address public cardNFTContract;

    /// @dev Address of the SwapPulseUsernameV2 contract
    address public usernameNFTContract;

    /// @dev Address of the PulseChainBridge on the destination chain
    address public pulseChainBridgeAddress;

    struct BridgeRecord {
        address tokenContract;  // Source NFT contract address
        address owner;          // Original owner
        uint256 tokenId;        // Token ID
        uint256 amount;         // Amount (1 for ERC-721, N for ERC-1155)
        bool isERC1155;         // True if ERC-1155, false if ERC-721
        string cardId;          // TCGDex card ID (for ERC-1155)
        string variant;         // Print variant (for ERC-1155)
        string username;        // Username (for ERC-721)
        string did;             // AT Protocol DID (for ERC-721)
        BridgeStatus status;   // Current status
        uint256 lockedAt;       // Timestamp of locking
        uint256 mirroredAt;     // Timestamp of mirror confirmation
    }

    enum BridgeStatus {
        Locked,        // Asset locked on Polygon, waiting for mirror
        Mirrored,      // Confirmed mirrored on PulseChain
        Released,      // Unbridged and returned to owner
        Cancelled      // Bridge cancelled (before mirroring)
    }

    // ============================================================
    // Events
    // ============================================================

    event AssetBridged(
        uint256 indexed bridgeId,
        address indexed owner,
        address tokenContract,
        uint256 tokenId,
        uint256 amount,
        bool isERC1155,
        string cardId,
        string variant,
        string username,
        string did,
        uint256 timestamp
    );

    event BridgeConfirmed(
        uint256 indexed bridgeId,
        uint256 timestamp
    );

    event BridgeReleased(
        uint256 indexed bridgeId,
        address indexed owner,
        uint256 timestamp
    );

    event BridgeCancelled(
        uint256 indexed bridgeId,
        uint256 timestamp
    );

    event ContractsUpdated(
        address cardNFT,
        address usernameNFT,
        address pulseChainBridge
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
        address _pulseChainBridgeAddress
    ) external onlyRole(ADMIN_ROLE) {
        cardNFTContract = _cardNFTContract;
        usernameNFTContract = _usernameNFTContract;
        pulseChainBridgeAddress = _pulseChainBridgeAddress;
        emit ContractsUpdated(_cardNFTContract, _usernameNFTContract, _pulseChainBridgeAddress);
    }

    // ============================================================
    // Bridge: ERC-1155 (Card NFTs)
    // ============================================================

    /**
     * @notice Bridges a card NFT to PulseChain.
     *         Locks the asset on Polygon and emits a bridge event.
     */
    function bridgeCardToPulseChain(
        uint256 tokenId,
        uint256 amount,
        string calldata cardId,
        string calldata variant
    ) external whenNotPaused returns (uint256) {
        require(cardNFTContract != address(0), "Card NFT not configured");
        require(amount > 0, "Amount must be > 0");
        require(
            IERC1155(cardNFTContract).balanceOf(msg.sender, tokenId) >= amount,
            "Insufficient balance"
        );

        // Lock the asset by transferring to this bridge contract
        IERC1155(cardNFTContract).safeTransferFrom(
            msg.sender,
            address(this),
            tokenId,
            amount,
            ""
        );

        uint256 bridgeId = _bridgeCounter++;

        bridgeRecords[bridgeId] = BridgeRecord({
            tokenContract: cardNFTContract,
            owner: msg.sender,
            tokenId: tokenId,
            amount: amount,
            isERC1155: true,
            cardId: cardId,
            variant: variant,
            username: "",
            did: "",
            status: BridgeStatus.Locked,
            lockedAt: block.timestamp,
            mirroredAt: 0
        });

        emit AssetBridged(
            bridgeId,
            msg.sender,
            cardNFTContract,
            tokenId,
            amount,
            true,
            cardId,
            variant,
            "",
            "",
            block.timestamp
        );

        return bridgeId;
    }

    // ============================================================
    // Bridge: ERC-721 (Usernames)
    // ============================================================

    /**
     * @notice Bridges a username NFT to PulseChain.
     */
    function bridgeUsernameToPulseChain(
        uint256 tokenId,
        string calldata username,
        string calldata did
    ) external whenNotPaused returns (uint256) {
        require(usernameNFTContract != address(0), "Username NFT not configured");
        require(
            IERC721(usernameNFTContract).ownerOf(tokenId) == msg.sender,
            "Not token owner"
        );

        // Lock the asset
        IERC721(usernameNFTContract).transferFrom(
            msg.sender,
            address(this),
            tokenId
        );

        uint256 bridgeId = _bridgeCounter++;

        bridgeRecords[bridgeId] = BridgeRecord({
            tokenContract: usernameNFTContract,
            owner: msg.sender,
            tokenId: tokenId,
            amount: 1,
            isERC1155: false,
            cardId: "",
            variant: "",
            username: username,
            did: did,
            status: BridgeStatus.Locked,
            lockedAt: block.timestamp,
            mirroredAt: 0
        });

        emit AssetBridged(
            bridgeId,
            msg.sender,
            usernameNFTContract,
            tokenId,
            1,
            false,
            "",
            "",
            username,
            did,
            block.timestamp
        );

        return bridgeId;
    }

    // ============================================================
    // Relayer: Confirm Mirror
    // ============================================================

    /**
     * @notice Confirms that an asset has been mirrored on PulseChain.
     *         Called by the relayer after observing the mint on PulseChain.
     */
    function confirmMirror(uint256 bridgeId) external onlyRole(RELAYER_ROLE) {
        BridgeRecord storage record = bridgeRecords[bridgeId];
        require(record.status == BridgeStatus.Locked, "Not in Locked state");

        record.status = BridgeStatus.Mirrored;
        record.mirroredAt = block.timestamp;

        emit BridgeConfirmed(bridgeId, block.timestamp);
    }

    // ============================================================
    // Unbridge: Return Assets
    // ============================================================

    /**
     * @notice Releases a locked asset back to the owner.
     *         Called during unbridging (asset burned on PulseChain first).
     */
    function releaseAsset(uint256 bridgeId) external whenNotPaused {
        BridgeRecord storage record = bridgeRecords[bridgeId];
        require(record.status == BridgeStatus.Mirrored, "Not in Mirrored state");
        require(record.owner == msg.sender, "Only owner can release");

        if (record.isERC1155) {
            IERC1155(record.tokenContract).safeTransferFrom(
                address(this),
                msg.sender,
                record.tokenId,
                record.amount,
                ""
            );
        } else {
            IERC721(record.tokenContract).transferFrom(
                address(this),
                msg.sender,
                record.tokenId
            );
        }

        record.status = BridgeStatus.Released;

        emit BridgeReleased(bridgeId, msg.sender, block.timestamp);
    }

    /**
     * @notice Cancels a bridge that hasn't been mirrored yet.
     *         Returns the asset to the owner.
     */
    function cancelBridge(uint256 bridgeId) external whenNotPaused {
        BridgeRecord storage record = bridgeRecords[bridgeId];
        require(record.status == BridgeStatus.Locked, "Can only cancel Locked bridges");
        require(
            record.owner == msg.sender || hasRole(ADMIN_ROLE, msg.sender),
            "Only owner or admin can cancel"
        );

        if (record.isERC1155) {
            IERC1155(record.tokenContract).safeTransferFrom(
                address(this),
                msg.sender,
                record.tokenId,
                record.amount,
                ""
            );
        } else {
            IERC721(record.tokenContract).transferFrom(
                address(this),
                msg.sender,
                record.tokenId
            );
        }

        record.status = BridgeStatus.Cancelled;

        emit BridgeCancelled(bridgeId, block.timestamp);
    }

    // ============================================================
    // View Functions
    // ============================================================

    function getBridgeRecord(uint256 bridgeId) external view returns (BridgeRecord memory) {
        return bridgeRecords[bridgeId];
    }

    function getTotalBridges() external view returns (uint256) {
        return _bridgeCounter;
    }

    function getPendingBridges() external view returns (uint256[] memory) {
        uint256 total = _bridgeCounter;
        uint256 count = 0;

        for (uint256 i = 0; i < total; i++) {
            if (bridgeRecords[i].status == BridgeStatus.Locked) {
                count++;
            }
        }

        uint256[] memory pending = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < total; i++) {
            if (bridgeRecords[i].status == BridgeStatus.Locked) {
                pending[idx++] = i;
            }
        }

        return pending;
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
    // ERC-721 Receiver
    // ============================================================

    function onERC721Received(
        address /* operator */,
        address /* from */,
        uint256 /* tokenId */,
        bytes calldata /* data */
    ) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    // ============================================================
    // Overrides
    // ============================================================

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC1155Holder, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}