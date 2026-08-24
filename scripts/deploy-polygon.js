#!/usr/bin/env node
/**
 * Local deployment script for SwapPulse Polygon NFT contracts.
 *
 * The Base44 backend runtime blocks WebAssembly (solc), so contracts can't
 * be compiled in-platform. Run this script locally to compile and deploy,
 * then paste the output addresses into your app secrets:
 *
 *   POLYGON_USERNAME_CONTRACT  →  username contract address
 *   POLYGON_CARD_CONTRACT      →  card contract address
 *
 * Usage:
 *   npm install
 *   POLYGON_RPC_URL="https://polygon-rpc.com/…" \
 *   POLYGON_PRIVATE_KEY="0x…" \
 *   node scripts/deploy-polygon.js
 *
 * (Or set them in a .env file — the script reads process.env.)
 */

const solc = require('solc');
const { ethers } = require('ethers');

const USERNAME_SOURCE = `
// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.20;

contract SwapPulseUsername {
    string public name = "SwapPulse Username";
    string public symbol = "SPUN";

    struct UsernameToken {
        string handle;
        string did;
        string metadataURI;
    }

    mapping(uint256 => address) private _owners;
    mapping(uint256 => UsernameToken) private _tokens;
    mapping(address => uint256) private _userTokenId;
    uint256 private _nextTokenId = 1;
    address public admin;

    event Mint(address indexed to, uint256 indexed tokenId, string handle, string did);
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function mint(address to, string calldata handle, string calldata did, string calldata metadataURI) external onlyAdmin returns (uint256) {
        require(_userTokenId[to] == 0, "Already minted");
        uint256 tokenId = _nextTokenId++;
        _owners[tokenId] = to;
        _tokens[tokenId] = UsernameToken(handle, did, metadataURI);
        _userTokenId[to] = tokenId;
        emit Mint(to, tokenId, handle, did);
        emit Transfer(address(0), to, tokenId);
        return tokenId;
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

const CARD_SOURCE = `
// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.20;

contract SwapPulseCardNFT {
    string public name = "SwapPulse Card";
    string public symbol = "SPCD";

    struct CardToken {
        string cardId;
        string cardName;
        string cardImage;
        string metadataURI;
        uint256 minterUsernameTokenId;
    }

    mapping(uint256 => address) private _owners;
    mapping(uint256 => CardToken) private _tokens;
    mapping(address => uint256) private _balances;
    uint256 private _nextTokenId = 1;
    address public admin;
    address public usernameContract;

    event Mint(address indexed to, uint256 indexed tokenId, string cardId);
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    constructor(address _usernameContract) {
        admin = msg.sender;
        usernameContract = _usernameContract;
    }

    function mint(address to, string calldata cardId, string calldata cardName, string calldata cardImage, string calldata metadataURI) external onlyAdmin returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _owners[tokenId] = to;
        _tokens[tokenId] = CardToken(cardId, cardName, cardImage, metadataURI, 0);
        _balances[to]++;
        emit Mint(to, tokenId, cardId);
        emit Transfer(address(0), to, tokenId);
        return tokenId;
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "Nonexistent token");
        return owner;
    }

    function balanceOf(address owner) public view returns (uint256) {
        return _balances[owner];
    }

    function getCardToken(uint256 tokenId) external view returns (string memory cardId, string memory cardName, string memory cardImage, string memory metadataURI, uint256 minterUsernameTokenId) {
        CardToken memory t = _tokens[tokenId];
        return (t.cardId, t.cardName, t.cardImage, t.metadataURI, t.minterUsernameTokenId);
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

async function main() {
  const rpcUrl = process.env.POLYGON_RPC_URL;
  const privateKey = process.env.POLYGON_PRIVATE_KEY;
  if (!rpcUrl || !privateKey) {
    console.error('✗ Set POLYGON_RPC_URL and POLYGON_PRIVATE_KEY env vars first.');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const network = await provider.getNetwork();
  console.log(`Connected to chain ${network.chainId} as ${wallet.address}`);
  const balance = await provider.getBalance(wallet.address);
  console.log(`Deployer balance: ${ethers.formatEther(balance)} MATIC`);

  if (balance === 0n) {
    console.error('✗ Deployer wallet has no MATIC for gas. Fund it first.');
    process.exit(1);
  }

  // 1. Deploy username contract
  console.log('\nCompiling SwapPulseUsername…');
  const usernameCompiled = compile(USERNAME_SOURCE, 'SwapPulseUsername');
  const UsernameFactory = new ethers.ContractFactory(usernameCompiled.abi, usernameCompiled.bytecode, wallet);
  console.log('Deploying username contract…');
  const usernameContract = await UsernameFactory.deploy();
  await usernameContract.waitForDeployment();
  const usernameAddress = await usernameContract.getAddress();
  console.log(`✓ SwapPulseUsername deployed: ${usernameAddress}`);

  // 2. Deploy card contract (with username address as constructor arg)
  console.log('\nCompiling SwapPulseCardNFT…');
  const cardCompiled = compile(CARD_SOURCE, 'SwapPulseCardNFT');
  const CardFactory = new ethers.ContractFactory(cardCompiled.abi, cardCompiled.bytecode, wallet);
  console.log('Deploying card contract…');
  const cardContract = await CardFactory.deploy(usernameAddress);
  await cardContract.waitForDeployment();
  const cardAddress = await cardContract.getAddress();
  console.log(`✓ SwapPulseCardNFT deployed: ${cardAddress}`);

  console.log('\n════════════════════════════════════════════');
  console.log('  DEPLOYMENT COMPLETE — set these as app secrets:');
  console.log('════════════════════════════════════════════');
  console.log(`  POLYGON_USERNAME_CONTRACT = ${usernameAddress}`);
  console.log(`  POLYGON_CARD_CONTRACT     = ${cardAddress}`);
  console.log('════════════════════════════════════════════');
  console.log('\nUpdate them in: Base44 → Settings → Secrets');
}

main().catch((err) => {
  console.error('✗ Deployment failed:', err.message);
  process.exit(1);
});