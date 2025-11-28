/**
 * IPFS Integration for BlockPass using Pinata
 * 
 * This module provides decentralized backup storage for encrypted vaults.
 * Uses Pinata API for permanent, decentralized IPFS storage.
 * 
 * Privacy: Only encrypted vault data is uploaded. CID is stored on blockchain.
 * 
 * Pinata Console: https://app.pinata.cloud/
 * Get API Key: https://app.pinata.cloud/developers/api-keys
 * 
 * @version 1.0.1 - Updated to Pinata from Storacha
 * @updated 2025-11-28
 */

console.log('🔧 IPFS Module v1.0.1 - Pinata Edition LOADED');

// IPFS Configuration - PINATA ONLY
const IPFS_CONFIG = {
    enabled: false,
    pinataJWT: '', // User configures in settings (Pinata JWT token)
    apiEndpoint: 'https://api.pinata.cloud', // PINATA API
    gatewayUrl: 'https://gateway.pinata.cloud/ipfs' // Pinata's IPFS gateway
};

console.log('🌐 IPFS Config initialized:', { 
    apiEndpoint: IPFS_CONFIG.apiEndpoint,
    gatewayUrl: IPFS_CONFIG.gatewayUrl 
});

/**
 * Initialize IPFS configuration from storage
 */
async function initIPFSConfig() {
    try {
        const result = await chrome.storage.local.get(['ipfs-config']);
        if (result['ipfs-config']) {
            Object.assign(IPFS_CONFIG, result['ipfs-config']);
            console.log('IPFS config loaded from storage');
        }
    } catch (error) {
        console.error('Error loading IPFS config:', error);
    }
}

/**
 * Check if IPFS backup is enabled and configured
 */
function isIPFSEnabled() {
    return IPFS_CONFIG.enabled && 
           IPFS_CONFIG.pinataJWT !== '';
}

/**
 * Enable IPFS backup with Pinata JWT
 * @param {string} token - Pinata JWT token
 */
async function enableIPFSBackup(token) {
    IPFS_CONFIG.enabled = true;
    IPFS_CONFIG.pinataJWT = token;
    
    // Save to storage
    await chrome.storage.local.set({
        'ipfs-config': IPFS_CONFIG
    });
    
    console.log('✅ IPFS backup enabled');
    return { success: true };
}

/**
 * Disable IPFS backup
 */
async function disableIPFSBackup() {
    IPFS_CONFIG.enabled = false;
    
    await chrome.storage.local.set({
        'ipfs-config': IPFS_CONFIG
    });
    
    console.log('⚠️ IPFS backup disabled');
}

/**
 * Upload encrypted vault to IPFS via Pinata
 * @param {Object} encryptedVault - The encrypted vault object {ciphertext, iv, salt}
 * @returns {Promise<{success: boolean, cid?: string, error?: string}>}
 */
async function uploadToIPFS(encryptedVault) {
    if (!isIPFSEnabled()) {
        return { success: false, error: 'IPFS not enabled' };
    }

    try {
        console.log('📤 Uploading vault to Pinata IPFS...');
        console.log('🔗 Using endpoint:', IPFS_CONFIG.apiEndpoint);

        // Convert encrypted vault to Blob
        const vaultJSON = JSON.stringify(encryptedVault);
        const blob = new Blob([vaultJSON], { type: 'application/json' });
        
        // Create File object with metadata
        const file = new File([blob], 'blockpass-vault.enc', {
            type: 'application/json',
            lastModified: Date.now()
        });

        // Create FormData for upload
        const formData = new FormData();
        formData.append('file', file);
        
        // Add Pinata metadata
        const metadata = JSON.stringify({
            name: `BlockPass-Vault-${Date.now()}`,
            keyvalues: {
                app: 'BlockPass',
                type: 'encrypted-vault'
            }
        });
        formData.append('pinataMetadata', metadata);

        // PINATA API ENDPOINT
        const uploadUrl = `${IPFS_CONFIG.apiEndpoint}/pinning/pinFileToIPFS`;
        console.log('🚀 Uploading to:', uploadUrl);

        // Upload to Pinata
        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${IPFS_CONFIG.pinataJWT}`
            },
            body: formData
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Upload failed: ${response.status} ${error}`);
        }

        const result = await response.json();
        const cid = result.IpfsHash; // Pinata returns IpfsHash

        console.log('✅ Vault uploaded to Pinata IPFS');
        console.log('📦 CID:', cid);
        console.log('🔗 Gateway URL:', `${IPFS_CONFIG.gatewayUrl}/${cid}`);
        console.log('🔗 Pinata Console:', 'https://app.pinata.cloud/');

        // Store CID as local backup
        await chrome.storage.local.set({
            'ipfs-last-cid': cid,
            'ipfs-last-backup': new Date().toISOString()
        });

        return {
            success: true,
            cid: cid,
            gatewayUrl: `${IPFS_CONFIG.gatewayUrl}/${cid}`,
            timestamp: Date.now()
        };

    } catch (error) {
        console.error('❌ IPFS upload error:', error);
        return {
            success: false,
            error: error.message || 'Unknown IPFS upload error'
        };
    }
}

