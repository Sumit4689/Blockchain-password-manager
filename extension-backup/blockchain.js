/**
 * Blockchain Integration for BlockPass
 * 
 * This module provides blockchain-based audit logging using the VaultAudit smart contract.
 * It logs encrypted vault hashes to ensure tamper-proof verification.
 */

// Contract configuration (update these after deployment)
const BLOCKCHAIN_CONFIG = {
    enabled: false, // Set to true after deploying contract and configuring
    contractAddress: "0x0000000000000000000000000000000000000000", // UPDATE with deployed address
    rpcUrl: "http://127.0.0.1:7545", // Ganache RPC URL
    privateKey: "", // UPDATE with your Ganache account private key (without 0x prefix)
};

// Contract ABI (Application Binary Interface)
const CONTRACT_ABI = [
    "event VaultLogged(bytes32 indexed vaultHash, address indexed user, uint256 timestamp, string operation, string ipfsCID)",
    "function logVault(bytes32 _hash, string memory _operation) external",
    "function logVaultWithCID(bytes32 _hash, string memory _ipfsCID, string memory _operation) public",
    "function getUserLogCount(address _user) external view returns (uint256)",
    "function getUserLog(address _user, uint256 _index) external view returns (tuple(bytes32 vaultHash, address user, uint256 timestamp, string operation, string ipfsCID) memory)",
    "function getUserLogs(address _user) external view returns (tuple(bytes32 vaultHash, address user, uint256 timestamp, string operation, string ipfsCID)[] memory)",
    "function verifyHash(address _user, bytes32 _hash) external view returns (bool)",
    "function getLatestLog(address _user) external view returns (tuple(bytes32 vaultHash, address user, uint256 timestamp, string operation, string ipfsCID) memory)",
    "function getLatestIPFSCID(address _user) external view returns (string memory)",
    "function totalLogs() external view returns (uint256)"
];

/**
 * Check if blockchain audit is enabled and configured
 */
function isBlockchainEnabled() {
    return BLOCKCHAIN_CONFIG.enabled && 
           BLOCKCHAIN_CONFIG.contractAddress !== "0x0000000000000000000000000000000000000000" &&
           BLOCKCHAIN_CONFIG.privateKey !== "";
}

/**
 * Log vault hash to blockchain
 * @param {string} encryptedVaultJSON - The encrypted vault JSON string
 * @param {string} operation - Operation type (e.g., "create", "save", "update", "delete")
 * @returns {Promise<{success: boolean, hash?: string, txHash?: string, error?: string}>}
 */
async function logVaultToBlockchain(encryptedVaultJSON, operation = "save") {
    return await logVaultWithIPFS(encryptedVaultJSON, "", operation);
}

/**
 * Log vault hash WITH IPFS CID to blockchain
 * @param {string} encryptedVaultJSON - The encrypted vault JSON string
 * @param {string} ipfsCID - IPFS Content Identifier (empty string if not using IPFS)
 * @param {string} operation - Operation type
 * @returns {Promise<{success: boolean, hash?: string, cid?: string, txHash?: string, error?: string}>}
 */
async function logVaultWithIPFS(encryptedVaultJSON, ipfsCID = "", operation = "save") {
    if (!isBlockchainEnabled()) {
        console.log('Blockchain audit disabled');
        return { success: false, error: 'Blockchain audit not enabled' };
    }

    try {
        // Check if ethers.js is loaded
        if (typeof ethers === 'undefined') {
            throw new Error('ethers.js not loaded. Please include it in your HTML.');
        }

        // Create provider (ethers v5 API)
        const provider = new ethers.providers.JsonRpcProvider(BLOCKCHAIN_CONFIG.rpcUrl);

        // Create wallet/signer
        const signer = new ethers.Wallet(BLOCKCHAIN_CONFIG.privateKey, provider);

        // Create contract instance
        const contract = new ethers.Contract(
            BLOCKCHAIN_CONFIG.contractAddress,
            CONTRACT_ABI,
            signer
        );

        // Hash the encrypted vault data
        const vaultHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(encryptedVaultJSON));

        console.log('📝 Logging to blockchain:', {
            operation,
            hash: vaultHash,
            ipfsCID: ipfsCID || '(none)',
            address: signer.address
        });

        // Send transaction (with or without IPFS CID)
        const tx = ipfsCID 
            ? await contract.logVaultWithCID(vaultHash, ipfsCID, operation)
            : await contract.logVault(vaultHash, operation);
            
        console.log('⏳ Transaction sent:', tx.hash);

        // Wait for confirmation
        const receipt = await tx.wait();
        console.log('✅ Transaction confirmed in block:', receipt.blockNumber);

        return {
            success: true,
            hash: vaultHash,
            cid: ipfsCID,
            txHash: tx.hash,
            blockNumber: receipt.blockNumber,
            timestamp: Date.now()
        };

    } catch (error) {
        console.error('❌ Blockchain logging error:', error);
        return {
            success: false,
            error: error.message || 'Unknown blockchain error'
        };
    }
}

