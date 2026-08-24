// Solidity contract sources for SwapPulse's Polygon NFT layer.
// These are compiled at deploy time by the deploy-polygon-contracts backend
// function using the solc npm package. Self-contained (no imports) so solc
// can compile without filesystem access in the edge runtime.

// SwapPulseUsername — soulbound (non-transferable) ERC-721 that embeds the
// collector's SwapPulse handle and a reference to their AT Protocol DID.
// One token per wallet; minting is admin-gated (only the platform wallet).
export const USERNAME_CONTRACT_SOURCE = `
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

    // Soulbound: all transfers revert
    function transferFrom(address, address, uint256) public pure {
        revert("Soulbound: non-transferable");
    }

    function safeTransferFrom(address, address, uint256) public pure {
        revert("Soulbound: non-transferable");
    }
}
`;

// SwapPulseCardNFT — transferable ERC-721 that references TCGDex card data.
// Minted manually from a CollectionEntry or automatically on trade/sale
// completion. The minter's username token ID is linked for provenance.
export const CARD_CONTRACT_SOURCE = `
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