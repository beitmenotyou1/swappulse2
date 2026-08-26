#!/usr/bin/env node
/**
 * Local compile script for SwapPulse PulseChain + bridge contracts.
 *
 * The Base44 backend runtime blocks WebAssembly (solc), so contracts can't be
 * compiled in-platform. Run this script locally to compile the v2 contracts and
 * write the ABI + bytecode into base44/shared/pulseCompiledArtifacts.ts:
 *
 *   npm install
 *   node scripts/compile-pulse.js
 *
 * After it completes, commit the updated pulseCompiledArtifacts.ts. The deploy
 * functions (deploy-pulse-contracts, deploy-polygon-bridge) will then have real
 * bytecode to deploy with.
 *
 * Sources are duplicated here (Node can't import the .ts file). Keep them in
 * sync with base44/shared/pulseContracts.ts if you edit the contracts.
 */

const solc = require('solc');
const fs = require('fs');
const path = require('path');

const USERNAME_V2_SOURCE = `
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

    function transferFrom(address, address, uint256) public pure {
        revert("Soulbound: non-transferable");
    }

    function safeTransferFrom(address, address, uint256) public pure {
        revert("Soulbound: non-transferable");
    }
}
`;

const CARD_V2_SOURCE = `
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

const PULSE_BRIDGE_SOURCE = `
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

const POLYGON_BRIDGE_SOURCE = `
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

function compile(source, contractName) {
  const input = {
    language: 'Solidity',
    sources: { [contractName + '.sol']: { content: source } },
    settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  if (output.errors) {
    const errors = output.errors.filter((e) => e.severity === 'error');
    if (errors.length) throw new Error(errors.map((e) => e.message).join('\n'));
  }
  const contract = output.contracts[contractName + '.sol'][contractName];
  return { abi: contract.abi, bytecode: '0x' + contract.evm.bytecode.object };
}

// Human-readable ABI strings (kept in sync with pulseCompiledArtifacts.ts).
const PULSE_USERNAME_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function mint(address to, string handle, string did, string metadataURI, uint8 sourceChain) returns (uint256)',
  'function bridgeBurn(uint256 tokenId)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function getUsernameToken(uint256 tokenId) view returns (string handle, string did, string metadataURI)',
  'function resolveDID(string did) view returns (address)',
  'function resolveAddress(address owner) view returns (string)',
  'function getTokenIdByOwner(address owner) view returns (uint256)',
  'function hasUsername(address owner) view returns (bool)',
  'function admin() view returns (address)',
  'function bridgeContract() view returns (address)',
  'function mintingPaused() view returns (bool)',
  'function setBridgeContract(address bridge) external',
  'event Mint(address indexed to, uint256 indexed tokenId, string handle, string did, uint8 sourceChain)',
  'event BridgeBurn(address indexed owner, uint256 indexed tokenId)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
];

const PULSE_CARD_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function mint(address to, string cardId, string cardName, string cardImage, string metadataURI, uint8 verificationLevel, uint8 sourceChain) returns (uint256)',
  'function setBridgeMapping(uint256 sourceTokenId, uint256 pulsechainTokenId)',
  'function getBridgeMapping(uint256 sourceTokenId) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function balanceOf(address owner) view returns (uint256)',
  'function getCardToken(uint256 tokenId) view returns (string cardId, string cardName, string cardImage, string metadataURI, uint256 minterUsernameTokenId, uint8 verificationLevel, uint8 sourceChain)',
  'function transferFrom(address from, address to, uint256 tokenId)',
  'function safeTransferFrom(address from, address to, uint256 tokenId)',
  'function setMinterUsernameTokenId(uint256 tokenId, uint256 usernameTokenId)',
  'function admin() view returns (address)',
  'function usernameContract() view returns (address)',
  'function bridgeContract() view returns (address)',
  'function setBridgeContract(address bridge) external',
  'event Mint(address indexed to, uint256 indexed tokenId, string cardId, uint8 verificationLevel, uint8 sourceChain)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
];

const PULSE_BRIDGE_ABI = [
  'function admin() view returns (address)',
  'function spunContract() view returns (address)',
  'function spcdContract() view returns (address)',
  'function polygonBridgePeer() view returns (address)',
  'function processedSourceTxHashes(bytes32) view returns (bool)',
  'function lockedCards(uint256) view returns (bool)',
  'function setContracts(address spun, address spcd) external',
  'function setPolygonPeer(address peer) external',
  'function bridgeFromPolygon(address to, uint8 assetType, string handleOrCardId, string nameOrCardName, string didOrCardImage, string metadataURI, uint8 verificationLevel, bytes32 sourceTxHash) returns (uint256)',
  'function bridgeToPolygon(uint256 tokenId, uint8 assetType)',
  'function releaseLockedCard(uint256 tokenId, address to) external',
  'event BridgeMint(address indexed to, uint256 tokenId, uint8 assetType, bytes32 sourceTxHash)',
  'event BridgeBurn(uint256 tokenId, uint8 assetType, address indexed from)',
];

const POLYGON_BRIDGE_ABI = [
  'function admin() view returns (address)',
  'function spunContract() view returns (address)',
  'function spcdContract() view returns (address)',
  'function processedSourceTxHashes(bytes32) view returns (bool)',
  'function lockedCards(uint256) view returns (bool)',
  'function lockForBridge(uint256 tokenId, uint8 assetType)',
  'function mintFromPulseChain(address to, uint8 assetType, string handleOrCardId, string nameOrCardName, string didOrCardImage, string metadataURI, bytes32 sourceTxHash) returns (uint256)',
  'function releaseLockedCard(uint256 tokenId, address to) external',
  'event BridgeLock(uint256 indexed tokenId, uint8 assetType, address indexed from)',
  'event BridgeMint(address indexed to, uint256 tokenId, uint8 assetType, bytes32 sourceTxHash)',
];

function abiToTs(name, abi) {
  return `export const ${name} = ${JSON.stringify(abi, null, 2)};`;
}

function main() {
  console.log('Compiling SwapPulseUsernameV2…');
  const username = compile(USERNAME_V2_SOURCE, 'SwapPulseUsernameV2');
  console.log('Compiling SwapPulseCardNFTV2…');
  const card = compile(CARD_V2_SOURCE, 'SwapPulseCardNFTV2');
  console.log('Compiling PulseChainBridge…');
  const pulseBridge = compile(PULSE_BRIDGE_SOURCE, 'PulseChainBridge');
  console.log('Compiling PolygonBridge…');
  const polygonBridge = compile(POLYGON_BRIDGE_SOURCE, 'PolygonBridge');

  const file = `// Pre-compiled SwapPulse PulseChain + bridge contract artifacts (ABI + bytecode).