/**
 * Get audit logs for current user
 * @returns {Promise<Array>} Array of audit logs
 */
async function getAuditLogs() {
    if (!isBlockchainEnabled()) {
        return [];
    }

    try {
        const provider = new ethers.providers.JsonRpcProvider(BLOCKCHAIN_CONFIG.rpcUrl);
        const signer = new ethers.Wallet(BLOCKCHAIN_CONFIG.privateKey, provider);
        const contract = new ethers.Contract(
            BLOCKCHAIN_CONFIG.contractAddress,
            CONTRACT_ABI,
            provider
        );

        // Validate signer address before querying
        if (!signer.address || !signer.address.startsWith('0x') || signer.address.length !== 42) {
            throw new Error('Invalid wallet address');
        }

        const logs = await contract.getUserLogs(signer.address);

        return logs.map(log => ({
            hash: log.vaultHash,
            user: log.user,
            timestamp: new Date(Number(log.timestamp) * 1000),
            operation: log.operation,
            ipfsCID: log.ipfsCID || ''
        }));

    } catch (error) {
        console.error('Error fetching audit logs:', error);
        return [];
    }
}

/**
 * Get the latest audit log
 * @returns {Promise<Object|null>} Latest audit log or null
 */
async function getLatestAuditLog() {
    if (!isBlockchainEnabled()) {
        return null;
    }

    try {
        const provider = new ethers.providers.JsonRpcProvider(BLOCKCHAIN_CONFIG.rpcUrl);
        const signer = new ethers.Wallet(BLOCKCHAIN_CONFIG.privateKey, provider);
        const contract = new ethers.Contract(
            BLOCKCHAIN_CONFIG.contractAddress,
            CONTRACT_ABI,
            provider
        );

        const log = await contract.getLatestLog(signer.address);

        return {
            hash: log.vaultHash,
            user: log.user,
            timestamp: new Date(Number(log.timestamp) * 1000),
            operation: log.operation,
            ipfsCID: log.ipfsCID || ''
        };

    } catch (error) {
        console.error('Error fetching latest log:', error);
        return null;
    }
}

/**
 * Verify a vault hash on blockchain
 * @param {string} vaultHash - Hash to verify
 * @returns {Promise<boolean>} True if hash exists on blockchain
 */
async function verifyVaultHash(vaultHash) {
    if (!isBlockchainEnabled()) {
        return false;
    }

    try {
        const provider = new ethers.providers.JsonRpcProvider(BLOCKCHAIN_CONFIG.rpcUrl);
        const signer = new ethers.Wallet(BLOCKCHAIN_CONFIG.privateKey, provider);
        const contract = new ethers.Contract(
            BLOCKCHAIN_CONFIG.contractAddress,
            CONTRACT_ABI,
            provider
        );

        return await contract.verifyHash(signer.address, vaultHash);

    } catch (error) {
        console.error('Error verifying hash:', error);
        return false;
    }
}

/**
 * Enable blockchain audit logging
 * @param {string} contractAddress - Deployed contract address
 * @param {string} privateKey - Ganache account private key
 */
function enableBlockchainAudit(contractAddress, privateKey) {
    BLOCKCHAIN_CONFIG.enabled = true;
    BLOCKCHAIN_CONFIG.contractAddress = contractAddress;
    BLOCKCHAIN_CONFIG.privateKey = privateKey;
    
    // Save to storage
    chrome.storage.local.set({
        'blockchain-config': BLOCKCHAIN_CONFIG
    });
    
    console.log('✅ Blockchain audit enabled');
}

/**
 * Disable blockchain audit logging
 */
function disableBlockchainAudit() {
    BLOCKCHAIN_CONFIG.enabled = false;
    
    chrome.storage.local.set({
        'blockchain-config': BLOCKCHAIN_CONFIG
    });
    
    console.log('⚠️ Blockchain audit disabled');
}

/**
 * Initialize blockchain configuration from storage
 */
async function initBlockchainConfig() {
    try {
        const result = await chrome.storage.local.get(['blockchain-config']);
        if (result['blockchain-config']) {
            Object.assign(BLOCKCHAIN_CONFIG, result['blockchain-config']);
            console.log('Blockchain config loaded from storage');
        }
    } catch (error) {
        console.error('Error loading blockchain config:', error);
    }
}

// Auto-initialize on load
if (typeof chrome !== 'undefined' && chrome.storage) {
    initBlockchainConfig();
}

// Export for testing in Node.js environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        logVaultToBlockchain,
        getAuditLogs,
        getLatestAuditLog,
        verifyVaultHash,
        enableBlockchainAudit,
        disableBlockchainAudit,
        isBlockchainEnabled,
        BLOCKCHAIN_CONFIG
    };
}
