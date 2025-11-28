// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title VaultAudit
 * @dev Blockchain-based audit logging for BlockPass password vault with IPFS integration
 * @notice This contract stores tamper-proof hashes and IPFS CIDs of encrypted vault states
 */
contract VaultAudit {
    // Event emitted when a vault hash is logged
    event VaultLogged(
        bytes32 indexed vaultHash,
        address indexed user,
        uint256 timestamp,
        string operation,
        string ipfsCID
    );

    // Struct to store audit log details
    struct AuditLog {
        bytes32 vaultHash;
        address user;
        uint256 timestamp;
        string operation;
        string ipfsCID;        // IPFS Content Identifier for decentralized backup
    }

    // Mapping from user address to their audit logs
    mapping(address => AuditLog[]) public userAuditLogs;

    // Total number of audit logs
    uint256 public totalLogs;

    /**
     * @dev Log a vault hash to the blockchain (legacy function without IPFS)
     * @param _hash Keccak256 hash of the encrypted vault
     * @param _operation Type of operation (e.g., "save", "update", "delete")
     */
    function logVault(bytes32 _hash, string memory _operation) external {
        logVaultWithCID(_hash, "", _operation);
    }

    /**
     * @dev Log a vault hash with IPFS CID to the blockchain
     * @param _hash Keccak256 hash of the encrypted vault
     * @param _ipfsCID IPFS Content Identifier where encrypted vault is stored
     * @param _operation Type of operation (e.g., "password_added", "password_deleted", etc.)
     */
    function logVaultWithCID(bytes32 _hash, string memory _ipfsCID, string memory _operation) public {
        require(_hash != bytes32(0), "Hash cannot be zero");
        require(bytes(_operation).length > 0, "Operation cannot be empty");

        AuditLog memory newLog = AuditLog({
            vaultHash: _hash,
            user: msg.sender,
            timestamp: block.timestamp,
            operation: _operation,
            ipfsCID: _ipfsCID
        });

        userAuditLogs[msg.sender].push(newLog);
        totalLogs++;

        emit VaultLogged(_hash, msg.sender, block.timestamp, _operation, _ipfsCID);
    }

    /**
     * @dev Get the number of audit logs for a user
     * @param _user Address of the user
     * @return Number of audit logs
     */
    function getUserLogCount(address _user) external view returns (uint256) {
        return userAuditLogs[_user].length;
    }

    /**
     * @dev Get a specific audit log for a user
     * @param _user Address of the user
     * @param _index Index of the log
     * @return AuditLog struct with vault hash, timestamp, operation, and IPFS CID
     */
    function getUserLog(address _user, uint256 _index)
        external
        view
        returns (AuditLog memory)
    {
        require(_index < userAuditLogs[_user].length, "Index out of bounds");
        return userAuditLogs[_user][_index];
    }

    /**
     * @dev Get all audit logs for a user
     * @param _user Address of the user
     * @return Array of AuditLog structs
     */
    function getUserLogs(address _user)
        external
        view
        returns (AuditLog[] memory)
    {
        return userAuditLogs[_user];
    }

    /**
     * @dev Verify if a hash exists in user's audit log
     * @param _user Address of the user
     * @param _hash Hash to verify
     * @return bool True if hash exists
     */
    function verifyHash(address _user, bytes32 _hash)
        external
        view
        returns (bool)
    {
        AuditLog[] memory logs = userAuditLogs[_user];
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].vaultHash == _hash) {
                return true;
            }
        }
        return false;
    }

    /**
     * @dev Get the latest audit log for a user (includes IPFS CID for recovery)
     * @param _user Address of the user
     * @return AuditLog struct with all details including IPFS CID
     */
    function getLatestLog(address _user)
        external
        view
        returns (AuditLog memory)
    {
        require(userAuditLogs[_user].length > 0, "No logs found");
        return userAuditLogs[_user][userAuditLogs[_user].length - 1];
    }

    /**
     * @dev Get IPFS CID from the latest log (for vault recovery)
     * @param _user Address of the user
     * @return string IPFS CID where encrypted vault can be retrieved
     */
    function getLatestIPFSCID(address _user)
        external
        view
        returns (string memory)
    {
        require(userAuditLogs[_user].length > 0, "No logs found");
        return userAuditLogs[_user][userAuditLogs[_user].length - 1].ipfsCID;
    }
}
