// Solidity v2 contract sources for SwapPulse's PulseChain NFT layer + bridge.
//
// These are the canonical source strings, version-controlled here for
// reference. They are compiled LOCALLY by scripts/compile-pulse.js (the Base44
// backend runtime blocks WebAssembly, so solc cannot run in-platform) and the
// resulting ABI + bytecode are written to pulseCompiledArtifacts.ts, which the
// deploy-pulse-contracts / deploy-polygon-bridge backend functions import.
//
// v2 differences from the v1 Polygon contracts (polygonContracts.ts):
//   - mint() accepts a `sourceChain` uint8 (0 = native, 1 = bridged from peer)
//   - a `bridgeContract` address is set post-deploy; the bridge is the only
//     caller allowed to mint with sourceChain=1 (or burn for soulbound returns)
//   - SwapPulseCardNFTV2 stores verificationLevel + sourceChain per token
//   - PulseChainBridge + PolygonBridge handle the cross-chain relay with
//     idempotency via a bytes32 sourceTxHash

// SwapPulseUsernameV2 — soulbound (non-transferable) ERC-721 that embeds the
// collector's SwapPulse handle and AT Protocol DID. One token per wallet.
// sourceChain: 0 = native PulseChain mint (admin only), 1 = bridged from
// Polygon (bridge contract only).
export const USERNAME_V2_SOURCE = `
// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.20;

contract SwapPulseUsernameV2 {
    string public name = "SwapPulse Username V2";
    string public symbol = "SPUN";

    struct UsernameToken {
        string handle;
        string did;
        string metadataURI;
    }

    mapping(uint256 => address) private _owners;
    mapping(uint256 => UsernameToken) private _tokens;
    mapping(address => uint256) private _userTokenId;
    mapping(string => address) private _didToAddress;
    uint256 private _nextTokenId = 1;
    address public admin;
    address public bridgeContract;
    bool public mintingPaused;

    event Mint(address indexed to, uint256 indexed tokenId, string handle, string did, uint8 sourceChain);
    event BridgeBurn(address indexed owner, uint256 indexed tokenId);
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function setBridgeContract(address _bridge) external onlyAdmin {
        bridgeContract = _bridge;
    }

    function mint(address to, string calldata handle, string calldata did, string calldata metadataURI, uint8 sourceChain) external returns (uint256) {
        if (sourceChain == 0) {
            require(msg.sender == admin, "Only admin can mint natively");
        } else {
            require(msg.sender == bridgeContract, "Only bridge can mint mirrored");
        }
        require(!mintingPaused, "Minting paused");
        require(_userTokenId[to] == 0, "Already minted");

        uint256 tokenId = _nextTokenId++;
        _owners[tokenId] = to;
        _tokens[tokenId] = UsernameToken(handle, did, metadataURI);
        _userTokenId[to] = tokenId;
        _didToAddress[did] = to;

        emit Mint(to, tokenId, handle, did, sourceChain);
        emit Transfer(address(0), to, tokenId);
        return tokenId;
    }

    function bridgeBurn(uint256 tokenId) external {
        require(msg.sender == bridgeContract, "Only bridge");
        address owner = _owners[tokenId];
        require(owner != address(0), "No owner");
        _owners[tokenId] = address(0);
        _userTokenId[owner] = 0;
        emit BridgeBurn(owner, tokenId);
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "Nonexistent token");
        return owner;
    }

    function getUsernameToken(uint256 tokenId) external view returns (string memory handle, string memory did, string memory metadataURI) {
        UsernameToken memory t = _tokens[tokenId];
        return (t.handle, t.did, t.metadataURI);
    }

    function resolveDID(string calldata did) external view returns (address) {
        return _didToAddress[did];
    }

    function resolveAddress(address owner) external view returns (string memory) {
        uint256 tokenId = _userTokenId[owner];
        return _tokens[tokenId].did;
    }

    function getTokenIdByOwner(address owner) external view returns (uint256) {
        return _userTokenId[owner];
    }

    function hasUsername(address owner) external view returns (bool) {
        return _userTokenId[owner] != 0;
    }

    // Soulbound: all transfers revert
    function transferFrom(address, address, uint256) public pure {
        revert("Soulbound: non-transferable");
    }

    function safeTransferFrom(address, address, uint256) public pure {
        revert("Soulbound: non-transferable");
    }
}
`;

