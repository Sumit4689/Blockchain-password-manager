// ===== STATE MANAGEMENT =====
let currentScreen = 'onboarding-screen';
let vault = {
    username: '',
    mnemonic: '',
    authMethod: 'biometric',
    pin: '',
    passwords: [],
    backupIP: '',
    auditEnabled: false,
    theme: 'dark',
    salt: '' // For key derivation
};

let currentPasswordId = null;
let autoHideTimer = null;
let masterKey = null; // Cached master encryption key

// ===== UTILITY FUNCTIONS =====

// Note: generateMnemonic is now in crypto.js

// Generate strong password
function generatePassword(length = 16, options = {}) {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    let charset = '';
    if (options.uppercase !== false) charset += uppercase;
    if (options.lowercase !== false) charset += lowercase;
    if (options.numbers !== false) charset += numbers;
    if (options.symbols !== false) charset += symbols;
    
    if (charset === '') charset = lowercase;
    
    let password = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        password += charset[randomIndex];
    }
    return password;
}

// Calculate password strength
function calculatePasswordStrength(password) {
    if (!password) return { level: 'none', text: 'Enter a password' };
    
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    
    if (strength <= 2) return { level: 'weak', text: 'Weak' };
    if (strength <= 4) return { level: 'medium', text: 'Medium' };
    return { level: 'strong', text: 'Strong' };
}

// Note: Encryption functions are now in crypto.js and use Web Crypto API

// Copy to clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Copied to clipboard!');
    });
}

// Show notification (simple version)
function showNotification(message) {
    // Could implement a toast notification system
    console.log('Notification:', message);
}

// ===== SCREEN NAVIGATION =====

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
    currentScreen = screenId;
}

// ===== ONBOARDING FLOW =====

document.getElementById('create-vault-btn')?.addEventListener('click', () => {
    showScreen('create-vault-screen');
});

document.getElementById('recover-vault-btn')?.addEventListener('click', () => {
    showScreen('recover-vault-screen');
});

document.getElementById('back-to-onboarding')?.addEventListener('click', () => {
    showScreen('onboarding-screen');
});

document.getElementById('back-to-onboarding-2')?.addEventListener('click', () => {
    showScreen('onboarding-screen');
});

// Generate mnemonic
document.getElementById('generate-mnemonic-btn')?.addEventListener('click', async () => {
    const username = document.getElementById('username-input').value.trim();
    if (!username) {
        alert('Please enter a username or email');
        return;
    }
    
    vault.username = username;
    vault.mnemonic = generateMnemonic(); // From crypto.js
    vault.salt = generateSalt(); // Generate unique salt for this vault
    
    // Derive master key for future use
    try {
        masterKey = await deriveMasterKey(vault.mnemonic, vault.salt);
        console.log('Master key derived successfully');
    } catch (error) {
        console.error('Error deriving master key:', error);
        alert('Error setting up encryption. Please try again.');
        return;
    }
    
    // Display mnemonic
    const mnemonicGrid = document.getElementById('mnemonic-grid');
    mnemonicGrid.innerHTML = '';
    const words = vault.mnemonic.split(' ');
    words.forEach((word, index) => {
        const wordDiv = document.createElement('div');
        wordDiv.className = 'mnemonic-word';
        wordDiv.innerHTML = `
            <span class="word-number">${index + 1}</span>
            <span class="word-text">${word}</span>
        `;
        mnemonicGrid.appendChild(wordDiv);
    });
    
    document.getElementById('generate-mnemonic-btn').style.display = 'none';
    document.getElementById('mnemonic-section').style.display = 'block';
});

// Copy mnemonic to clipboard
document.getElementById('copy-mnemonic-btn')?.addEventListener('click', () => {
    copyToClipboard(vault.mnemonic);
    alert('Recovery phrase copied to clipboard!\n\nKeep it safe - this is the only way to recover your vault.');
});