/**
 * Download encrypted vault from IPFS by CID
 * @param {string} cid - IPFS Content Identifier
 * @returns {Promise<{success: boolean, vault?: Object, error?: string}>}
 */
async function downloadFromIPFS(cid) {
    if (!cid || typeof cid !== 'string') {
        return { success: false, error: 'Invalid CID' };
    }

    try {
        console.log('📥 Downloading vault from IPFS...');
        console.log('📦 CID:', cid);

        // Fetch from IPFS gateway
        const gatewayUrl = `${IPFS_CONFIG.gatewayUrl}/${cid}`;
        const response = await fetch(gatewayUrl);

        if (!response.ok) {
            throw new Error(`Download failed: ${response.status} ${response.statusText}`);
        }

        const encryptedVault = await response.json();

        // Validate vault structure
        if (!encryptedVault.ciphertext || !encryptedVault.iv) {
            throw new Error('Invalid vault format from IPFS');
        }

        console.log('✅ Vault downloaded from IPFS');

        return {
            success: true,
            vault: encryptedVault
        };

    } catch (error) {
        console.error('❌ IPFS download error:', error);
        return {
            success: false,
            error: error.message || 'Unknown IPFS download error'
        };
    }
}

/**
 * Test IPFS connection with Pinata
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
async function testIPFSConnection() {
    if (!IPFS_CONFIG.pinataJWT) {
        return { success: false, error: 'No JWT token configured' };
    }

    try {
        // Test connection by checking authentication
        const response = await fetch(`${IPFS_CONFIG.apiEndpoint}/data/testAuthentication`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${IPFS_CONFIG.pinataJWT}`
            }
        });

        if (!response.ok) {
            throw new Error(`Connection failed: ${response.status}`);
        }

        const result = await response.json();
        return {
            success: true,
            message: `✅ Connected to Pinata successfully! (${result.message || 'Authenticated'})`
        };

    } catch (error) {
        return {
            success: false,
            error: error.message || 'Connection test failed'
        };
    }
}

/**
 * Get list of user's uploads from Pinata
 * @returns {Promise<Array>}
 */
async function listIPFSBackups() {
    if (!isIPFSEnabled()) {
        return [];
    }

    try {
        // List pins from Pinata
        const response = await fetch(`${IPFS_CONFIG.apiEndpoint}/data/pinList?status=pinned&metadata[keyvalues][app]=BlockPass&pageLimit=10`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${IPFS_CONFIG.pinataJWT}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to list uploads: ${response.status}`);
        }
        
        const data = await response.json();
        return data.rows || [];

    } catch (error) {
        console.error('Error listing IPFS backups:', error);
        return [];
    }
}

/**
 * Get the last backup CID from local storage
 * @returns {Promise<{cid: string, timestamp: string} | null>}
 */
async function getLastBackupInfo() {
    try {
        const result = await chrome.storage.local.get(['ipfs-last-cid', 'ipfs-last-backup']);
        if (result['ipfs-last-cid']) {
            return {
                cid: result['ipfs-last-cid'],
                timestamp: result['ipfs-last-backup'] || 'Unknown'
            };
        }
        return null;
    } catch (error) {
        console.error('Error getting last backup info:', error);
        return null;
    }
}

/**
 * Clear local backup info (useful after successful recovery)
 */
async function clearBackupInfo() {
    try {
        await chrome.storage.local.remove(['ipfs-last-cid', 'ipfs-last-backup']);
        console.log('Backup info cleared');
    } catch (error) {
        console.error('Error clearing backup info:', error);
    }
}

// Auto-initialize on load
if (typeof chrome !== 'undefined' && chrome.storage) {
    initIPFSConfig();
}

// Export for testing in Node.js environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        uploadToIPFS,
        downloadFromIPFS,
        enableIPFSBackup,
        disableIPFSBackup,
        isIPFSEnabled,
        testIPFSConnection,
        listIPFSBackups,
        getLastBackupInfo,
        clearBackupInfo,
        IPFS_CONFIG
    };
}