// SwapPulseCardNFTV2 — transferable ERC-721 that references TCGDex card data.
// Stores verificationLevel (0-3 trust tier) and sourceChain per token. Mint is
// callable by admin (native) or the bridge contract (mirrored from Polygon).
export const CARD_V2_SOURCE = `
// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.20;

contract SwapPulseCardNFTV2 {
    string public name = "SwapPulse Card V2";
    string public symbol = "SPCD";

    struct CardToken {
        string cardId;
        string cardName;
        string cardImage;
        string metadataURI;
        uint256 minterUsernameTokenId;
        uint8 verificationLevel;
        uint8 sourceChain;
    }

    mapping(uint256 => address) private _owners;
    mapping(uint256 => CardToken) private _tokens;
    mapping(address => uint256) private _balances;
    mapping(uint256 => uint256) private _bridgeMappings;
    uint256 private _nextTokenId = 1;
    address public admin;
    address public usernameContract;
    address public bridgeContract;

    event Mint(address indexed to, uint256 indexed tokenId, string cardId, uint8 verificationLevel, uint8 sourceChain);
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    constructor(address _usernameContract) {
        admin = msg.sender;
        usernameContract = _usernameContract;
    }

    function setBridgeContract(address _bridge) external onlyAdmin {
        bridgeContract = _bridge;
    }

    function mint(address to, string calldata cardId, string calldata cardName, string calldata cardImage, string calldata metadataURI, uint8 verificationLevel, uint8 sourceChain) external returns (uint256) {
        require(msg.sender == admin || msg.sender == bridgeContract, "Not authorised");
        uint256 tokenId = _nextTokenId++;
        _owners[tokenId] = to;
        _tokens[tokenId] = CardToken({
            cardId: cardId,
            cardName: cardName,
            cardImage: cardImage,
            metadataURI: metadataURI,
            minterUsernameTokenId: 0,
            verificationLevel: verificationLevel,
            sourceChain: sourceChain
        });
        _balances[to]++;
        emit Mint(to, tokenId, cardId, verificationLevel, sourceChain);
        emit Transfer(address(0), to, tokenId);
        return tokenId;
    }

    function setBridgeMapping(uint256 sourceTokenId, uint256 pulsechainTokenId) external {
        require(msg.sender == bridgeContract, "Only bridge");
        _bridgeMappings[sourceTokenId] = pulsechainTokenId;
    }

    function getBridgeMapping(uint256 sourceTokenId) external view returns (uint256) {
        return _bridgeMappings[sourceTokenId];
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "Nonexistent token");
        return owner;
    }

    function balanceOf(address owner) public view returns (uint256) {
        return _balances[owner];
    }

    function getCardToken(uint256 tokenId) external view returns (string memory cardId, string memory cardName, string memory cardImage, string memory metadataURI, uint256 minterUsernameTokenId, uint8 verificationLevel, uint8 sourceChain) {
        CardToken memory t = _tokens[tokenId];
        return (t.cardId, t.cardName, t.cardImage, t.metadataURI, t.minterUsernameTokenId, t.verificationLevel, t.sourceChain);
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        require(_owners[tokenId] == from, "Not owner");
        require(to != address(0), "Zero address");
        _owners[tokenId] = to;
        _balances[from]--;
        _balances[to]++;
        emit Transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) public {
        transferFrom(from, to, tokenId);
    }

    function setMinterUsernameTokenId(uint256 tokenId, uint256 usernameTokenId) external onlyAdmin {
        _tokens[tokenId].minterUsernameTokenId = usernameTokenId;
    }
}
`;

