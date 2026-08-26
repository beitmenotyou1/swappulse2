// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IBridgeable
 * @notice Interface for bridge-compatible NFT contracts.
 *         Defines the bridgeMint and bridgeBurn functions that
 *         the PulseChainBridge contract calls.
 */

interface IBridgeableCard {
    function bridgeMint(
        address to,
        string calldata cardId,
        string calldata variant,
        uint256 amount
    ) external;

    function bridgeBurn(
        address from,
        string calldata cardId,
        string calldata variant,
        uint256 amount
    ) external;
}

interface IBridgeableUsername {
    function bridgeMint(
        address to,
        string calldata username,
        string calldata did,
        uint256 originalTokenId
    ) external returns (uint256);

    function bridgeBurn(uint256 tokenId) external;
}