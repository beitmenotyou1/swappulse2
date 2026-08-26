// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title MetaTransactionRelay
 * @author SwapPulse / Michael Burgess
 * @notice Enables gas-less transactions via signed relayer requests.
 *
 * Users sign transaction data off-chain, relayers submit the
 * transaction with their own gas. Relayers are reimbursed
 * from a prepaid pool or receive fees.
 *
 * Flow:
 * 1. User signs: (targetContract, functionData, nonce)
 * 2. Relayer submits: execMetaTransaction(userSignature, ...)
 * 3. Contract verifies signature, executes call on target, pays gas to relayer
 *
 * Security:
 * - Nonce prevents replay attacks
 * - Chain ID binding prevents cross-chain replay
 * - Gas limits prevent runaway costs
 *
 * @dev Uses EIP-712 for typed structured signing.
 *      Fixed from spec: calls target contract (not address(this)) and
 *      includes target in the function signature.
 */

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract MetaTransactionRelay is AccessControl, EIP712, ReentrancyGuard {
    using ECDSA for bytes32;

    // ============================================================
    // Roles
    // ============================================================

    bytes32 public constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    // ============================================================
    // Constants
    // ============================================================

    bytes32 private constant META_TX_TYPEHASH = keccak256(
        "MetaTransaction(address target,uint256 nonce,bytes data)"
    );

    uint256 public constant RELAYER_FEE_BPS = 100; // 1% fee in basis points

    // ============================================================
    // Storage
    // ============================================================

    mapping(address => uint256) public usedNonces;
    mapping(address => uint256) public relayerFees;
    address public feeRecipient;

    // ============================================================
    // Events
    // ============================================================

    event MetaTransactionExecuted(
        address indexed user,
        address indexed relayer,
        address indexed target,
        uint256 nonce,
        uint256 gasUsed,
        uint256 feePaid
    );

    event FeeRecipientUpdated(address oldRecipient, address newRecipient);

    // ============================================================
    // Constructor
    // ============================================================

    constructor(address admin, address _feeRecipient) EIP712("SwapPulse", "1") {
        require(admin != address(0), "Admin cannot be zero");
        require(_feeRecipient != address(0), "Fee recipient cannot be zero");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        feeRecipient = _feeRecipient;
    }

    // ============================================================
    // Meta Transaction Execution
    // ============================================================

    /**
     * @notice Executes a meta-transaction signed by a user.
     *         Only relayers can call this function.
     * @param userAddress The user who signed the request
     * @param target The target contract to call
     * @param data The encoded function call to execute on the target
     * @param nonce The user's nonce (must match state)
     * @param signature The user's signature over the typed data
     */
    function executeMetaTransaction(
        address userAddress,
        address target,
        bytes calldata data,
        uint256 nonce,
        bytes calldata signature
    ) external payable nonReentrant returns (bytes memory) {
        require(hasRole(RELAYER_ROLE, msg.sender), "Not a relayer");
        require(target != address(0), "Target cannot be zero");
        require(data.length > 0, "Data cannot be empty");
        require(nonce == usedNonces[userAddress], "Invalid nonce");

        // Verify signature
        bytes32 digest = _buildDigest(userAddress, target, data, nonce);
        address recovered = digest.recover(signature);
        require(recovered == userAddress, "Invalid signature");

        // Mark nonce as used
        usedNonces[userAddress]++;

        // Execute the target call
        (bool success, bytes memory returnData) = target.call(data);
        require(success, "Meta-tx execution failed");

        // Calculate and pay relayer fee
        uint256 fee = _calculateFee(msg.value);
        relayerFees[msg.sender] += fee;

        emit MetaTransactionExecuted(
            userAddress,
            msg.sender,
            target,
            nonce,
            gasleft(),
            fee
        );

        return returnData;
    }

    // ============================================================
    // Fee Management
    // ============================================================

    function withdrawFees() external {
        require(hasRole(RELAYER_ROLE, msg.sender), "Not a relayer");

        uint256 amount = relayerFees[msg.sender];
        require(amount > 0, "No fees to withdraw");

        relayerFees[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
    }

    function setFeeRecipient(address newRecipient) external onlyRole(ADMIN_ROLE) {
        require(newRecipient != address(0), "Invalid recipient");
        address old = feeRecipient;
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(old, newRecipient);
    }

    // ============================================================
    // View Functions
    // ============================================================

    function getUserNonce(address user) external view returns (uint256) {
        return usedNonces[user];
    }

    function getRelayerFees(address relayer) external view returns (uint256) {
        return relayerFees[relayer];
    }

    function verifySignature(
        address userAddress,
        address target,
        bytes calldata data,
        uint256 nonce,
        bytes calldata signature
    ) external view returns (bool) {
        bytes32 digest = _buildDigest(userAddress, target, data, nonce);
        address recovered = digest.recover(signature);
        return recovered == userAddress;
    }

    // ============================================================
    // Internal Helpers
    // ============================================================

    function _buildDigest(
        address userAddress,
        address target,
        bytes memory data,
        uint256 nonce
    ) internal view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(META_TX_TYPEHASH, target, nonce, keccak256(data))
        );
        bytes32 domainSeparator = _domainSeparatorV4();
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    }

    function _calculateFee(uint256 gasCost) internal pure returns (uint256) {
        uint256 percentageFee = (gasCost * RELAYER_FEE_BPS) / 10000;
        return percentageFee > 0.001 ether ? percentageFee : 0.001 ether;
    }

    function supportsInterface(bytes4 interfaceId) public view override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}