// Confirm mnemonic
document.getElementById('confirm-mnemonic-btn')?.addEventListener('click', () => {
    document.getElementById('mnemonic-section').style.display = 'none';
    document.getElementById('auth-method-section').style.display = 'block';
});

// Auth method selection
document.querySelectorAll('input[name="auth-method"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        vault.authMethod = e.target.value;
        const pinSetup = document.getElementById('pin-setup');
        if (e.target.value === 'pin') {
            pinSetup.style.display = 'block';
        } else {
            pinSetup.style.display = 'none';
        }
    });
});

// Continue to dashboard
document.getElementById('continue-dashboard-btn')?.addEventListener('click', async () => {
    if (vault.authMethod === 'pin') {
        const pin = document.getElementById('pin-input').value;
        const confirmPin = document.getElementById('pin-confirm').value;
        
        if (!pin || pin.length !== 6) {
            alert('Please enter a 6-digit PIN');
            return;
        }
        
        if (pin !== confirmPin) {
            alert('PINs do not match');
            return;
        }
        
        vault.pin = pin;
    }
    
    // Save vault to storage
    await saveVault();
    
    // Go to dashboard
    document.getElementById('username-display').textContent = vault.username;
    showScreen('dashboard-screen');
    renderPasswordList();
});

// Recover vault
document.getElementById('recover-vault-submit-btn')?.addEventListener('click', async () => {
    const mnemonic = document.getElementById('recover-mnemonic-input').value.trim();
    const backupIP = document.getElementById('backup-server-ip').value.trim();
    
    if (!mnemonic) {
        alert('Please enter your recovery phrase');
        return;
    }
    
    // Store mnemonic
    vault.mnemonic = mnemonic;
    vault.backupIP = backupIP;
    
    // Try to load vault from storage
    const loaded = await loadVault();
    
    if (!loaded) {
        alert('No vault found with this recovery phrase. Please check and try again.');
        return;
    }
    
    document.getElementById('username-display').textContent = vault.username || 'User';
    showScreen('dashboard-screen');
    renderPasswordList();
});

// ===== DASHBOARD =====

document.getElementById('add-password-btn')?.addEventListener('click', () => {
    currentPasswordId = null;
    document.getElementById('add-edit-title').textContent = 'Add Password';
    document.getElementById('website-input').value = '';
    document.getElementById('email-input').value = '';
    document.getElementById('password-input').value = '';
    document.getElementById('notes-input').value = '';
    document.getElementById('delete-password-btn').style.display = 'none';
    showScreen('add-edit-screen');
});

document.getElementById('settings-btn')?.addEventListener('click', () => {
    showScreen('settings-screen');
});

document.getElementById('back-to-dashboard')?.addEventListener('click', () => {
    showScreen('dashboard-screen');
});

document.getElementById('back-to-dashboard-2')?.addEventListener('click', () => {
    showScreen('dashboard-screen');
});

document.getElementById('back-to-dashboard-3')?.addEventListener('click', () => {
    showScreen('dashboard-screen');
});

// Search functionality
document.getElementById('search-input')?.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    renderPasswordList(searchTerm);
});

// ===== PASSWORD MANAGEMENT =====

function renderPasswordList(searchTerm = '') {
    const passwordList = document.getElementById('password-list');
    const emptyState = document.getElementById('empty-state');
    
    const filteredPasswords = vault.passwords.filter(pwd => 
        pwd.website.toLowerCase().includes(searchTerm) ||
        pwd.username.toLowerCase().includes(searchTerm)
    );
    
    if (filteredPasswords.length === 0) {
        emptyState.style.display = 'block';
        passwordList.querySelectorAll('.password-item').forEach(item => item.remove());
        return;
    }
    
    emptyState.style.display = 'none';
    passwordList.innerHTML = '';
    
    filteredPasswords.forEach(pwd => {
        const item = document.createElement('div');
        item.className = 'password-item';
        item.innerHTML = `
            <div class="password-item-header">
                <span class="website-icon">🌐</span>
                <span class="website-name">${pwd.website}</span>
            </div>
            <div class="password-item-body">
                <div class="password-item-username">${pwd.username}</div>
                <div class="password-item-password">••••••••</div>
            </div>
            <div class="password-item-actions">
                <button class="btn btn-secondary btn-small view-btn" data-id="${pwd.id}">👁️ View</button>
                <button class="btn btn-secondary btn-small edit-btn" data-id="${pwd.id}">✏️ Edit</button>
            </div>
        `;
        
        passwordList.appendChild(item);
        
        // Add event listeners
        item.querySelector('.view-btn').addEventListener('click', () => viewPassword(pwd.id));
        item.querySelector('.edit-btn').addEventListener('click', () => editPassword(pwd.id));
    });
}

