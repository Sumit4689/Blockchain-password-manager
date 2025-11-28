// ===== CRYPTO UTILITIES FOR BLOCKPASS =====
// Uses Web Crypto API for AES-GCM encryption/decryption
// and PBKDF2 for key derivation from mnemonic

/**
 * Generate a cryptographically secure mnemonic phrase (12 words)
 * Using BIP39 wordlist subset for demo (in production, use full bip39 library)
 */
function generateMnemonic() {
    const wordlist = [
        'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract',
        'absurd', 'abuse', 'access', 'accident', 'account', 'accuse', 'achieve', 'acid',
        'acoustic', 'acquire', 'across', 'act', 'action', 'actor', 'actress', 'actual',
        'adapt', 'add', 'addict', 'address', 'adjust', 'admit', 'adult', 'advance',
        'advice', 'aerobic', 'affair', 'afford', 'afraid', 'again', 'age', 'agent',
        'agree', 'ahead', 'aim', 'air', 'airport', 'aisle', 'alarm', 'album',
        'alcohol', 'alert', 'alien', 'all', 'alley', 'allow', 'almost', 'alone',
        'alpha', 'already', 'also', 'alter', 'always', 'amateur', 'amazing', 'among',
        'amount', 'amused', 'analyst', 'anchor', 'ancient', 'anger', 'angle', 'angry',
        'animal', 'ankle', 'announce', 'annual', 'another', 'answer', 'antenna', 'antique',
        'anxiety', 'any', 'apart', 'apology', 'appear', 'apple', 'approve', 'april',
        'arch', 'arctic', 'area', 'arena', 'argue', 'arm', 'armed', 'armor',
        'army', 'around', 'arrange', 'arrest', 'arrive', 'arrow', 'art', 'artefact',
        'artist', 'artwork', 'ask', 'aspect', 'assault', 'asset', 'assist', 'assume',
        'asthma', 'athlete', 'atom', 'attack', 'attend', 'attitude', 'attract', 'auction',
        'author', 'auto', 'autumn', 'average', 'avocado', 'avoid', 'awake', 'aware',
        'away', 'awesome', 'awful', 'awkward', 'axis', 'baby', 'bachelor', 'bacon',
        'badge', 'bag', 'balance', 'balcony', 'ball', 'bamboo', 'banana', 'banner',
        'bar', 'barely', 'bargain', 'barrel', 'base', 'basic', 'basket', 'battle',
        'beach', 'bean', 'beauty', 'because', 'become', 'beef', 'before', 'begin',
        'behave', 'behind', 'believe', 'below', 'belt', 'bench', 'benefit', 'best',
        'betray', 'better', 'between', 'beyond', 'bicycle', 'bid', 'bike', 'bind',
        'biology', 'bird', 'birth', 'bitter', 'black', 'blade', 'blame', 'blanket',
        'blast', 'bleak', 'bless', 'blind', 'blood', 'blossom', 'blouse', 'blue',
        'blur', 'blush', 'board', 'boat', 'body', 'boil', 'bomb', 'bone',
        'bonus', 'book', 'boost', 'border', 'boring', 'borrow', 'boss', 'bottom',
        'bounce', 'box', 'boy', 'bracket', 'brain', 'brand', 'brass', 'brave',
        'bread', 'breeze', 'brick', 'bridge', 'brief', 'bright', 'bring', 'brisk',
        'broccoli', 'broken', 'bronze', 'broom', 'brother', 'brown', 'brush', 'bubble',
        'buddy', 'budget', 'buffalo', 'build', 'bulb', 'bulk', 'bullet', 'bundle',
        'bunker', 'burden', 'burger', 'burst', 'bus', 'business', 'busy', 'butter',
        'buyer', 'buzz', 'cabbage', 'cabin', 'cable', 'cactus', 'cage', 'cake'
    ];
    
    const words = [];
    const randomValues = new Uint32Array(12);
    window.crypto.getRandomValues(randomValues);
    
    for (let i = 0; i < 12; i++) {
        const index = randomValues[i] % wordlist.length;
        words.push(wordlist[index]);
    }
    
    return words.join(' ');
}

