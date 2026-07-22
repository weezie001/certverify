// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title CertificateRegistry
/// @notice ONE shared on-chain registry for MANY universities. A certificate is keyed by
///         its SHA-256 hash; the stored record carries the issuing institution's wallet,
///         so verifying any hash automatically reveals which university issued it — no
///         university selector is ever needed.
/// @dev    On-chain we store ONLY: cert hash, issuing institution identity, timestamp,
///         validity status. All personal/sensitive data lives off-chain (MySQL). Never
///         pass personal data into a transaction — calldata is permanent and public.
contract CertificateRegistry {
    /// @notice Platform administrator. Set once at deployment; only this address may
    ///         register institutions.
    address public immutable admin;

    struct Institution {
        string name;
        bool registered;
    }

    struct Certificate {
        address issuer; // institution wallet that issued this certificate
        uint64 issuedAt; // block timestamp at issuance
        bool revoked;
        bool exists;
    }

    /// @notice wallet => institution record (authorized issuers)
    mapping(address => Institution) public institutions;

    /// @notice certificate SHA-256 hash => certificate record
    mapping(bytes32 => Certificate) public certificates;

    event InstitutionRegistered(address indexed wallet, string name);
    event CertificateIssued(bytes32 indexed certHash, address indexed issuer, uint256 issuedAt);
    event CertificateRevoked(bytes32 indexed certHash, address indexed issuer, uint256 revokedAt);

    error NotAdmin();
    error NotRegisteredInstitution();
    error AlreadyRegistered();
    error EmptyName();
    error ZeroAddress();
    error InvalidHash();
    error CertificateExists();
    error CertificateNotFound();
    error NotIssuer();
    error AlreadyRevoked();

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    /// @dev Only wallets the admin has registered may pass.
    modifier onlyRegistered() {
        if (!institutions[msg.sender].registered) revert NotRegisteredInstitution();
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    /// @notice Admin registers/approves a university by wallet address.
    /// @dev Approval of legitimacy happens off-system; this only grants issuing rights.
    function registerInstitution(address wallet, string calldata name) external onlyAdmin {
        if (wallet == address(0)) revert ZeroAddress();
        if (bytes(name).length == 0) revert EmptyName();
        if (institutions[wallet].registered) revert AlreadyRegistered();

        institutions[wallet] = Institution({name: name, registered: true});
        emit InstitutionRegistered(wallet, name);
    }

    /// @notice A registered institution records a certificate by its SHA-256 hash.
    /// @dev The hash is computed off-chain from the canonical preimage (see CLAUDE.md).
    function issueCertificate(bytes32 certHash) external onlyRegistered {
        if (certHash == bytes32(0)) revert InvalidHash();
        if (certificates[certHash].exists) revert CertificateExists();

        certificates[certHash] = Certificate({
            issuer: msg.sender,
            issuedAt: uint64(block.timestamp),
            revoked: false,
            exists: true
        });
        emit CertificateIssued(certHash, msg.sender, block.timestamp);
    }

    /// @notice Only the institution that issued a certificate may revoke it.
    ///         Not other institutions, and not the admin.
    function revokeCertificate(bytes32 certHash) external {
        Certificate storage c = certificates[certHash];
        if (!c.exists) revert CertificateNotFound();
        if (c.issuer != msg.sender) revert NotIssuer();
        if (c.revoked) revert AlreadyRevoked();

        c.revoked = true;
        emit CertificateRevoked(certHash, msg.sender, block.timestamp);
    }

    /// @notice Public, no-auth verification for any registered university's certificate.
    /// @dev    Returns the issuing institution automatically. The backend still RECOMPUTES
    ///         the hash from off-chain details and compares to `certHash` before trusting
    ///         the displayed data — this view only attests on-chain status.
    /// @return isValid         true iff the certificate exists and is not revoked
    /// @return issuer          wallet of the issuing institution
    /// @return institutionName human-readable name of the issuing institution
    /// @return issuedAt        issuance timestamp
    /// @return revoked         whether it has been revoked
    /// @return exists          whether any record exists for this hash
    function verifyCertificate(bytes32 certHash)
        external
        view
        returns (
            bool isValid,
            address issuer,
            string memory institutionName,
            uint256 issuedAt,
            bool revoked,
            bool exists
        )
    {
        Certificate storage c = certificates[certHash];
        exists = c.exists;
        issuer = c.issuer;
        revoked = c.revoked;
        issuedAt = c.issuedAt;
        institutionName = institutions[c.issuer].name;
        isValid = c.exists && !c.revoked;
    }

    /// @notice SHA-256 of a canonical preimage using the on-chain precompile.
    /// @dev    Call as a VIEW (eth_call) only. Used by tests and as a recompute oracle.
    ///         NEVER pass real personal data here inside a transaction.
    function computeHash(string calldata preimage) external pure returns (bytes32) {
        return sha256(bytes(preimage));
    }
}