// PulseChainBridge — deployed on PulseChain. Receives mints relayed from
// Polygon (bridgeFromPolygon) and burns/locks tokens bridging back to Polygon
// (bridgeToPolygon). Idempotent via processedSourceTxHashes.
export const PULSE_BRIDGE_SOURCE = `
// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.20;

interface ISwapPulseUsernameV2 {
    function mint(address to, string calldata handle, string calldata did, string calldata metadataURI, uint8 sourceChain) external returns (uint256);
    function bridgeBurn(uint256 tokenId) external;
}

interface ISwapPulseCardNFTV2 {
    function mint(address to, string calldata cardId, string calldata cardName, string calldata cardImage, string calldata metadataURI, uint8 verificationLevel, uint8 sourceChain) external returns (uint256);
    function transferFrom(address from, address to, uint256 tokenId) external;
}

contract PulseChainBridge {
    address public admin;
    address public spunContract;
    address public spcdContract;
    address public polygonBridgePeer;

    mapping(bytes32 => bool) public processedSourceTxHashes;
    mapping(uint256 => bool) public lockedCards;

    event BridgeMint(address indexed to, uint256 tokenId, uint8 assetType, bytes32 sourceTxHash);
    event BridgeBurn(uint256 tokenId, uint8 assetType, address indexed from);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function setContracts(address _spun, address _spcd) external onlyAdmin {
        spunContract = _spun;
        spcdContract = _spcd;
    }

    function setPolygonPeer(address _peer) external onlyAdmin {
        polygonBridgePeer = _peer;
    }

    function bridgeFromPolygon(
        address to,
        uint8 assetType,
        string calldata handleOrCardId,
        string calldata nameOrCardName,
        string calldata didOrCardImage,
        string calldata metadataURI,
        uint8 verificationLevel,
        bytes32 sourceTxHash
    ) external onlyAdmin returns (uint256) {
        require(!processedSourceTxHashes[sourceTxHash], "Already bridged");
        processedSourceTxHashes[sourceTxHash] = true;

        uint256 tokenId;
        if (assetType == 0) {
            tokenId = ISwapPulseUsernameV2(spunContract).mint(to, handleOrCardId, didOrCardImage, metadataURI, 1);
        } else {
            tokenId = ISwapPulseCardNFTV2(spcdContract).mint(to, handleOrCardId, nameOrCardName, didOrCardImage, metadataURI, verificationLevel, 1);
        }

        emit BridgeMint(to, tokenId, assetType, sourceTxHash);
        return tokenId;
    }

    function bridgeToPolygon(uint256 tokenId, uint8 assetType) external {
        if (assetType == 0) {
            ISwapPulseUsernameV2(spunContract).bridgeBurn(tokenId);
        } else {
            ISwapPulseCardNFTV2(spcdContract).transferFrom(msg.sender, address(this), tokenId);
            lockedCards[tokenId] = true;
        }
        emit BridgeBurn(tokenId, assetType, msg.sender);
    }

    function releaseLockedCard(uint256 tokenId, address to) external onlyAdmin {
        require(lockedCards[tokenId], "Not locked");
        lockedCards[tokenId] = false;
        ISwapPulseCardNFTV2(spcdContract).transferFrom(address(this), to, tokenId);
    }
}
`;