/**
 * Derive a CryptoKey from mnemonic using PBKDF2
 * @param {string} mnemonic - The mnemonic phrase
 * @param {string} salt - Salt for key derivation (default: 'blockpass-vault')
 * @returns {Promise<CryptoKey>} - Derived encryption key
 */
async function deriveMasterKey(mnemonic, salt = 'blockpass-vault') {
    const encoder = new TextEncoder();
    
    // Import the mnemonic as a key
    const mnemonicKey = await window.crypto.subtle.importKey(
        'raw',
        encoder.encode(mnemonic),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
    );
    
    // Derive the master key using PBKDF2
    const masterKey = await window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: encoder.encode(salt),
            iterations: 100000,
            hash: 'SHA-256'
        },
        mnemonicKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
    
    return masterKey;
}

/**
 * Encrypt data using AES-GCM
 * @param {string} plaintext - Data to encrypt
 * @param {CryptoKey} key - Encryption key
 * @returns {Promise<Object>} - Object with encrypted data and IV
 */
async function encryptData(plaintext, key) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    
    // Generate a random IV (Initialization Vector)
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt the data
    const encryptedData = await window.crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: iv
        },
        key,
        data
    );
    
    // Return encrypted data and IV (both as base64 for storage)
    return {
        ciphertext: arrayBufferToBase64(encryptedData),
        iv: arrayBufferToBase64(iv)
    };
}

/**
 * Decrypt data using AES-GCM
 * @param {string} ciphertext - Base64 encoded encrypted data
 * @param {string} ivBase64 - Base64 encoded IV
 * @param {CryptoKey} key - Decryption key
 * @returns {Promise<string>} - Decrypted plaintext
 */
async function decryptData(ciphertext, ivBase64, key) {
    const decoder = new TextDecoder();
    
    // Convert base64 back to ArrayBuffer
    const encryptedData = base64ToArrayBuffer(ciphertext);
    const iv = base64ToArrayBuffer(ivBase64);
    
    // Decrypt the data
    const decryptedData = await window.crypto.subtle.decrypt(
        {
            name: 'AES-GCM',
            iv: iv
        },
        key,
        encryptedData
    );
    
    return decoder.decode(decryptedData);
}

/**
 * Encrypt a password entry
 * @param {string} password - Password to encrypt
 * @param {CryptoKey} masterKey - Master encryption key
 * @returns {Promise<Object>} - Encrypted password object
 */
async function encryptPassword(password, masterKey) {
    return await encryptData(password, masterKey);
}

/**
 * Decrypt a password entry
 * @param {Object} encryptedPassword - Object with ciphertext and iv
 * @param {CryptoKey} masterKey - Master decryption key
 * @returns {Promise<string>} - Decrypted password
 */
async function decryptPassword(encryptedPassword, masterKey) {
    return await decryptData(
        encryptedPassword.ciphertext,
        encryptedPassword.iv,
        masterKey
    );
}

/**
 * Encrypt entire vault data
 * @param {Object} vaultData - Vault object to encrypt
 * @param {CryptoKey} masterKey - Master encryption key
 * @returns {Promise<Object>} - Encrypted vault
 */
async function encryptVault(vaultData, masterKey) {
    const vaultString = JSON.stringify(vaultData);
    return await encryptData(vaultString, masterKey);
}

/**
 * Decrypt entire vault data
 * @param {Object} encryptedVault - Encrypted vault object
 * @param {CryptoKey} masterKey - Master decryption key
 * @returns {Promise<Object>} - Decrypted vault object
 */
async function decryptVault(encryptedVault, masterKey) {
    const vaultString = await decryptData(
        encryptedVault.ciphertext,
        encryptedVault.iv,
        masterKey
    );
    return JSON.parse(vaultString);
}

// ===== HELPER FUNCTIONS =====

/**
 * Convert ArrayBuffer to Base64 string
 */
function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Convert Base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * Generate a secure random salt
 */
function generateSalt() {
    const saltArray = new Uint8Array(16);
    window.crypto.getRandomValues(saltArray);
    return arrayBufferToBase64(saltArray);
}

