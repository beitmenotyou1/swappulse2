// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title SwapPulseCardNFTV2
 * @author SwapPulse / Michael Burgess
 * @notice ERC-1155 contract for minting Pokemon TCG cards as NFTs.
 *         Each card variant (normal, holo, reverse, firstEdition) is
 *         represented by a unique token ID, with metadata served
 *         dynamically from the SwapPulse API.
 *
 * Token ID Encoding:
 *   tokenId = uint256(keccak256(cardId, variant))
 *   This ensures uniqueness across all cards and variants while keeping
 *   the ID deterministic (same card + variant = same ID on any chain).
 *
 * Features:
 * - Mint single or batch cards
 * - Variant support (normal, holo, reverse, firstEdition, wPromo)
 * - Dynamic metadata URI pointing to /card-metadata-localized endpoint
 * - Bridge minting and bridge burning for dual-chain mirroring
 * - Supply tracking per token ID
 * - Admin-controlled minting and pausing
 *
 * @dev Uses OpenZeppelin v5 ERC-1155 with Pausable, AccessControl.
 *      Pre-compiled bytecode is stored in base44/shared/polygonCompiledArtifacts.ts
 *      and base44/shared/pulseCompiledArtifacts.ts for Base44 deployment.
 */

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract SwapPulseCardNFTV2 is ERC1155, Pausable, AccessControl {
    using Strings for uint256;

    // ============================================================
    // Roles
    // ============================================================

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");

    // ============================================================
    // Storage
    // ============================================================

    /// @dev Maps token ID to total supply minted
    mapping(uint256 => uint256) private _tokenSupply;

    /// @dev Maps token ID to TCGDex card ID (for verification)
    mapping(uint256 => string) private _tokenIdToCardId;

    /// @dev Maps TCGDex card ID + variant hash to token ID
    mapping(bytes32 => uint256) private _cardVariantToTokenId;

    /// @dev Maps token ID to variant name
    mapping(uint256 => string) private _tokenIdToVariant;

    /// @dev Base metadata URI (SwapPulse API endpoint)
    string private _baseMetadataURI;

    // ============================================================
    // Events
    // ============================================================

    event CardMinted(
        uint256 indexed tokenId,
        address indexed to,
        string cardId,
        string variant,
        uint256 amount,
        uint256 timestamp
    );

    event CardBatchMinted(
        address indexed to,
        uint256[] tokenIds,
        uint256[] amounts,
        uint256 timestamp
    );

    event MetadataURIUpdated(string newURI);

    // ============================================================
    // Constructor
    // ============================================================

    constructor(
        address admin,
        string memory baseMetadataURI_
    ) ERC1155("") {
        require(admin != address(0), "Admin cannot be zero address");
        require(bytes(baseMetadataURI_).length > 0, "Base URI cannot be empty");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);

        _baseMetadataURI = baseMetadataURI_;
    }

    // ============================================================
    // Token ID Derivation
    // ============================================================

    /**
     * @notice Derives a deterministic token ID from a card ID and variant.
     *         Same card+variant = same ID on any chain, enabling trustless bridging.
     */
    function deriveTokenId(
        string calldata cardId,
        string calldata variant
    ) public pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(cardId, variant)));
    }

    // ============================================================
    // Minting
    // ============================================================

    /**
     * @notice Mints a card NFT.
     * @param to Recipient address
     * @param cardId TCGDex card ID (e.g., "swsh3-136")
     * @param variant Print variant (e.g., "normal", "holo")
     * @param amount Number of copies to mint
     */
    function mintCard(
        address to,
        string calldata cardId,
        string calldata variant,
        uint256 amount
    ) external onlyRole(MINTER_ROLE) whenNotPaused {
        require(bytes(cardId).length > 0, "Card ID cannot be empty");
        require(bytes(variant).length > 0, "Variant cannot be empty");
        require(amount > 0 && amount <= 10000, "Amount must be 1-10000");

        uint256 tokenId = deriveTokenId(cardId, variant);

        if (_tokenSupply[tokenId] == 0) {
            _tokenIdToCardId[tokenId] = cardId;
            _tokenIdToVariant[tokenId] = variant;
            _cardVariantToTokenId[keccak256(abi.encodePacked(cardId, variant))] = tokenId;
        }

        _mint(to, tokenId, amount, "");
        _tokenSupply[tokenId] += amount;

        emit CardMinted(tokenId, to, cardId, variant, amount, block.timestamp);
    }

    /**
     * @notice Batch mints multiple card variants.
     */
    function mintCardBatch(
        address to,
        string[] calldata cardIds,
        string[] calldata variants,
        uint256[] calldata amounts
    ) external onlyRole(MINTER_ROLE) whenNotPaused {
        require(
            cardIds.length == variants.length && cardIds.length == amounts.length,
            "Array length mismatch"
        );
        require(cardIds.length > 0 && cardIds.length <= 100, "Batch size must be 1-100");

        uint256[] memory tokenIds = new uint256[](cardIds.length);

        for (uint256 i = 0; i < cardIds.length; i++) {
            require(amounts[i] > 0 && amounts[i] <= 10000, "Amount must be 1-10000");

            uint256 tokenId = deriveTokenId(cardIds[i], variants[i]);

            if (_tokenSupply[tokenId] == 0) {
                _tokenIdToCardId[tokenId] = cardIds[i];
                _tokenIdToVariant[tokenId] = variants[i];
                _cardVariantToTokenId[keccak256(abi.encodePacked(cardIds[i], variants[i]))] = tokenId;
            }

            tokenIds[i] = tokenId;
            _tokenSupply[tokenId] += amounts[i];
        }

        _mintBatch(to, tokenIds, amounts, "");

        emit CardBatchMinted(to, tokenIds, amounts, block.timestamp);
    }

    /**
     * @notice Bridge mint: mints a mirrored card on PulseChain.
     *         Only callable by the bridge contract.
     */
    function bridgeMint(
        address to,
        string calldata cardId,
        string calldata variant,
        uint256 amount
    ) external onlyRole(BRIDGE_ROLE) whenNotPaused {
        require(amount > 0, "Amount must be > 0");

        uint256 tokenId = deriveTokenId(cardId, variant);

        if (_tokenSupply[tokenId] == 0) {
            _tokenIdToCardId[tokenId] = cardId;
            _tokenIdToVariant[tokenId] = variant;
            _cardVariantToTokenId[keccak256(abi.encodePacked(cardId, variant))] = tokenId;
        }

        _mint(to, tokenId, amount, "");
        _tokenSupply[tokenId] += amount;

        emit CardMinted(tokenId, to, cardId, variant, amount, block.timestamp);
    }

    // ============================================================
    // Bridge Burn (for unbridging)
    // ============================================================

    /**
     * @notice Burns bridged tokens (for unbridging flow).
     *         Only callable by the bridge contract.
     */
    function bridgeBurn(
        address from,
        string calldata cardId,
        string calldata variant,
        uint256 amount
    ) external onlyRole(BRIDGE_ROLE) whenNotPaused {
        require(amount > 0, "Amount must be > 0");

        uint256 tokenId = deriveTokenId(cardId, variant);
        require(balanceOf(from, tokenId) >= amount, "Insufficient balance");

        _burn(from, tokenId, amount);
        _tokenSupply[tokenId] -= amount;
    }

    // ============================================================
    // View Functions
    // ============================================================

    function getCardId(uint256 tokenId) external view returns (string memory) {
        return _tokenIdToCardId[tokenId];
    }

    function getVariant(uint256 tokenId) external view returns (string memory) {
        return _tokenIdToVariant[tokenId];
    }

    function getTokenSupply(uint256 tokenId) external view returns (uint256) {
        return _tokenSupply[tokenId];
    }

    function getTokenIdByCardAndVariant(
        string calldata cardId,
        string calldata variant
    ) external view returns (uint256) {
        bytes32 key = keccak256(abi.encodePacked(cardId, variant));
        uint256 tokenId = _cardVariantToTokenId[key];
        require(tokenId != 0, "Card+variant not found");
        return tokenId;
    }

    // ============================================================
    // Metadata URI
    // ============================================================

    /**
     * @notice Returns the metadata URI for a token.
     *         Points to the SwapPulse API's localised metadata endpoint:
     *         /functions/card-metadata-localized?cardId={cardId}&variant={variant}
     */
    function uri(uint256 tokenId) public view override returns (string memory) {
        string memory cardId = _tokenIdToCardId[tokenId];
        string memory variant = _tokenIdToVariant[tokenId];

        if (bytes(cardId).length == 0) {
            return _baseMetadataURI;
        }

        return string(
            abi.encodePacked(
                _baseMetadataURI,
                "?cardId=",
                cardId,
                "&variant=",
                variant
            )
        );
    }

    // ============================================================
    // Admin Functions
    // ============================================================

    function setBaseMetadataURI(string calldata newURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(bytes(newURI).length > 0, "URI cannot be empty");
        _baseMetadataURI = newURI;
        emit MetadataURIUpdated(newURI);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function grantBridgeRole(address bridge) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(BRIDGE_ROLE, bridge);
    }

    function revokeBridgeRole(address bridge) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(BRIDGE_ROLE, bridge);
    }

    // ============================================================
    // Overrides
    // ============================================================

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}