//
// AUTO-GENERATED by scripts/compile-pulse.js — do not edit by hand.
// Regenerate after changing contract sources in pulseContracts.ts:
//   node scripts/compile-pulse.js

${abiToTs('PULSE_USERNAME_ABI', PULSE_USERNAME_ABI)}
export const PULSE_USERNAME_BYTECODE = '${username.bytecode}';

${abiToTs('PULSE_CARD_ABI', PULSE_CARD_ABI)}
export const PULSE_CARD_BYTECODE = '${card.bytecode}';

${abiToTs('PULSE_BRIDGE_ABI', PULSE_BRIDGE_ABI)}
export const PULSE_BRIDGE_BYTECODE = '${pulseBridge.bytecode}';

${abiToTs('POLYGON_BRIDGE_ABI', POLYGON_BRIDGE_ABI)}
export const POLYGON_BRIDGE_BYTECODE = '${polygonBridge.bytecode}';
`;

  const outPath = path.join(__dirname, '..', 'base44', 'shared', 'pulseCompiledArtifacts.ts');
  fs.writeFileSync(outPath, file);
  console.log(`\n✓ Wrote ${outPath}`);
  console.log('\n════════════════════════════════════════════');
  console.log('  Compilation complete. Commit the updated file.');
  console.log('════════════════════════════════════════════');
}

main().catch((err) => {
  console.error('✗ Compilation failed:', err.message);
  process.exit(1);
});