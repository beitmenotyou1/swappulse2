// Solidity source + compiler metadata for every SwapPulse contract, used by
// the verify-contract backend function to submit source code to block
// explorers (Polygonscan / Etherscan) for verification.
//
// Contracts marked `autoVerifiable: true` are self-contained (no imports) and
// can be submitted as a single file via the Etherscan verifysourcecode API.
// Contracts with OpenZeppelin imports are marked `autoVerifiable: false` —
// they require standard-json-input or flattened source, so the verify-
// contract function returns a manual-verification link instead.

export interface ContractSourceMeta {
  contract_key: string;
  contract_name: string;
  source: string;
  compiler_version: string;
  optimizer_runs: number;
  via_ir: boolean;
  license_type: number; // Etherscan license ID (13 = AGPL-3.0, 3 = MIT)
  // Constructor ABI types for encoding constructor args (empty = no args)
  constructor_types: string[];
  // Whether the source is self-contained (no imports) and can be submitted
  // as a single file. false = needs standard-json-input (manual verification).
  auto_verifiable: boolean;
}

// Etherscan license type IDs:
// 3 = MIT, 13 = AGPL-3.0-only, 1 = None
const LICENSE_AGPL = 13;
const LICENSE_MIT = 3;

// Default compiler version for all SwapPulse contracts (from bytecode metadata).
const SOLC_VERSION = 'v0.8.36+commit.8116a5e';

// --- Polygon contracts (self-contained, no imports — auto-verifiable) ---

const POLYGON_USERNAME_SOURCE = `
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

    function transferFrom(address, address, uint256) public pure {
        revert("Soulbound: non-transferable");
    }

    function safeTransferFrom(address, address, uint256) public pure {
        revert("Soulbound: non-transferable");
    }
}
`.trim();

const POLYGON_CARD_SOURCE = `
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
`.trim();

// --- Source registry ---
// auto_verifiable = false for contracts with OpenZeppelin imports — they need
// standard-json-input (flattened source with all imported files), which can't
// be assembled from the source file alone. The verify-contract function
// returns a manual-verification link for these.

export const CONTRACT_SOURCES: Record<string, ContractSourceMeta> = {
  polygon_username: {
    contract_key: 'polygon_username',
    contract_name: 'SwapPulseUsername',
    source: POLYGON_USERNAME_SOURCE,
    compiler_version: SOLC_VERSION,
    optimizer_runs: 200,
    via_ir: false,
    license_type: LICENSE_AGPL,
    constructor_types: [],
    auto_verifiable: true,
  },
  polygon_card: {
    contract_key: 'polygon_card',
    contract_name: 'SwapPulseCardNFT',
    source: POLYGON_CARD_SOURCE,
    compiler_version: SOLC_VERSION,
    optimizer_runs: 200,
    via_ir: false,
    license_type: LICENSE_AGPL,
    constructor_types: ['address'],
    auto_verifiable: true,
  },
  // The following contracts use OpenZeppelin imports and need standard-json-input
  // for verification. The verify-contract function returns a manual link.
  polygon_bridge: {
    contract_key: 'polygon_bridge',
    contract_name: 'PolygonBridge',
    source: '',
    compiler_version: SOLC_VERSION,
    optimizer_runs: 200,
    via_ir: false,
    license_type: LICENSE_MIT,
    constructor_types: [],
    auto_verifiable: false,
  },
  pulse_username: {
    contract_key: 'pulse_username',
    contract_name: 'SwapPulseUsernameV2',
    source: '',
    compiler_version: SOLC_VERSION,
    optimizer_runs: 200,
    via_ir: false,
    license_type: LICENSE_MIT,
    constructor_types: ['address', 'string'],
    auto_verifiable: false,
  },
  pulse_card: {
    contract_key: 'pulse_card',
    contract_name: 'SwapPulseCardNFTV2',
    source: '',
    compiler_version: SOLC_VERSION,
    optimizer_runs: 200,
    via_ir: false,
    license_type: LICENSE_MIT,
    constructor_types: ['address'],
    auto_verifiable: false,
  },
  pulse_bridge: {
    contract_key: 'pulse_bridge',
    contract_name: 'PulseChainBridge',
    source: '',
    compiler_version: SOLC_VERSION,
    optimizer_runs: 200,
    via_ir: false,
    license_type: LICENSE_MIT,
    constructor_types: ['address'],
    auto_verifiable: false,
  },
  polygon_token: {
    contract_key: 'polygon_token',
    contract_name: 'PulseToken',
    source: '',
    compiler_version: SOLC_VERSION,
    optimizer_runs: 200,
    via_ir: false,
    license_type: LICENSE_MIT,
    constructor_types: ['address', 'address', 'uint256'],
    auto_verifiable: false,
  },
  pulse_token: {
    contract_key: 'pulse_token',
    contract_name: 'PulseToken',
    source: '',
    compiler_version: SOLC_VERSION,
    optimizer_runs: 200,
    via_ir: false,
    license_type: LICENSE_MIT,
    constructor_types: ['address', 'address', 'uint256'],
    auto_verifiable: false,
  },
  oft_polygon: {
    contract_key: 'oft_polygon',
    contract_name: 'OFTPulseToken',
    source: '',
    compiler_version: SOLC_VERSION,
    optimizer_runs: 200,
    via_ir: true,
    license_type: LICENSE_MIT,
    constructor_types: ['address', 'address'],
    auto_verifiable: false,
  },
  card_metadata_anchor: {
    contract_key: 'card_metadata_anchor',
    contract_name: 'CardMetadataAnchor',
    source: '',
    compiler_version: SOLC_VERSION,
    optimizer_runs: 200,
    via_ir: false,
    license_type: LICENSE_MIT,
    constructor_types: [],
    auto_verifiable: false,
  },
};

// Explorer API base URLs for each chain (Etherscan family).
export function getExplorerApiBase(chain: string): string {
  if (chain === 'polygon') return 'https://api.polygonscan.com/api';
  if (chain === 'pulse') return ''; // PulseChain explorer — no public verification API
  return 'https://api.etherscan.io/api';
}

// Explorer site base URLs for manual verification / token profile links.
export function getExplorerSiteBase(chain: string, explorerUrl?: string): string {
  if (chain === 'polygon') return 'https://polygonscan.com';
  if (chain === 'pulse') return explorerUrl || '';
  return 'https://etherscan.io';
}