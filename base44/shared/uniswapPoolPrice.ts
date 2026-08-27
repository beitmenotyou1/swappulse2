// uniswapPoolPrice — reads the live state of the SwapPulse $PULSE/USDC Uniswap v4
// liquidity pool on Polygon via the StateView lens contract (no subgraph/API
// key required — uses the existing POLYGON_RPC_URL secret).
//
// Shared by get-uniswap-v4-pool-price (admin UI / drift alerts) and
// execute-conversion (trusted PULSE price for treasury disbursement). The
// on-chain pool price is the authoritative source — never trust a
// client-supplied price for treasury disbursement.
//
// The pool is identified by reading position #134728 from the v4 PositionManager,
// which returns the full PoolKey (token0, token1, fee, tickSpacing, hooks). From
// the PoolKey we compute the v4 PoolId (keccak256 of the abi-encoded key) and call
// StateView.getSlot0(poolId) for the current sqrtPriceX96 + tick.

import { ethers } from 'npm:ethers@6.13.4';
import { secrets } from 'base44:runtime';

// Polygon mainnet v4 deployments (https://developers.uniswap.org/deployments.json)
export const POSITION_MANAGER = '0x1Ec2eBf4F37E7363FDfe3551602425af0B3ceef9';
export const STATE_VIEW = '0x5eA1bD7974c8A611cBAB0bDCAFcB1D9CC9b3BA5a';
export const POSITION_TOKEN_ID = 134728n;
export const POSITION_URL = 'https://app.uniswap.org/positions/v4/polygon/134728';

const POSITION_MANAGER_ABI = [
  {
    name: 'getPoolAndPositionInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      {
        name: 'poolKey',
        type: 'tuple',
        components: [
          { name: 'currency0', type: 'address' },
          { name: 'currency1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'hooks', type: 'address' },
        ],
      },
      { name: 'info', type: 'uint256' },
    ],
  },
  {
    name: 'getPositionLiquidity',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: 'liquidity', type: 'uint128' }],
  },
];

const STATE_VIEW_ABI = [
  {
    name: 'getSlot0',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'protocolFee', type: 'uint24' },
      { name: 'lpFee', type: 'uint24' },
    ],
  },
  {
    name: 'getLiquidity',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [{ name: 'liquidity', type: 'uint128' }],
  },
];

const ERC20_DECIMALS_ABI = [
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
];

// Decode the v4 packed position-info word into tickLower / tickUpper (24-bit signed).
function decodeTicks(info: bigint): { tickLower: number; tickUpper: number } {
  const signExtend24 = (raw: bigint) => {
    const v = Number(raw & 0xffffffn);
    return v >= 0x800000 ? v - 0x1000000 : v;
  };
  return {
    tickLower: signExtend24((info >> 8n) & 0xffffffn),
    tickUpper: signExtend24((info >> 32n) & 0xffffffn),
  };
}

// price_token1_per_token0 = (sqrtPriceX96^2 / 2^192) * 10^(dec0 - dec1), as a JS number.
function priceToken1PerToken0(sqrtPriceX96: bigint, dec0: number, dec1: number): number {
  const num = sqrtPriceX96 * sqrtPriceX96;
  const den = 2n ** 192n;
  const exp = dec0 - dec1;
  let n = num;
  let d = den;
  if (exp >= 0) n *= 10n ** BigInt(exp);
  else d *= 10n ** BigInt(-exp);
  const PREC = 10n ** 18n;
  const scaled = (n * PREC) / d;
  return Number(scaled) / 1e18;
}

export interface PoolPriceState {
  poolId: string;
  poolKey: {
    currency0: string;
    currency1: string;
    fee: number;
    tickSpacing: number;
    hooks: string;
  };
  feeTierPct: number;
  tick: number;
  tickLower: number;
  tickUpper: number;
  inRange: boolean;
  positionLiquidity: bigint;
  poolLiquidity: bigint;
  sqrtPriceX96: bigint;
  priceUsdcPerPulse: number;
  pricePulsePerUsdc: number;
  token0: { address: string; decimals: number; isPulse: boolean };
  token1: { address: string; decimals: number; isPulse: boolean };
}

