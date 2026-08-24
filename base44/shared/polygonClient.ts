// Shared Polygon (EVM) client for SwapPulse backend functions.
// Provides ethers.js setup, contract ABIs, and helpers for the
// soulbound username NFT and transferable card NFT contracts.
// Contract addresses are read from secrets (set after deploy).

import { ethers } from 'npm:ethers@6.13.4';
import { secrets } from 'base44:runtime';

export function getProvider(): ethers.JsonRpcProvider {
  const rpcUrl = secrets.get('POLYGON_RPC_URL');
  if (!rpcUrl) throw new Error('POLYGON_RPC_URL secret not set');
  return new ethers.JsonRpcProvider(rpcUrl);
}

export function getMintWallet(): ethers.Wallet {
  const privateKey = secrets.get('POLYGON_PRIVATE_KEY');
  if (!privateKey) throw new Error('POLYGON_PRIVATE_KEY secret not set');
  return new ethers.Wallet(privateKey, getProvider());
}

export function getChainId(): string {
  return secrets.get('POLYGON_CHAIN_ID') || '137';
}

export function getExplorerUrl(): string {
  return secrets.get('POLYGON_EXPLORER_URL') || 'https://polygonscan.com';
}

export function getUsernameContractAddress(): string | null {
  return secrets.get('POLYGON_USERNAME_CONTRACT') || null;
}

export function getCardContractAddress(): string | null {
  return secrets.get('POLYGON_CARD_CONTRACT') || null;
}

// Human-readable ABIs (ethers v6 format)
export const USERNAME_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function mint(address to, string handle, string did, string metadataURI) returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function getUsernameToken(uint256 tokenId) view returns (string handle, string did, string metadataURI)',
  'function getTokenIdByOwner(address owner) view returns (uint256)',
  'function hasUsername(address owner) view returns (bool)',
  'function admin() view returns (address)',
  'event Mint(address indexed to, uint256 indexed tokenId, string handle, string did)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
];

export const CARD_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function mint(address to, string cardId, string cardName, string cardImage, string metadataURI) returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function balanceOf(address owner) view returns (uint256)',
  'function getCardToken(uint256 tokenId) view returns (string cardId, string cardName, string cardImage, string metadataURI, uint256 minterUsernameTokenId)',
  'function transferFrom(address from, address to, uint256 tokenId)',
  'function safeTransferFrom(address from, address to, uint256 tokenId)',
  'function setMinterUsernameTokenId(uint256 tokenId, uint256 usernameTokenId)',
  'function admin() view returns (address)',
  'function usernameContract() view returns (address)',
  'event Mint(address indexed to, uint256 indexed tokenId, string cardId)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
];

export function getUsernameContract(signerOrProvider: any): ethers.Contract {
  const address = getUsernameContractAddress();
  if (!address) throw new Error('Username contract not deployed. Run deploy-polygon-contracts first and set POLYGON_USERNAME_CONTRACT secret.');
  return new ethers.Contract(address, USERNAME_ABI, signerOrProvider);
}

export function getCardContract(signerOrProvider: any): ethers.Contract {
  const address = getCardContractAddress();
  if (!address) throw new Error('Card contract not deployed. Run deploy-polygon-contracts first and set POLYGON_CARD_CONTRACT secret.');
  return new ethers.Contract(address, CARD_ABI, signerOrProvider);
}

// Parse a Mint event from a transaction receipt to extract the token ID.
export function parseMintEvent(contract: ethers.Contract, receipt: any): { tokenId: number; to: string } {
  const mintTopic = contract.interface.getEvent('Mint')?.topicHash;
  const log = receipt.logs?.find((l: any) => l.topics?.[0] === mintTopic);
  if (!log) throw new Error('Mint event not found in transaction receipt');
  const decoded = contract.interface.parseLog(log);
  return {
    tokenId: Number(decoded.args.tokenId),
    to: decoded.args.to,
  };
}