/**
 * Hash data using SHA-256 (for blockchain audit logs)
 * @param {string} data - Data to hash
 * @returns {Promise<string>} - Hex hash
 */
async function sha256Hash(data) {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Derive raw key bytes (256 bits) from mnemonic+salt and return SHA-256 hex fingerprint.
 * This is intended for diagnostics only (we never log raw key material),
 * the function returns a hex hash of the derived key bytes so callers can
 * verify the same key is produced during save and load.
 * @param {string} mnemonic
 * @param {string} salt
 * @returns {Promise<string>} hex fingerprint
 */
async function deriveKeyFingerprint(mnemonic, salt = 'blockpass-vault') {
    const encoder = new TextEncoder();

    const mnemonicKey = await window.crypto.subtle.importKey(
        'raw',
        encoder.encode(mnemonic),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
    );

    // derive 256 bits (32 bytes)
    const rawKey = await window.crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: encoder.encode(salt),
            iterations: 100000,
            hash: 'SHA-256'
        },
        mnemonicKey,
        256
    );

    // Hash the raw key bytes for a stable fingerprint
    const fingerprintBuffer = await window.crypto.subtle.digest('SHA-256', rawKey);
    const fpArray = Array.from(new Uint8Array(fingerprintBuffer));
    return fpArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Derive an unlock key from PIN for encrypting session tokens
 * @param {string} pin - User's PIN
 * @param {string} pinSalt - Salt for PIN derivation
 * @returns {Promise<CryptoKey>} - Derived unlock key
 */
async function deriveUnlockKey(pin, pinSalt) {
    const encoder = new TextEncoder();
    
    const pinKey = await window.crypto.subtle.importKey(
        'raw',
        encoder.encode(pin),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );
    
    const unlockKey = await window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: encoder.encode(pinSalt),
            iterations: 50000, // Fewer iterations for faster unlock
            hash: 'SHA-256'
        },
        pinKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
    
    return unlockKey;
}

/**
 * Create an encrypted unlock token from mnemonic and vault salt
 * This token allows quick unlock with PIN/biometric without re-entering mnemonic
 * @param {string} mnemonic - User's recovery phrase
 * @param {string} vaultSalt - Vault's encryption salt
 * @param {string} pin - User's PIN for token encryption
 * @returns {Promise<Object>} - Encrypted unlock token with metadata
 */
async function createUnlockToken(mnemonic, vaultSalt, pin) {
    // Generate a unique salt for PIN-based encryption
    const pinSalt = generateSalt();
    
    // Derive unlock key from PIN
    const unlockKey = await deriveUnlockKey(pin, pinSalt);
    
    // Create token data containing mnemonic and vault salt
    const tokenData = JSON.stringify({
        mnemonic: mnemonic,
        vaultSalt: vaultSalt,
        created: Date.now()
    });
    
    // Encrypt the token
    const encrypted = await encryptData(tokenData, unlockKey);
    
    return {
        encryptedToken: encrypted,
        pinSalt: pinSalt,
        created: Date.now()
    };
}

/**
 * Decrypt an unlock token using PIN to retrieve mnemonic and vault salt
 * @param {Object} tokenObject - Stored unlock token with encrypted data and pinSalt
 * @param {string} pin - User's PIN
 * @returns {Promise<Object>} - Decrypted token data {mnemonic, vaultSalt}
 */
async function decryptUnlockToken(tokenObject, pin) {
    // Derive unlock key from PIN and stored salt
    const unlockKey = await deriveUnlockKey(pin, tokenObject.pinSalt);
    
    // Decrypt the token
    const tokenDataString = await decryptData(
        tokenObject.encryptedToken.ciphertext,
        tokenObject.encryptedToken.iv,
        unlockKey
    );
    
    return JSON.parse(tokenDataString);
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        generateMnemonic,
        deriveMasterKey,
        encryptData,
        decryptData,
        encryptPassword,
        decryptPassword,
        encryptVault,
        decryptVault,
        generateSalt,
        sha256Hash,
        deriveKeyFingerprint,
        deriveUnlockKey,
        createUnlockToken,
        decryptUnlockToken
    };
}