/**
 * Read the current $PULSE/USDC Uniswap v4 pool state on Polygon and derive the
 * spot price. Throws if POLYGON_RPC_URL is unset or the on-chain read fails —
 * callers should fall back to an alternative oracle when it does.
 */
export async function readPulseUsdcPoolPrice(): Promise<PoolPriceState> {
  const rpcUrl = secrets.get('POLYGON_RPC_URL');
  if (!rpcUrl) throw new Error('POLYGON_RPC_URL secret not set');
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const positionManager = new ethers.Contract(POSITION_MANAGER, POSITION_MANAGER_ABI, provider);
  const stateView = new ethers.Contract(STATE_VIEW, STATE_VIEW_ABI, provider);

  // 1. Read the position's pool key + packed tick info.
  const [poolKey, info] = await positionManager.getPoolAndPositionInfo(POSITION_TOKEN_ID);
  const currency0: string = poolKey.currency0;
  const currency1: string = poolKey.currency1;
  const fee: number = Number(poolKey.fee);
  const tickSpacing: number = Number(poolKey.tickSpacing);
  const hooks: string = poolKey.hooks;
  const { tickLower, tickUpper } = decodeTicks(BigInt(info));

  const positionLiquidity: bigint = await positionManager.getPositionLiquidity(POSITION_TOKEN_ID);

  // 2. Compute the v4 PoolId = keccak256(abi.encode(PoolKey)).
  const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
    ['address', 'address', 'uint24', 'int24', 'address'],
    [currency0, currency1, fee, tickSpacing, hooks],
  );
  const poolId = ethers.keccak256(encoded);

  // 3. Read the current pool price + active liquidity from StateView.
  const slot0 = await stateView.getSlot0(poolId);
  const sqrtPriceX96 = BigInt(slot0.sqrtPriceX96);
  const tick: number = Number(slot0.tick);
  const poolLiquidity: bigint = await stateView.getLiquidity(poolId);

  // 4. Resolve token decimals + identify PULSE vs USDC.
  const pulseAddr = (secrets.get('PULSE_TOKEN_CONTRACT') || '').toLowerCase();
  const token0Contract = new ethers.Contract(currency0, ERC20_DECIMALS_ABI, provider);
  const token1Contract = new ethers.Contract(currency1, ERC20_DECIMALS_ABI, provider);
  const [dec0Raw, dec1Raw] = await Promise.all([
    token0Contract.decimals().catch(() => 18),
    token1Contract.decimals().catch(() => 6),
  ]);
  const dec0 = Number(dec0Raw);
  const dec1 = Number(dec1Raw);

  const priceT1PerT0 = priceToken1PerToken0(sqrtPriceX96, dec0, dec1);
  const token0IsPulse = currency0.toLowerCase() === pulseAddr;
  let priceUsdcPerPulse: number;
  let pricePulsePerUsdc: number;
  if (token0IsPulse) {
    // token0 = PULSE, token1 = USDC → priceT1PerT0 = USDC per PULSE
    priceUsdcPerPulse = priceT1PerT0;
    pricePulsePerUsdc = priceT1PerT0 > 0 ? 1 / priceT1PerT0 : 0;
  } else {
    // token0 = USDC, token1 = PULSE → priceT1PerT0 = PULSE per USDC
    pricePulsePerUsdc = priceT1PerT0;
    priceUsdcPerPulse = priceT1PerT0 > 0 ? 1 / priceT1PerT0 : 0;
  }

  return {
    poolId,
    poolKey: { currency0, currency1, fee, tickSpacing, hooks },
    feeTierPct: fee / 10000,
    tick,
    tickLower,
    tickUpper,
    inRange: tick >= tickLower && tick <= tickUpper,
    positionLiquidity,
    poolLiquidity,
    sqrtPriceX96,
    priceUsdcPerPulse,
    pricePulsePerUsdc,
    token0: { address: currency0, decimals: dec0, isPulse: token0IsPulse },
    token1: { address: currency1, decimals: dec1, isPulse: !token0IsPulse },
  };
}