// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title PulseStaking
 * @author SwapPulse / Michael Burgess
 * @notice Validator staking contract for PulseChain consensus.
 *
 * Validators stake $PULSE tokens to participate in block validation.
 * Staking requirements:
 *   - Minimum stake: 10,000 $PULSE
 *   - Lock period: 30 days minimum
 *   - Slashing conditions: Downtime > 5%, equivocation detected
 *
 * Staking Rewards:
 *   - Distributed weekly from token allocation
 *   - Proportional to stake size
 *   - Multiplier based on trust score (up to 2x)
 *
 * @dev Uses OpenZeppelin v5 SafeERC20, ReentrancyGuard, AccessControl.
 *      Pre-compiled bytecode stored in base44/shared/validatorRegistryArtifacts.ts.
 */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

interface IUsernameNFT {
    function getTrustScore(uint256 tokenId) external view returns (uint8);
}

contract PulseStaking is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============================================================
    // Roles
    // ============================================================

    bytes32 public constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;
    bytes32 public constant REWARD_DISTRIBUTOR_ROLE = keccak256("REWARD_DISTRIBUTOR_ROLE");
    bytes32 public constant SLASHER_ROLE = keccak256("SLASHER_ROLE");

    // ============================================================
    // Constants
    // ============================================================

    uint256 public constant MIN_STAKE_AMOUNT = 10_000 * 10**18; // 10,000 $PULSE
    uint256 public constant MIN_LOCK_PERIOD = 30 days;
    uint256 public constant MAX_TRUST_MULTIPLIER = 200; // 200% = 2x

    // ============================================================
    // Storage
    // ============================================================

    address public pulseToken;
    address public usernameNFT;
    uint256 public totalStaked;
    uint256 public rewardPoolBalance;

    mapping(address => ValidatorInfo) public validators;
    mapping(address => StakeRecord[]) public stakes;
    mapping(uint256 => uint256) public epochRewardsDistributed;

    struct ValidatorInfo {
        bool isActive;
        uint256 stakeAmount;
        uint256 trustMultiplier;
        uint256 totalRewardsEarned;
        uint256 lastClaimTime;
        uint256 slashableSince;
        uint256 stakeUnlockTime;
    }

    struct StakeRecord {
        uint256 amount;
        uint256 depositAt;
        uint256 unlockTime;
        bool locked;
        bool withdrawn;
    }

    // ============================================================
    // Events
    // ============================================================

    event ValidatorRegistered(address indexed validator, uint256 stakeAmount, uint256 trustMultiplier, uint256 timestamp);
    event StakeDeposited(address indexed validator, uint256 amount, uint256 unlockTime);
    event StakeWithdrawn(address indexed validator, uint256 amount);
    event RewardsClaimed(address indexed validator, uint256 rewards, uint256 timestamp);
    event ValidatorSlashed(address indexed validator, uint256 slashedAmount, string reason, uint256 timestamp);
    event RewardTokensAdded(uint256 amount, uint256 totalPool);

    // ============================================================
    // Constructor
    // ============================================================

    constructor(address admin, address _pulseToken, address _usernameNFT) {
        require(admin != address(0), "Admin cannot be zero");
        require(_pulseToken != address(0), "Token cannot be zero");
        require(_usernameNFT != address(0), "Username NFT cannot be zero");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REWARD_DISTRIBUTOR_ROLE, admin);
        _grantRole(SLASHER_ROLE, admin);

        pulseToken = _pulseToken;
        usernameNFT = _usernameNFT;
    }

    // ============================================================
    // Validator Registration
    // ============================================================

    /**
     * @notice Registers an address as a validator with initial stake.
     * @param initialStake Initial stake amount (must meet minimum)
     * @param didTokenId The username NFT token ID containing trust score
     */
    function registerValidator(uint256 initialStake, uint256 didTokenId) external nonReentrant returns (bool) {
        require(initialStake >= MIN_STAKE_AMOUNT, "Stake below minimum");
        require(!validators[msg.sender].isActive, "Already registered");

        IERC20(pulseToken).safeTransferFrom(msg.sender, address(this), initialStake);

        uint8 trustScore = _getTrustScore(didTokenId);
        uint256 trustMultiplier = _calculateTrustMultiplier(trustScore);

        validators[msg.sender] = ValidatorInfo({
            isActive: true,
            stakeAmount: initialStake,
            trustMultiplier: trustMultiplier,
            totalRewardsEarned: 0,
            lastClaimTime: block.timestamp,
            slashableSince: 0,
            stakeUnlockTime: 0
        });

        stakes[msg.sender].push(StakeRecord({
            amount: initialStake,
            depositAt: block.timestamp,
            unlockTime: block.timestamp + MIN_LOCK_PERIOD,
            locked: true,
            withdrawn: false
        }));

        totalStaked += initialStake;

        emit ValidatorRegistered(msg.sender, initialStake, trustMultiplier, block.timestamp);
        return true;
    }

    // ============================================================
    // Stake Deposits
    // ============================================================

    function depositStake(uint256 amount, uint256 lockPeriod) external nonReentrant {
        require(validators[msg.sender].isActive, "Not a validator");
        require(amount > 0, "Amount must be > 0");
        require(lockPeriod >= MIN_LOCK_PERIOD, "Lock too short");

        IERC20(pulseToken).safeTransferFrom(msg.sender, address(this), amount);

        uint256 unlockTime = block.timestamp + lockPeriod;

        stakes[msg.sender].push(StakeRecord({
            amount: amount,
            depositAt: block.timestamp,
            unlockTime: unlockTime,
            locked: true,
            withdrawn: false
        }));

        validators[msg.sender].stakeAmount += amount;
        totalStaked += amount;

        emit StakeDeposited(msg.sender, amount, unlockTime);
    }

    // ============================================================
    // Stake Withdrawals
    // ============================================================

    function withdrawStake(uint256 stakeIndex) external nonReentrant {
        ValidatorInfo storage validator = validators[msg.sender];
        require(validator.isActive, "Not a validator");
        require(stakes[msg.sender].length > stakeIndex, "Invalid stake index");

        StakeRecord storage stake = stakes[msg.sender][stakeIndex];
        require(!stake.withdrawn, "Already withdrawn");
        require(block.timestamp >= stake.unlockTime, "Stake still locked");

        uint256 withdrawAmount = stake.amount;
        stake.withdrawn = true;

        validator.stakeAmount -= withdrawAmount;
        totalStaked -= withdrawAmount;

        if (validator.stakeAmount == 0) {
            validator.isActive = false;
        }

        IERC20(pulseToken).safeTransfer(msg.sender, withdrawAmount);

        emit StakeWithdrawn(msg.sender, withdrawAmount);
    }

    // ============================================================
    // Reward Distribution
    // ============================================================

    function claimRewards() external nonReentrant {
        ValidatorInfo storage validator = validators[msg.sender];
        require(validator.isActive, "Not a validator");
        require(validator.slashableSince == 0, "Validator slashed");

        uint256 unclaimedRewards = _calculateUnclaimedRewards(validator);
        require(unclaimedRewards > 0, "No rewards to claim");
        require(rewardPoolBalance >= unclaimedRewards, "Insufficient reward pool balance");

        validator.totalRewardsEarned += unclaimedRewards;
        validator.lastClaimTime = block.timestamp;
        rewardPoolBalance -= unclaimedRewards;

        IERC20(pulseToken).safeTransfer(msg.sender, unclaimedRewards);

        emit RewardsClaimed(msg.sender, unclaimedRewards, block.timestamp);
    }

    function addToRewardPool(uint256 amount) external onlyRole(REWARD_DISTRIBUTOR_ROLE) nonReentrant {
        IERC20(pulseToken).safeTransferFrom(msg.sender, address(this), amount);
        rewardPoolBalance += amount;
        emit RewardTokensAdded(amount, rewardPoolBalance);
    }

    // ============================================================
    // Slashing
    // ============================================================

    function slashValidator(
        address validator,
        string calldata reason,
        uint256 slashPercentage
    ) external onlyRole(SLASHER_ROLE) nonReentrant {
        require(validators[validator].isActive, "Not a validator");
        require(slashPercentage <= 100, "Invalid percentage");

        ValidatorInfo storage v = validators[validator];
        uint256 slashAmount = (v.stakeAmount * slashPercentage) / 100;

        v.slashableSince = block.timestamp;
        v.isActive = false;
        v.stakeAmount -= slashAmount;
        totalStaked -= slashAmount;

        IERC20(pulseToken).safeTransfer(msg.sender, slashAmount);

        emit ValidatorSlashed(validator, slashAmount, reason, block.timestamp);
    }

    // ============================================================
    // View Functions
    // ============================================================

    function getValidatorInfo(address validator) external view returns (ValidatorInfo memory) {
        return validators[validator];
    }

    function getAllStakes(address validator) external view returns (StakeRecord[] memory) {
        return stakes[validator];
    }

    function getUnclaimedRewards(address validator) external view returns (uint256) {
        if (!validators[validator].isActive) return 0;
        return _calculateUnclaimedRewards(validators[validator]);
    }

    function canWithdraw(address validator, uint256 stakeIndex) external view returns (bool) {
        if (!validators[validator].isActive) return false;
        if (stakes[validator].length <= stakeIndex) return false;
        return block.timestamp >= stakes[validator][stakeIndex].unlockTime;
    }

    // ============================================================
    // Internal Helpers
    // ============================================================

    function _getTrustScore(uint256 didTokenId) internal view returns (uint8) {
        try IUsernameNFT(usernameNFT).getTrustScore(didTokenId) returns (uint8 score) {
            return score;
        } catch {
            return 50;
        }
    }

    function _calculateTrustMultiplier(uint8 trustScore) internal pure returns (uint256) {
        // Trust score 0-100 maps to multiplier 50%-200%
        return 50 + (trustScore * 150 / 100);
    }

    function _calculateUnclaimedRewards(ValidatorInfo storage validator) internal view returns (uint256) {
        uint256 timeElapsed = block.timestamp - validator.lastClaimTime;
        // Example rate: 0.01% per day
        uint256 baseRewards = (validator.stakeAmount * timeElapsed * 100) / (10**18 * 1 days);
        uint256 adjustedRewards = (baseRewards * validator.trustMultiplier) / 100;
        return adjustedRewards;
    }

    function supportsInterface(bytes4 interfaceId) public view override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}