function viewPassword(id) {
    const password = vault.passwords.find(pwd => pwd.id === id);
    if (!password) return;
    
    currentPasswordId = id;
    
    // Show auth prompt
    document.getElementById('auth-prompt').style.display = 'block';
    document.getElementById('password-details').style.display = 'none';
    
    showScreen('view-password-screen');
}

function editPassword(id) {
    const password = vault.passwords.find(pwd => pwd.id === id);
    if (!password) return;
    
    currentPasswordId = id;
    
    document.getElementById('add-edit-title').textContent = 'Edit Password';
    document.getElementById('website-input').value = password.website;
    document.getElementById('email-input').value = password.username;
    // Password will be decrypted when viewing
    document.getElementById('password-input').value = '••••••••'; // Placeholder
    document.getElementById('notes-input').value = password.notes || '';
    document.getElementById('delete-password-btn').style.display = 'block';
    
    showScreen('add-edit-screen');
}

// Authenticate to view password
document.getElementById('authenticate-btn')?.addEventListener('click', async () => {
    // In production, implement actual authentication
    const password = vault.passwords.find(pwd => pwd.id === currentPasswordId);
    if (!password) return;
    
    try {
        // Ensure master key is available
        if (!masterKey) {
            masterKey = await deriveMasterKey(vault.mnemonic, vault.salt);
        }
        
        // Decrypt the password
        const decryptedPassword = await decryptPassword(password.encrypted, masterKey);
        
        // Show password details
        document.getElementById('view-website').textContent = password.website;
        document.getElementById('view-username').textContent = password.username;
        document.getElementById('view-password').textContent = decryptedPassword;
        document.getElementById('view-notes').textContent = password.notes || 'None';
        
        document.getElementById('auth-prompt').style.display = 'none';
        document.getElementById('password-details').style.display = 'block';
        
        // Start auto-hide timer
        startAutoHideTimer();
    } catch (error) {
        console.error('Error decrypting password:', error);
        alert('Failed to decrypt password. Please try again.');
    }
});

function startAutoHideTimer() {
    let seconds = 10;
    document.getElementById('timer-seconds').textContent = seconds;
    
    if (autoHideTimer) clearInterval(autoHideTimer);
    
    autoHideTimer = setInterval(() => {
        seconds--;
        document.getElementById('timer-seconds').textContent = seconds;
        
        if (seconds <= 0) {
            clearInterval(autoHideTimer);
            showScreen('dashboard-screen');
        }
    }, 1000);
}

// Copy password from view screen
document.getElementById('copy-view-password-btn')?.addEventListener('click', () => {
    const password = document.getElementById('view-password').textContent;
    copyToClipboard(password);
});

// Edit from view screen
document.getElementById('edit-from-view-btn')?.addEventListener('click', () => {
    if (autoHideTimer) clearInterval(autoHideTimer);
    editPassword(currentPasswordId);
});

// ===== ADD/EDIT PASSWORD SCREEN =====

// Toggle password visibility
document.getElementById('toggle-password-visibility')?.addEventListener('click', () => {
    const passwordInput = document.getElementById('password-input');
    passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
});

// Copy password
document.getElementById('copy-password-btn')?.addEventListener('click', () => {
    const password = document.getElementById('password-input').value;
    copyToClipboard(password);
});

