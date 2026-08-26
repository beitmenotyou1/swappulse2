// Pre-compiled SwapPulse PulseChain + bridge contract artifacts (ABI + bytecode).
//
// Generated from the Solidity sources in pulseContracts.ts via solc 0.8.x by
// scripts/compile-pulse.js. Embedded here so the deploy-pulse-contracts and
// deploy-polygon-bridge backend functions can deploy using ethers
// ContractFactory WITHOUT loading solc at runtime — the Base44 backend
// runtime blocks WebAssembly, which solc requires, so in-platform compilation
// is impossible.
//
// ┌──────────────────────────────────────────────────────────────────────┐
// │ BYTECODE IS EMPTY UNTIL YOU COMPILE LOCALLY.                          │
// │   npm install                                                         │
// │   node scripts/compile-pulse.js                                        │
// │ This file is then overwritten with real bytecode. The ABI below is     │
// │ already correct and used by pulseClient.ts for contract interaction.  │
// └──────────────────────────────────────────────────────────────────────┘

// Human-readable ABIs (ethers v6 format). Single source of truth — pulseClient.ts
// imports these for contract interaction, and the deploy functions use them with
// ethers.ContractFactory (which accepts human-readable ABI strings).

export const PULSE_USERNAME_ABI = [
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

export const PULSE_USERNAME_BYTECODE = '';

export const PULSE_CARD_ABI = [
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

export const PULSE_CARD_BYTECODE = '';

export const PULSE_BRIDGE_ABI = [
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

export const PULSE_BRIDGE_BYTECODE = '';

export const POLYGON_BRIDGE_ABI = [
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

export const POLYGON_BRIDGE_BYTECODE = '';