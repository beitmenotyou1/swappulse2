// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title SwapPulseUsernameV2
 * @author SwapPulse / Michael Burgess
 * @notice ERC-721 contract for minting usernames as on-chain NFTs.
 *         Each username is unique, stored as a token, and linked to
 *         an AT Protocol DID for self-sovereign identity.
 *
 * Features:
 * - Unique username registration (string -> tokenId mapping)
 * - DID association for each username NFT
 * - Trust score anchoring (score stored on-chain, computed off-chain)
 * - Admin-controlled minting (platform or bridge contract)
 * - Metadata URI pointing to Base44 API for dynamic localisation
 * - Pause/unpause for emergency stops
 * - Bridge burn for unbridging flow
 *
 * @dev Uses OpenZeppelin v5 ERC-721 with URIStorage, Pausable, AccessControl.
 *      Pre-compiled bytecode is stored in base44/shared/pulseCompiledArtifacts.ts
 *      and base44/shared/polygonCompiledArtifacts.ts for Base44 deployment.
 */

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract SwapPulseUsernameV2 is ERC721URIStorage, Pausable, AccessControl {
    // ============================================================
    // Roles
    // ============================================================

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");

    // ============================================================
    // Storage
    // ============================================================

    /// @dev Token ID counter
    uint256 private _nextTokenId;

    /// @dev Maps username (lowercase) to token ID
    mapping(string => uint256) private _usernameToTokenId;

    /// @dev Maps token ID to username (original case preserved)
    mapping(uint256 => string) private _tokenIdToUsername;

    /// @dev Maps token ID to AT Protocol DID
    mapping(uint256 => string) private _tokenIdToDID;

    /// @dev Maps token ID to trust score (0-100, computed off-chain)
    mapping(uint256 => uint8) private _trustScores;

    /// @dev Maps DID to token ID (reverse lookup for quick verification)
    mapping(string => uint256) private _didToTokenId;

    /// @dev Base metadata URI (pointing to SwapPulse API)
    string private _baseMetadataURI;

    // ============================================================
    // Events
    // ============================================================

    event UsernameMinted(
        uint256 indexed tokenId,
        address indexed owner,
        string username,
        string did,
        uint256 timestamp
    );

    event TrustScoreUpdated(
        uint256 indexed tokenId,
        uint8 oldScore,
        uint8 newScore,
        uint256 timestamp
    );

    event DIDUpdated(
        uint256 indexed tokenId,
        string oldDID,
        string newDID
    );

    event MetadataURIUpdated(string newURI);

    // ============================================================
    // Constructor
    // ============================================================

    constructor(
        address admin,
        string memory baseMetadataURI_
    ) ERC721("SwapPulse Username", "SPUN") {
        require(admin != address(0), "Admin cannot be zero address");
        require(bytes(baseMetadataURI_).length > 0, "Base URI cannot be empty");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);

        _baseMetadataURI = baseMetadataURI_;
    }

    // ============================================================
    // Modifiers
    // ============================================================

    modifier onlyExistingToken(uint256 tokenId) {
        require(_exists(tokenId), "Token does not exist");
        _;
    }

    // ============================================================
    // Minting
    // ============================================================

    /**
     * @notice Mints a new username NFT.
     * @param to The address receiving the username NFT
     * @param username The username string (must be unique)
     * @param did The AT Protocol DID associated with this username
     * @return tokenId The ID of the newly minted token
     */
    function mintUsername(
        address to,
        string calldata username,
        string calldata did
    ) external onlyRole(MINTER_ROLE) whenNotPaused returns (uint256) {
        require(bytes(username).length >= 3, "Username too short (min 3 chars)");
        require(bytes(username).length <= 32, "Username too long (max 32 chars)");
        require(bytes(did).length > 0, "DID cannot be empty");
        require(!_usernameExists(username), "Username already taken");

        uint256 tokenId = _nextTokenId++;

        _safeMint(to, tokenId);

        // Store mappings
        _usernameToTokenId[_toLower(username)] = tokenId;
        _tokenIdToUsername[tokenId] = username;
        _tokenIdToDID[tokenId] = did;
        _didToTokenId[did] = tokenId;

        // Set metadata URI
        _setTokenURI(tokenId, string(abi.encodePacked(_baseMetadataURI, "/", _uintToString(tokenId))));

        emit UsernameMinted(tokenId, to, username, did, block.timestamp);

        return tokenId;
    }

    /**
     * @notice Bridge mint: mints a mirrored username on PulseChain.
     *         Only callable by the bridge contract.
     */
    function bridgeMint(
        address to,
        string calldata username,
        string calldata did,
        uint256 /* originalTokenId */
    ) external onlyRole(BRIDGE_ROLE) whenNotPaused returns (uint256) {
        require(!_usernameExists(username), "Username already exists on this chain");

        uint256 tokenId = _nextTokenId++;

        _safeMint(to, tokenId);

        _usernameToTokenId[_toLower(username)] = tokenId;
        _tokenIdToUsername[tokenId] = username;
        _tokenIdToDID[tokenId] = did;
        _didToTokenId[did] = tokenId;

        _setTokenURI(tokenId, string(abi.encodePacked(_baseMetadataURI, "/", _uintToString(tokenId))));

        emit UsernameMinted(tokenId, to, username, did, block.timestamp);

        return tokenId;
    }

    // ============================================================
    // Bridge Burn (for unbridging)
    // ============================================================

    /**
     * @notice Burns a bridged username token (for unbridging flow).
     *         Only callable by the bridge contract.
     * @param tokenId The token ID to burn
     */
    function bridgeBurn(uint256 tokenId) external onlyRole(BRIDGE_ROLE) whenNotPaused onlyExistingToken(tokenId) {
        _burn(tokenId);

        // Clean up mappings
        string memory username = _tokenIdToUsername[tokenId];
        string memory did = _tokenIdToDID[tokenId];

        delete _usernameToTokenId[_toLower(username)];
        delete _tokenIdToUsername[tokenId];
        delete _tokenIdToDID[tokenId];
        delete _didToTokenId[did];
        delete _trustScores[tokenId];
    }

    // ============================================================
    // Trust Score
    // ============================================================

    /**
     * @notice Updates the trust score for a username NFT.
     *         Trust score is computed off-chain using the vouch-based
     *         trust graph algorithm (weighted PageRank).
     */
    function updateTrustScore(
        uint256 tokenId,
        uint8 newScore
    ) external onlyRole(MINTER_ROLE) onlyExistingToken(tokenId) {
        require(newScore <= 100, "Score must be 0-100");

        uint8 oldScore = _trustScores[tokenId];
        _trustScores[tokenId] = newScore;

        emit TrustScoreUpdated(tokenId, oldScore, newScore, block.timestamp);
    }

    // ============================================================
    // DID Management
    // ============================================================

    /**
     * @notice Updates the DID associated with a username NFT.
     *         Called when a user rotates their AT Protocol keys.
     */
    function updateDID(
        uint256 tokenId,
        string calldata newDID
    ) external onlyRole(MINTER_ROLE) onlyExistingToken(tokenId) {
        require(bytes(newDID).length > 0, "New DID cannot be empty");

        string memory oldDID = _tokenIdToDID[tokenId];
        _tokenIdToDID[tokenId] = newDID;
        _didToTokenId[newDID] = tokenId;

        emit DIDUpdated(tokenId, oldDID, newDID);
    }

    // ============================================================
    // View Functions
    // ============================================================

    function getUsername(uint256 tokenId) external view onlyExistingToken(tokenId) returns (string memory) {
        return _tokenIdToUsername[tokenId];
    }

    function getDID(uint256 tokenId) external view onlyExistingToken(tokenId) returns (string memory) {
        return _tokenIdToDID[tokenId];
    }

    function getTrustScore(uint256 tokenId) external view onlyExistingToken(tokenId) returns (uint8) {
        return _trustScores[tokenId];
    }

    function getTokenIdByUsername(string calldata username) external view returns (uint256) {
        uint256 tokenId = _usernameToTokenId[_toLower(username)];
        require(tokenId != 0, "Username not found");
        return tokenId;
    }

    function getTokenIdByDID(string calldata did) external view returns (uint256) {
        uint256 tokenId = _didToTokenId[did];
        require(tokenId != 0, "DID not found");
        return tokenId;
    }

    function usernameExists(string calldata username) external view returns (bool) {
        return _usernameExists(username);
    }

    function totalSupply() external view returns (uint256) {
        return _nextTokenId;
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
    // Internal Helpers
    // ============================================================

    function _usernameExists(string memory username) internal view returns (bool) {
        return _usernameToTokenId[_toLower(username)] != 0;
    }

    function _toLower(string memory str) internal pure returns (string memory) {
        bytes memory bStr = bytes(str);
        bytes memory bLower = new bytes(bStr.length);
        for (uint256 i = 0; i < bStr.length; i++) {
            if (bStr[i] >= 0x41 && bStr[i] <= 0x5A) {
                bLower[i] = bytes1(uint8(bStr[i]) + 32);
            } else {
                bLower[i] = bStr[i];
            }
        }
        return string(bLower);
    }

    function _uintToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseMetadataURI;
    }

    // ============================================================
    // Overrides
    // ============================================================

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, ERC721URIStorage, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}