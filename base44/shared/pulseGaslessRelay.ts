// Shared helpers for the PulseChain gasless meta-transaction relay.
//
// The PulseGaslessRelay contract lets a user sign an EIP-712 typed message
// authorizing a call to a target contract; the treasury relayer (admin) submits
// it on-chain and pays the native PLS gas. Used by:
//   - queue-pulse-gasless-transfer / pulseGaslessQueue.ts (custodial signing)
//   - process-meta-transactions (relayer submission)
//
// EIP-712 domain + types MUST match the contract's typehashes exactly:
//   MetaTx(address user,address target,uint256 nonce,bytes data)
//   EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)

import { ethers } from 'npm:ethers@6.13.4';
import { resolveDeployedAddress } from './contractRegistry.ts';

export const PULSE_GASLESS_RELAY_ABI = [
  'function admin() view returns (address)',
  'function nonces(address) view returns (uint256)',
  'function domainSeparator() view returns (bytes32)',
  'function execute(address user, address target, bytes data, uint256 nonce, bytes signature) returns (bytes)',
  'event Executed(address indexed user, address indexed target, uint256 nonce)',
];

// EIP-712 type definition matching the contract's META_TX_TYPEHASH.
export const PULSE_GASLESS_RELAY_TYPES = {
  MetaTx: [
    { name: 'user', type: 'address' },
    { name: 'target', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'data', type: 'bytes' },
  ],
};

export const PULSE_GASLESS_RELAY_DOMAIN_NAME = 'SwapPulse Gasless Relay';
export const PULSE_GASLESS_RELAY_DOMAIN_VERSION = '1';

// Resolve the deployed PulseGaslessRelay address from the ContractRegistry.
export async function getPulseRelayAddress(svc: any): Promise<string | null> {
  return resolveDeployedAddress(svc, 'pulse_meta_relay');
}

// Build the EIP-712 domain object for signing/verification.
export function buildRelayDomain(relayAddress: string, chainId: bigint) {
  return {
    name: PULSE_GASLESS_RELAY_DOMAIN_NAME,
    version: PULSE_GASLESS_RELAY_DOMAIN_VERSION,
    chainId,
    verifyingContract: relayAddress,
  };
}

// Sign a gasless meta-transaction intent with a user's wallet. Returns the
// EIP-712 signature over (user, target, nonce, data). The `data` is the encoded
// target calldata (e.g. transferFrom(user, to, amount)).
export async function signPulseGaslessIntent(args: {
  signer: ethers.Wallet;
  relayAddress: string;
  chainId: bigint;
  userAddress: string;
  targetContract: string;
  data: string;
  nonce: bigint;
}): Promise<{ signature: string }> {
  const domain = buildRelayDomain(args.relayAddress, args.chainId);
  const value = {
    user: args.userAddress,
    target: args.targetContract,
    nonce: args.nonce,
    data: args.data,
  };
  const signature = await args.signer.signTypedData(domain, PULSE_GASLESS_RELAY_TYPES, value);
  return { signature };
}