// Password strength indicator
document.getElementById('password-input')?.addEventListener('input', (e) => {
    const password = e.target.value;
    const strength = calculatePasswordStrength(password);
    
    const strengthFill = document.getElementById('strength-fill');
    const strengthText = document.getElementById('strength-text');
    
    strengthFill.className = 'strength-fill ' + strength.level;
    strengthText.textContent = strength.text;
});

// Generate password button
document.getElementById('generate-password-btn')?.addEventListener('click', () => {
    document.getElementById('password-generator-modal').classList.add('active');
    generateAndDisplayPassword();
});

// Save password
document.getElementById('save-password-btn')?.addEventListener('click', async () => {
    const website = document.getElementById('website-input').value.trim();
    const username = document.getElementById('email-input').value.trim();
    const password = document.getElementById('password-input').value;
    const notes = document.getElementById('notes-input').value.trim();
    
    if (!website || !username || !password) {
        alert('Please fill in all required fields');
        return;
    }
    
    // Skip encryption if editing and password is placeholder
    if (currentPasswordId && password === '••••••••') {
        // Just update other fields, keep existing encrypted password
        const index = vault.passwords.findIndex(pwd => pwd.id === currentPasswordId);
        vault.passwords[index].website = website;
        vault.passwords[index].username = username;
        vault.passwords[index].notes = notes;
        vault.passwords[index].updated = Date.now();
    } else {
        try {
            // Ensure master key is available
            if (!masterKey) {
                masterKey = await deriveMasterKey(vault.mnemonic, vault.salt);
            }
            
            // Encrypt the password
            const encrypted = await encryptPassword(password, masterKey);
            
            if (currentPasswordId) {
                // Update existing
                const index = vault.passwords.findIndex(pwd => pwd.id === currentPasswordId);
                vault.passwords[index] = {
                    id: currentPasswordId,
                    website,
                    username,
                    encrypted,
                    notes,
                    updated: Date.now()
                };
            } else {
                // Add new
                vault.passwords.push({
                    id: Date.now().toString(),
                    website,
                    username,
                    encrypted,
                    notes,
                    created: Date.now()
                });
            }
        } catch (error) {
            console.error('Error encrypting password:', error);
            alert('Failed to encrypt password. Please try again.');
            return;
        }
    }
    
    await saveVault();
    renderPasswordList();
    showScreen('dashboard-screen');
    
    // Show backup modal
    document.getElementById('backup-modal').classList.add('active');
});

// Delete password
document.getElementById('delete-password-btn')?.addEventListener('click', async () => {
    if (confirm('Are you sure you want to delete this password?')) {
        vault.passwords = vault.passwords.filter(pwd => pwd.id !== currentPasswordId);
        await saveVault();
        renderPasswordList();
        showScreen('dashboard-screen');
    }
});

// ===== PASSWORD GENERATOR MODAL =====

function generateAndDisplayPassword() {
    const length = document.getElementById('password-length-slider').value;
    const options = {
        uppercase: document.getElementById('include-uppercase').checked,
        lowercase: document.getElementById('include-lowercase').checked,
        numbers: document.getElementById('include-numbers').checked,
        symbols: document.getElementById('include-symbols').checked
    };
    
    const password = generatePassword(parseInt(length), options);
    document.getElementById('generated-password-text').textContent = password;
}

document.getElementById('password-length-slider')?.addEventListener('input', (e) => {
    document.getElementById('password-length-value').textContent = e.target.value;
    generateAndDisplayPassword();
});

document.querySelectorAll('#password-generator-modal input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', generateAndDisplayPassword);
});

document.getElementById('regenerate-password-btn')?.addEventListener('click', () => {
    generateAndDisplayPassword();
});

document.getElementById('copy-generated-btn')?.addEventListener('click', () => {
    const password = document.getElementById('generated-password-text').textContent;
    copyToClipboard(password);
});