// PolygonBridge — deployed on Polygon. Locks Polygon NFTs when bridging to
// PulseChain (lockForBridge) and mints Polygon NFTs when bridging back
// (mintFromPulseChain). Idempotent via processedSourceTxHashes.
export const POLYGON_BRIDGE_SOURCE = `
// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.20;

interface ISwapPulseUsername {
    function mint(address to, string calldata handle, string calldata did, string calldata metadataURI) external returns (uint256);
}

interface ISwapPulseCardNFT {
    function mint(address to, string calldata cardId, string calldata cardName, string calldata cardImage, string calldata metadataURI) external returns (uint256);
    function transferFrom(address from, address to, uint256 tokenId) external;
}

contract PolygonBridge {
    address public admin;
    address public spunContract;
    address public spcdContract;

    mapping(bytes32 => bool) public processedSourceTxHashes;
    mapping(uint256 => bool) public lockedCards;

    event BridgeLock(uint256 indexed tokenId, uint8 assetType, address indexed from);
    event BridgeMint(address indexed to, uint256 tokenId, uint8 assetType, bytes32 sourceTxHash);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    constructor(address _spun, address _spcd) {
        admin = msg.sender;
        spunContract = _spun;
        spcdContract = _spcd;
    }

    function lockForBridge(uint256 tokenId, uint8 assetType) external {
        if (assetType == 0) {
            require(msg.sender == admin, "Soulbound: admin only");
        } else {
            ISwapPulseCardNFT(spcdContract).transferFrom(msg.sender, address(this), tokenId);
            lockedCards[tokenId] = true;
        }
        emit BridgeLock(tokenId, assetType, msg.sender);
    }

    function mintFromPulseChain(
        address to,
        uint8 assetType,
        string calldata handleOrCardId,
        string calldata nameOrCardName,
        string calldata didOrCardImage,
        string calldata metadataURI,
        bytes32 sourceTxHash
    ) external onlyAdmin returns (uint256) {
        require(!processedSourceTxHashes[sourceTxHash], "Already bridged");
        processedSourceTxHashes[sourceTxHash] = true;

        uint256 tokenId;
        if (assetType == 0) {
            tokenId = ISwapPulseUsername(spunContract).mint(to, handleOrCardId, didOrCardImage, metadataURI);
        } else {
            tokenId = ISwapPulseCardNFT(spcdContract).mint(to, handleOrCardId, nameOrCardName, didOrCardImage, metadataURI);
        }

        emit BridgeMint(to, tokenId, assetType, sourceTxHash);
        return tokenId;
    }

    function releaseLockedCard(uint256 tokenId, address to) external onlyAdmin {
        require(lockedCards[tokenId], "Not locked");
        lockedCards[tokenId] = false;
        ISwapPulseCardNFT(spcdContract).transferFrom(address(this), to, tokenId);
    }
}
`;

// PulseGaslessRelay — gas-less meta-transaction relay for PulseChain. Users
// sign an EIP-712 typed message authorizing a call to a target contract; the
// treasury relayer (admin) submits and pays the native PLS gas. Nonce replay
// protection per user; chain-id-bound domain separator. Used for gasless
// $PULSE transfers (target = PulseToken transferFrom, relay approved by the
// user). NFT mints remain treasury-paid (the treasury is already the admin of
// the NFT contracts), so they are already gasless for the user.
export const PULSE_GASLESS_RELAY_SOURCE = `
// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.20;

contract PulseGaslessRelay {
    address public admin;
    mapping(address => uint256) public nonces;

    bytes32 private constant META_TX_TYPEHASH = keccak256(
        "MetaTx(address user,address target,uint256 nonce,bytes data)"
    );
    bytes32 private constant EIP712_DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

    bytes32 private immutable _domainSeparator;
    string public constant NAME = "SwapPulse Gasless Relay";
    string public constant VERSION = "1";

    event Executed(address indexed user, address indexed target, uint256 nonce);
    event AdminChanged(address oldAdmin, address newAdmin);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    constructor() {
        admin = msg.sender;
        uint256 chainId;
        assembly { chainId := chainid() }
        _domainSeparator = keccak256(abi.encode(
            EIP712_DOMAIN_TYPEHASH,
            keccak256(bytes(NAME)),
            keccak256(bytes(VERSION)),
            chainId,
            address(this)
        ));
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparator;
    }

    function _hash(address user, address target, uint256 nonce, bytes memory data) internal view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(
            META_TX_TYPEHASH,
            user,
            target,
            nonce,
            keccak256(data)
        ));
        return keccak256(abi.encodePacked("\\x19\\x01", _domainSeparator, structHash));
    }

    function execute(
        address user,
        address target,
        bytes calldata data,
        uint256 nonce,
        bytes calldata signature
    ) external onlyAdmin returns (bytes memory) {
        require(data.length > 0, "Empty data");
        require(nonce == nonces[user], "Invalid nonce");

        bytes32 digest = _hash(user, target, nonce, data);
        address recovered = _recover(digest, signature);
        require(recovered == user, "Invalid signature");

        nonces[user] = nonce + 1;
        (bool ok, bytes memory ret) = target.call(data);
        require(ok, "Target call failed");
        emit Executed(user, target, nonce);
        return ret;
    }

    function _recover(bytes32 digest, bytes calldata sig) internal pure returns (address) {
        if (sig.length != 65) revert("Bad signature length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (v < 27) v += 27;
        return ecrecover(digest, v, r, s);
    }

    function setAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Zero address");
        emit AdminChanged(admin, newAdmin);
        admin = newAdmin;
    }
}
`;