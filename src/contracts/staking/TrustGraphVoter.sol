// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title TrustGraphVoter
 * @author SwapPulse / Michael Burgess
 * @notice On-chain voting system for trust score adjustments.
 *
 * Allows community members with trust score >= 70 to vote on
 * trust score proposals for other users. Votes are weighted
 * by voter's own trust score.
 *
 * Voting Mechanics:
 * - Proposals submitted by trusted users (trust >= 70)
 * - 7-day voting period
 * - Minimum 5 votes required
 * - Majority required (>50%)
 * - Auto-applies approved changes
 *
 * @dev Uses OpenZeppelin v5 AccessControl, Pausable.
 *      Note: Foundry's `vm` cheatcode is NOT available in production contracts.
 *      Voters and proposers must pass their own username NFT tokenId directly.
 */

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface IUsernameNFT {
    function getTrustScore(uint256 tokenId) external view returns (uint8);
    function updateTrustScore(uint256 tokenId, uint8 newScore) external;
}

contract TrustGraphVoter is AccessControl, Pausable {
    // ============================================================
    // Roles
    // ============================================================

    bytes32 public constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");

    // ============================================================
    // Constants
    // ============================================================

    uint256 public constant MIN_VOTER_SCORE = 70;
    uint256 public constant VOTING_PERIOD = 7 days;
    uint256 public constant MIN_VOTES_REQUIRED = 5;

    // ============================================================
    // Storage
    // ============================================================

    address public usernameNFT;
    mapping(uint256 => VoteProposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    uint256 public proposalCount;

    struct VoteProposal {
        address targetUser;
        uint256 targetTokenId;
        uint8 proposedScore;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 createdAt;
        uint256 endsAt;
        bool executed;
        uint256 voterCount;
    }

    // ============================================================
    // Events
    // ============================================================

    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, address indexed targetUser, uint256 tokenId, uint8 proposedScore, uint256 endsAt);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint8 voterWeight);
    event ProposalExecuted(uint256 indexed proposalId, address indexed targetUser, uint8 newScore, uint256 timestamp);

    // ============================================================
    // Constructor
    // ============================================================

    constructor(address admin, address _usernameNFT) {
        require(admin != address(0), "Admin cannot be zero");
        require(_usernameNFT != address(0), "Username NFT cannot be zero");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PROPOSER_ROLE, admin);

        usernameNFT = _usernameNFT;
    }

    // ============================================================
    // Proposal Creation
    // ============================================================

    /**
     * @notice Creates a trust score adjustment proposal.
     * @param targetUser Address whose trust score will change
     * @param targetTokenId Token ID containing current trust score
     * @param proposedScore New proposed score (0-100)
     * @param proposerTokenId The proposer's own username NFT tokenId (for trust verification)
     */
    function createProposal(
        address targetUser,
        uint256 targetTokenId,
        uint8 proposedScore,
        uint256 proposerTokenId
    ) external onlyRole(PROPOSER_ROLE) whenNotPaused returns (uint256) {
        require(proposedScore <= 100, "Score must be 0-100");
        require(targetUser != address(0), "Invalid target");

        uint8 proposerScore = IUsernameNFT(usernameNFT).getTrustScore(proposerTokenId);
        require(proposerScore >= MIN_VOTER_SCORE, "Proposer trust too low");

        uint256 proposalId = proposalCount++;

        proposals[proposalId] = VoteProposal({
            targetUser: targetUser,
            targetTokenId: targetTokenId,
            proposedScore: proposedScore,
            yesVotes: 0,
            noVotes: 0,
            createdAt: block.timestamp,
            endsAt: block.timestamp + VOTING_PERIOD,
            executed: false,
            voterCount: 0
        });

        emit ProposalCreated(proposalId, msg.sender, targetUser, targetTokenId, proposedScore, block.timestamp + VOTING_PERIOD);

        return proposalId;
    }

    // ============================================================
    // Voting
    // ============================================================

    /**
     * @notice Cast a vote on a proposal.
     * @param proposalId The proposal ID
     * @param support true for yes, false for no
     * @param voterTokenId The voter's own username NFT tokenId (for trust verification)
     */
    function vote(uint256 proposalId, bool support, uint256 voterTokenId) external whenNotPaused {
        VoteProposal storage proposal = proposals[proposalId];
        require(block.timestamp < proposal.endsAt, "Voting ended");
        require(!hasVoted[proposalId][msg.sender], "Already voted");
        require(!proposal.executed, "Already executed");

        uint8 voterScore = IUsernameNFT(usernameNFT).getTrustScore(voterTokenId);
        require(voterScore >= MIN_VOTER_SCORE, "Voter trust too low");

        hasVoted[proposalId][msg.sender] = true;
        proposal.voterCount++;

        if (support) {
            proposal.yesVotes += 1;
        } else {
            proposal.noVotes += 1;
        }

        emit VoteCast(proposalId, msg.sender, support, voterScore);
    }

    // ============================================================
    // Execution
    // ============================================================

    function executeProposal(uint256 proposalId) external whenNotPaused {
        VoteProposal storage proposal = proposals[proposalId];
        require(block.timestamp >= proposal.endsAt, "Voting not ended");
        require(!proposal.executed, "Already executed");
        require(proposal.voterCount >= MIN_VOTES_REQUIRED, "Insufficient votes");
        require(proposal.yesVotes > proposal.noVotes, "Proposal failed");

        IUsernameNFT(usernameNFT).updateTrustScore(proposal.targetTokenId, proposal.proposedScore);

        proposal.executed = true;

        emit ProposalExecuted(proposalId, proposal.targetUser, proposal.proposedScore, block.timestamp);
    }

    // ============================================================
    // View Functions
    // ============================================================

    function getProposal(uint256 proposalId) external view returns (VoteProposal memory) {
        return proposals[proposalId];
    }

    function hasVotedOnProposal(uint256 proposalId, address voter) external view returns (bool) {
        return hasVoted[proposalId][voter];
    }

    function getActiveProposals() external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < proposalCount; i++) {
            if (block.timestamp < proposals[i].endsAt && !proposals[i].executed) {
                count++;
            }
        }

        uint256[] memory active = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < proposalCount; i++) {
            if (block.timestamp < proposals[i].endsAt && !proposals[i].executed) {
                active[idx++] = i;
            }
        }

        return active;
    }

    // ============================================================
    // Admin Functions
    // ============================================================

    function pause() external onlyRole(ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(ADMIN_ROLE) { _unpause(); }

    function grantProposerRole(address proposer) external onlyRole(ADMIN_ROLE) {
        _grantRole(PROPOSER_ROLE, proposer);
    }

    function revokeProposerRole(address proposer) external onlyRole(ADMIN_ROLE) {
        _revokeRole(PROPOSER_ROLE, proposer);
    }

    function supportsInterface(bytes4 interfaceId) public view override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}