document.getElementById('use-password-btn')?.addEventListener('click', () => {
    const password = document.getElementById('generated-password-text').textContent;
    document.getElementById('password-input').value = password;
    
    // Update strength indicator
    const strength = calculatePasswordStrength(password);
    const strengthFill = document.getElementById('strength-fill');
    const strengthText = document.getElementById('strength-text');
    strengthFill.className = 'strength-fill ' + strength.level;
    strengthText.textContent = strength.text;
    
    document.getElementById('password-generator-modal').classList.remove('active');
});

document.getElementById('close-generator-modal')?.addEventListener('click', () => {
    document.getElementById('password-generator-modal').classList.remove('active');
});

// ===== BACKUP MODAL =====

document.getElementById('backup-now-btn')?.addEventListener('click', () => {
    backupToServer();
    document.getElementById('backup-modal').classList.remove('active');
});

document.getElementById('backup-later-btn')?.addEventListener('click', () => {
    document.getElementById('backup-modal').classList.remove('active');
});

// ===== SETTINGS =====

// Sync now button
document.getElementById('sync-now-btn')?.addEventListener('click', async () => {
    const backupIP = document.getElementById('backup-ip-input').value.trim();
    vault.backupIP = backupIP;
    await saveVault();
    backupToServer();
});

// Theme toggle
document.getElementById('theme-toggle')?.addEventListener('change', async (e) => {
    if (e.target.checked) {
        document.body.classList.remove('light-mode');
        vault.theme = 'dark';
    } else {
        document.body.classList.add('light-mode');
        vault.theme = 'light';
    }
    await saveVault();
});

// Audit toggle
document.getElementById('audit-toggle')?.addEventListener('change', async (e) => {
    vault.auditEnabled = e.target.checked;
    await saveVault();
});

// Show mnemonic
document.getElementById('show-mnemonic-btn')?.addEventListener('click', () => {
    // In production, require authentication first
    alert('Your recovery phrase:\n\n' + vault.mnemonic + '\n\nKeep this safe!');
});

// ===== STORAGE & BACKUP =====

// Promisified storage helpers for chrome.storage.local (MV3 callback API compatibility)
function storageSet(obj) {
    return new Promise((resolve, reject) => {
        try {
            chrome.storage.local.set(obj, () => {
                // check runtime.lastError
                if (chrome.runtime.lastError) {
                    return reject(new Error(chrome.runtime.lastError.message));
                }
                resolve();
            });
        } catch (err) {
            reject(err);
        }
    });
}

function storageGet(keys) {
    return new Promise((resolve, reject) => {
        try {
            chrome.storage.local.get(keys, (result) => {
                if (chrome.runtime.lastError) {
                    return reject(new Error(chrome.runtime.lastError.message));
                }
                resolve(result);
            });
        } catch (err) {
            reject(err);
        }
    });
}

async function saveVault() {
    try {
        // Ensure master key exists
        if (!masterKey && vault.mnemonic) {
            masterKey = await deriveMasterKey(vault.mnemonic, vault.salt);
        }
        
        // Prepare vault data (exclude mnemonic from encrypted storage)
        const vaultData = {
            username: vault.username,
            authMethod: vault.authMethod,
            pin: vault.pin,
            passwords: vault.passwords,
            backupIP: vault.backupIP,
            auditEnabled: vault.auditEnabled,
            theme: vault.theme,
            salt: vault.salt
        };
        
        // Encrypt the entire vault
        const encryptedVault = await encryptVault(vaultData, masterKey);
    console.log('Encrypted vault object (ready to store):', encryptedVault);
        
        // Store encrypted vault in chrome.storage.local
        // Include the salt as top-level metadata so recovery can derive the same key
        const storedVault = Object.assign({}, encryptedVault, { salt: vault.salt });
        await storageSet({
            'blockpass-vault': storedVault,
            'vault-username': vault.username // Store username separately for recovery
        });

        // Log a diagnostic fingerprint so we can verify the same key is derived on recover
        try {
            const saveFp = await deriveKeyFingerprint(vault.mnemonic, vault.salt);
            console.log('Derived key fingerprint (on save):', saveFp);
        } catch (e) {
            console.warn('Could not compute key fingerprint on save:', e);
        }
        
        updateBackupStatus('Saved locally');
        console.log('Vault saved and encrypted successfully');
        // Verify storage
        try {
            const verify = await storageGet(['blockpass-vault']);
            console.log('Verified stored vault:', verify['blockpass-vault'] ? true : false);
        } catch (e) {
            console.error('Error verifying stored vault:', e);
        }
    } catch (error) {
        console.error('Error saving vault:', error);
        alert('Failed to save vault: ' + error.message);
    }
}

