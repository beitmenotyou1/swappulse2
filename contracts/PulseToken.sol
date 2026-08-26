// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title PulseToken
 * @author SwapPulse / Michael Burgess
 * @notice ERC-20 contract for the $PULSE governance and utility token.
 *
 * Tokenomics:
 *   Total Supply: 1,000,000,000 $PULSE (1 billion)
 *   - 40% Community Usage Mining (400M) - distributed via this contract
 *   - 25% Validator Incentives (250M) - distributed via staking contract
 *   - 15% Platform Reserve (150M) - held by admin
 *   - 10% Initial Airdrop (100M) - distributed via merkle claim
 *   - 5% Liquidity (50M) - transferred to LP pools
 *   - 5% Team (50M) - vested via separate contract
 *
 * Usage Mining:
 *   Users earn $PULSE by using the SwapPulse platform. Points are
 *   accumulated off-chain and claimed here via signed messages from
 *   the platform's authorised signer.
 *
 * Claim Flow:
 *   1. User accumulates points through platform activity
 *   2. Platform signs a message: (user, amount, nonce, epoch)
 *   3. User calls claimMiningReward() with the signature
 *   4. Contract verifies signature, transfers tokens, increments nonce
 *
 * @dev Uses OpenZeppelin v5 ERC-20 with AccessControl, Pausable.
 *      Pre-compiled bytecode is stored in base44/shared/pulseTokenArtifacts.ts.
 */

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract PulseToken is ERC20, AccessControl, Pausable {
    using ECDSA for bytes32;

    // ============================================================
    // Constants
    // ============================================================

    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10**18; // 1 billion
    uint256 public constant MINING_ALLOCATION = 400_000_000 * 10**18; // 40%
    uint256 public constant RESERVE_ALLOCATION = 150_000_000 * 10**18; // 15%

    // ============================================================
    // Roles
    // ============================================================

    bytes32 public constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // ============================================================
    // Mining State
    // ============================================================

    /// @dev Authorised signer for mining reward claims
    address public miningSigner;

    /// @dev Nonce per user to prevent replay attacks
    mapping(address => uint256) public claimNonces;

    /// @dev Total mining rewards distributed
    uint256 public totalMiningDistributed;

    /// @dev Mining rewards distributed per user
    mapping(address => uint256) public miningRewarded;

    /// @dev Current mining epoch (daily resets)
    uint256 public currentEpoch;

    /// @dev Tokens distributed per epoch
    mapping(uint256 => uint256) public epochDistributed;

    /// @dev Maximum tokens distributable per epoch
    uint256 public maxPerEpoch;

    // ============================================================
    // Events
    // ============================================================

    event MiningRewardClaimed(
        address indexed user,
        uint256 amount,
        uint256 epoch,
        uint256 nonce,
        uint256 timestamp
    );

    event EpochAdvanced(uint256 oldEpoch, uint256 newEpoch);

    event MiningSignerUpdated(address oldSigner, address newSigner);

    event MaxPerEpochUpdated(uint256 oldMax, uint256 newMax);

    // ============================================================
    // Constructor
    // ============================================================

    constructor(
        address admin,
        address _miningSigner,
        uint256 _maxPerEpoch
    ) ERC20("PulseChain Token", "PULSE") {
        require(admin != address(0), "Admin cannot be zero");
        require(_miningSigner != address(0), "Signer cannot be zero");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);

        miningSigner = _miningSigner;
        maxPerEpoch = _maxPerEpoch > 0 ? _maxPerEpoch : 1_000_000 * 10**18; // Default: 1M/day

        // Mint total supply to this contract
        _mint(address(this), TOTAL_SUPPLY);

        // Transfer reserve allocation to admin
        _transfer(address(this), admin, RESERVE_ALLOCATION);
    }

    // ============================================================
    // Mining Reward Claims
    // ============================================================

    /**
     * @notice Claims accumulated mining rewards.
     *
     * The platform's authorised signer signs a message containing:
     *   - User address
     *   - Reward amount (in wei)
     *   - User's current nonce
     *   - Current epoch
     *
     * @param amount Amount of $PULSE to claim (in wei)
     * @param nonce User's expected nonce (must match contract state)
     * @param epoch Current mining epoch
     * @param signature ECDSA signature from the authorised signer
     */
    function claimMiningReward(
        uint256 amount,
        uint256 nonce,
        uint256 epoch,
        bytes calldata signature
    ) external whenNotPaused {
        require(amount > 0, "Amount must be > 0");
        require(epoch == currentEpoch, "Wrong epoch");
        require(claimNonces[msg.sender] == nonce, "Invalid nonce");
        require(
            totalMiningDistributed + amount <= MINING_ALLOCATION,
            "Mining pool exhausted"
        );
        require(
            epochDistributed[epoch] + amount <= maxPerEpoch,
            "Epoch limit exceeded"
        );

        // Verify signature
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                msg.sender,
                amount,
                nonce,
                epoch,
                block.chainid
            )
        );

        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address recovered = ethSignedHash.recover(signature);

        require(recovered == miningSigner, "Invalid signature");

        // Update state
        claimNonces[msg.sender]++;
        totalMiningDistributed += amount;
        epochDistributed[epoch] += amount;
        miningRewarded[msg.sender] += amount;

        // Transfer tokens
        _transfer(address(this), msg.sender, amount);

        emit MiningRewardClaimed(msg.sender, amount, epoch, nonce, block.timestamp);
    }

    // ============================================================
    // Admin Functions
    // ============================================================

    /**
     * @notice Advances to the next mining epoch.
     *         Called once per day by the admin (or keeper bot).
     */
    function advanceEpoch() external onlyRole(ADMIN_ROLE) {
        uint256 oldEpoch = currentEpoch;
        currentEpoch++;
        emit EpochAdvanced(oldEpoch, currentEpoch);
    }

    /**
     * @notice Updates the authorised mining signer.
     */
    function setMiningSigner(address newSigner) external onlyRole(ADMIN_ROLE) {
        require(newSigner != address(0), "Signer cannot be zero");
        address old = miningSigner;
        miningSigner = newSigner;
        emit MiningSignerUpdated(old, newSigner);
    }

    /**
     * @notice Updates the maximum tokens distributable per epoch.
     */
    function setMaxPerEpoch(uint256 newMax) external onlyRole(ADMIN_ROLE) {
        require(newMax > 0, "Max must be > 0");
        uint256 old = maxPerEpoch;
        maxPerEpoch = newMax;
        emit MaxPerEpochUpdated(old, newMax);
    }

    /**
     * @notice Transfers tokens from the contract to a recipient.
     *         Used for airdrops, liquidity provision, and team vesting.
     */
    function distributeTokens(
        address to,
        uint256 amount
    ) external onlyRole(MINTER_ROLE) whenNotPaused {
        require(to != address(0), "Cannot send to zero address");
        require(amount > 0, "Amount must be > 0");

        uint256 remaining = MINING_ALLOCATION - totalMiningDistributed;
        uint256 contractBalance = balanceOf(address(this));

        require(
            amount <= contractBalance - remaining,
            "Insufficient non-mining balance"
        );

        _transfer(address(this), to, amount);
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // ============================================================
    // View Functions
    // ============================================================

    function getRemainingMiningPool() external view returns (uint256) {
        return MINING_ALLOCATION - totalMiningDistributed;
    }

    function getEpochRemaining() external view returns (uint256) {
        return maxPerEpoch - epochDistributed[currentEpoch];
    }

    function getUserNonce(address user) external view returns (uint256) {
        return claimNonces[user];
    }

    function getUserRewards(address user) external view returns (uint256) {
        return miningRewarded[user];
    }

    // ============================================================
    // Overrides
    // ============================================================

    function supportsInterface(bytes4 interfaceId)
        public view override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}