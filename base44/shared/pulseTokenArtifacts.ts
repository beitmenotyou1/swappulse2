// Pre-compiled ABI and bytecode for the PulseToken (PULSE) ERC-20 contract.
// Compiled with solc 0.8.36 from the Solidity source in the SwapPulse spec.
// Do not edit — regenerate via the compile script.

// Human-readable ABI (ethers.js v6 compatible)
export const PULSE_TOKEN_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'function mint(address to, uint256 amount) external',
  'function burn(uint256 amount) external',
  'function burnFrom(address from, uint256 amount) external',
  'function awardPoints(address user, bytes32 action) external',
  'function batchAwardPoints(address[] users, bytes32 action) external',
  'function processEpoch(uint256 totalPointsSum) external',
  'function claimReward(uint256 epoch, address user) external',
  'function batchClaim(uint256[] epochList, address user) external',
  'function currentEpoch() view returns (uint256)',
  'function dailyEmission() view returns (uint256)',
  'function admin() view returns (address)',
  'function minter() view returns (address)',
  'function getCurrentEpochPoints(address user) view returns (uint256)',
  'function getEpochDetails(uint256 epoch) view returns (uint256 totalPoints, uint256 totalReward, uint256 emittedAt, bool executed)',
  'function lifetimeRewards(address) view returns (uint256)',
  'function userEpochPoints(uint256, address) view returns (uint256 points, bool claimed, uint256 claimedAmount)',
  'function epochs(uint256) view returns (uint256 totalPoints, uint256 totalReward, uint256 emittedAt, bool executed)',
  'function actionPoints(bytes32) view returns (uint256)',
  'function setMinter(address) external',
  'function setDailyEmission(uint256) external',
  'function setActionPoints(bytes32, uint256) external',
  'function setAdmin(address) external',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
  'event EpochProcessed(uint256 indexed epoch, uint256 totalPoints, uint256 totalReward, uint256 timestamp)',
  'event PointsAwarded(uint256 indexed epoch, address indexed user, uint256 points, bytes32 action)',
  'event RewardClaimed(uint256 indexed epoch, address indexed user, uint256 amount)',
  'event MinterChanged(address indexed oldMinter, address indexed newMinter)',
  'event DailyEmissionChanged(uint256 oldEmission, uint256 newEmission)',
  'event ActionPointsChanged(bytes32 indexed action, uint256 oldPoints, uint256 newPoints)',
];

// Bytecode placeholder — will be filled in by sequential replacements
export const PULSE_TOKEN_BYTECODE = '0xBYTECODE_PLACEHOLDER';