async function loadVault() {
    try {
    // Get encrypted vault from chrome.storage.local
    const result = await storageGet(['blockpass-vault', 'vault-username']);
        
        console.log('Storage get result:', result);
        if (!result || !result['blockpass-vault']) {
            console.log('No vault found');
            return false;
        }
        
        // Derive master key from mnemonic
        if (!masterKey && vault.mnemonic) {
            // First, get the salt from storage metadata
            const encryptedVault = result['blockpass-vault'];

            // Temporarily store salt if it exists
            if (encryptedVault && encryptedVault.salt) {
                vault.salt = encryptedVault.salt;
            } else {
                console.warn('No salt metadata found in stored vault. Decryption will likely fail.');
            }

            try {
                const loadFp = await deriveKeyFingerprint(vault.mnemonic, vault.salt);
                console.log('Derived key fingerprint (on load):', loadFp);
            } catch (e) {
                console.warn('Could not compute key fingerprint on load:', e);
            }

            masterKey = await deriveMasterKey(vault.mnemonic, vault.salt);
        }
        
        // Decrypt the vault
        const decryptedVault = await decryptVault(result['blockpass-vault'], masterKey);
        
        // Restore vault data
        vault.username = decryptedVault.username || result['vault-username'];
        vault.authMethod = decryptedVault.authMethod || 'biometric';
        vault.pin = decryptedVault.pin || '';
        vault.passwords = decryptedVault.passwords || [];
        vault.backupIP = decryptedVault.backupIP || '';
        vault.auditEnabled = decryptedVault.auditEnabled || false;
        vault.theme = decryptedVault.theme || 'dark';
        vault.salt = decryptedVault.salt || vault.salt;
        
        // Apply theme
        if (vault.theme === 'light') {
            document.body.classList.add('light-mode');
            const themeToggle = document.getElementById('theme-toggle');
            if (themeToggle) themeToggle.checked = false;
        }
        
        console.log('Vault loaded and decrypted successfully');
        return true;
    } catch (error) {
        console.error('Error loading vault:', error);
        alert('Failed to decrypt vault. Please check your recovery phrase.');
        return false;
    }
}

function backupToServer() {
    if (!vault.backupIP) {
        updateBackupStatus('No backup server configured');
        return;
    }
    
    // In production, POST encrypted vault to backup server
    const backupData = {
        username: vault.username,
        mnemonic: vault.mnemonic,
        passwords: vault.passwords,
        timestamp: Date.now()
    };
    
    // Simulated backup
    fetch(`http://${vault.backupIP}/backup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backupData)
    })
    .then(response => {
        if (response.ok) {
            updateBackupStatus('Backed up successfully');
        } else {
            updateBackupStatus('Backup failed');
        }
    })
    .catch(() => {
        updateBackupStatus('Backup failed - server unreachable');
    });
}

function updateBackupStatus(status) {
    const statusText = document.getElementById('backup-status')?.querySelector('.status-text');
    if (statusText) {
        statusText.textContent = `Last backup: ${status}`;
    }
}

// ===== INITIALIZATION =====

document.addEventListener('DOMContentLoaded', async () => {
    // Try to load existing vault
    const hasVault = await storageGet(['blockpass-vault']);
    
    if (hasVault && hasVault['blockpass-vault']) {
        // Vault exists, but we need mnemonic to decrypt
        // Show recovery screen or auto-login if session is active
        console.log('Existing vault found. Please enter recovery phrase to unlock.');
    }
});
