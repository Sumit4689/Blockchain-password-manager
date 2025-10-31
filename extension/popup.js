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
    salt: '', // For key derivation
    sessionTimeout: 15 // Timeout in minutes (5, 15, 30, or 0 for never)
};

let currentPasswordId = null;
let autoHideTimer = null;
let masterKey = null; // Cached master encryption key
let sessionActive = false; // Track if user is currently logged in
let lastActivityTime = Date.now(); // Track last user activity
let sessionTimeoutTimer = null; // Timer for auto-lock

// Rate limiting for PIN attempts
let failedPinAttempts = 0;
let pinLockoutUntil = 0; // Timestamp when lockout expires

// ===== UTILITY FUNCTIONS =====

// Note: generateMnemonic is now in crypto.js

// Generate strong password using crypto.getRandomValues() for security
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
    
    // Use crypto.getRandomValues() for cryptographically secure random generation
    let password = '';
    const randomValues = new Uint32Array(length);
    window.crypto.getRandomValues(randomValues);
    
    for (let i = 0; i < length; i++) {
        const randomIndex = randomValues[i] % charset.length;
        password += charset[randomIndex];
    }
    return password;
}

// Calculate password strength using entropy-based analysis
function calculatePasswordStrength(password) {
    if (!password) return { level: 'none', text: 'Enter a password', score: 0, entropy: 0 };
    
    // Calculate character set size
    let charsetSize = 0;
    if (/[a-z]/.test(password)) charsetSize += 26;
    if (/[A-Z]/.test(password)) charsetSize += 26;
    if (/\d/.test(password)) charsetSize += 10;
    if (/[^a-zA-Z0-9]/.test(password)) charsetSize += 32; // Common symbols
    
    // Calculate entropy: log2(charsetSize^length)
    const entropy = password.length * Math.log2(charsetSize || 1);
    
    // Additional strength factors
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (password.length >= 16) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    
    // Check for common patterns (reduces score)
    if (/(.)\1{2,}/.test(password)) strength--; // Repeated characters
    if (/^[a-zA-Z]+$/.test(password) || /^\d+$/.test(password)) strength--; // Single type
    if (/^(password|123456|qwerty|abc123)/i.test(password)) strength -= 2; // Common passwords
    
    // Entropy-based classification
    let level, text, score;
    if (entropy < 28) {
        level = 'very-weak';
        text = 'Very Weak';
        score = 1;
    } else if (entropy < 36) {
        level = 'weak';
        text = 'Weak';
        score = 2;
    } else if (entropy < 60) {
        level = 'medium';
        text = 'Medium';
        score = 3;
    } else if (entropy < 80) {
        level = 'strong';
        text = 'Strong';
        score = 4;
    } else {
        level = 'very-strong';
        text = 'Very Strong';
        score = 5;
    }
    
    // Adjust based on strength factors
    if (strength <= 2) {
        score = Math.min(score, 2);
        level = score === 1 ? 'very-weak' : 'weak';
        text = score === 1 ? 'Very Weak' : 'Weak';
    }
    
    return { level, text, score, entropy: Math.round(entropy) };
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

// ===== SESSION TIMEOUT & ACTIVITY TRACKING =====

/**
 * Update last activity time and reset session timeout
 */
function trackActivity() {
    if (!sessionActive) return;
    
    lastActivityTime = Date.now();
    resetSessionTimeout();
}

/**
 * Reset session timeout timer
 */
function resetSessionTimeout() {
    if (sessionTimeoutTimer) {
        clearTimeout(sessionTimeoutTimer);
    }
    
    // Don't set timeout if disabled (0) or not logged in
    if (!sessionActive || !vault.sessionTimeout || vault.sessionTimeout === 0) {
        return;
    }
    
    const timeoutMs = vault.sessionTimeout * 60 * 1000; // Convert minutes to ms
    
    sessionTimeoutTimer = setTimeout(async () => {
        console.log('Session timeout - auto-locking vault');
        await lockVault();
        alert('Session timed out due to inactivity. Please unlock your vault.');
    }, timeoutMs);
}

/**
 * Start tracking user activity for session timeout
 */
function startActivityTracking() {
    // Track mouse movement, clicks, and keyboard input
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    
    events.forEach(event => {
        document.addEventListener(event, trackActivity, { passive: true });
    });
    
    resetSessionTimeout();
}

/**
 * Stop tracking activity (when locked)
 */
function stopActivityTracking() {
    if (sessionTimeoutTimer) {
        clearTimeout(sessionTimeoutTimer);
        sessionTimeoutTimer = null;
    }
}

// ===== RATE LIMITING FOR PIN ATTEMPTS =====

/**
 * Check if PIN attempts are currently locked out
 * @returns {Object} { locked: boolean, remainingTime: number }
 */
function checkPinLockout() {
    const now = Date.now();
    
    if (pinLockoutUntil > now) {
        const remainingMs = pinLockoutUntil - now;
        const remainingSec = Math.ceil(remainingMs / 1000);
        return { locked: true, remainingTime: remainingSec };
    }
    
    return { locked: false, remainingTime: 0 };
}

/**
 * Calculate lockout duration based on failed attempts
 * Exponential backoff: 3 fails = 30s, 5 fails = 5min, 10+ fails = require mnemonic
 */
function calculateLockoutDuration(attempts) {
    if (attempts >= 10) {
        return 'REQUIRE_MNEMONIC'; // Force recovery phrase
    } else if (attempts >= 5) {
        return 5 * 60 * 1000; // 5 minutes
    } else if (attempts >= 3) {
        return 30 * 1000; // 30 seconds
    }
    return 0;
}

/**
 * Handle failed PIN attempt
 */
function handleFailedPinAttempt() {
    failedPinAttempts++;
    
    const lockoutDuration = calculateLockoutDuration(failedPinAttempts);
    
    if (lockoutDuration === 'REQUIRE_MNEMONIC') {
        alert(`Too many failed attempts (${failedPinAttempts}). For security, you must use your recovery phrase to unlock.`);
        clearSession(); // Force full recovery
        showScreen('recover-vault-screen');
        return true; // Indicate severe lockout
    } else if (lockoutDuration > 0) {
        pinLockoutUntil = Date.now() + lockoutDuration;
        const seconds = Math.ceil(lockoutDuration / 1000);
        alert(`Too many failed attempts. Please wait ${seconds} seconds before trying again.`);
        return false;
    }
    
    // Show remaining attempts before lockout
    const attemptsUntilLockout = 3 - failedPinAttempts;
    if (attemptsUntilLockout > 0 && failedPinAttempts > 0) {
        console.log(`Failed PIN attempt ${failedPinAttempts}. ${attemptsUntilLockout} attempts remaining before lockout.`);
    }
    
    return false;
}

/**
 * Reset failed PIN attempts (on successful unlock)
 */
function resetPinAttempts() {
    failedPinAttempts = 0;
    pinLockoutUntil = 0;
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
    
    // Create and store unlock token for quick access
    if (vault.pin && vault.mnemonic && vault.salt) {
        try {
            const unlockToken = await createUnlockToken(vault.mnemonic, vault.salt, vault.pin);
            await storageSet({ 'blockpass-unlock-token': unlockToken });
            console.log('Unlock token created and stored');
        } catch (error) {
            console.error('Error creating unlock token:', error);
        }
    }
    
    sessionActive = true;
    
    // Go to dashboard
    document.getElementById('username-display').textContent = vault.username;
    showScreen('dashboard-screen');
    renderPasswordList();
    
    // Start activity tracking for session timeout
    startActivityTracking();
    
    // Check for pending password save
    checkPendingSave();
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
    
    // Create and store unlock token for future quick access
    if (vault.pin && vault.mnemonic && vault.salt) {
        try {
            const unlockToken = await createUnlockToken(vault.mnemonic, vault.salt, vault.pin);
            await storageSet({ 'blockpass-unlock-token': unlockToken });
            console.log('Unlock token created after recovery');
        } catch (error) {
            console.error('Error creating unlock token:', error);
        }
    }
    
    sessionActive = true;
    
    document.getElementById('username-display').textContent = vault.username || 'User';
    showScreen('dashboard-screen');
    renderPasswordList();
    
    // Start activity tracking for session timeout
    startActivityTracking();
    
    // Check for pending password save
    checkPendingSave();
});

// ===== QUICK UNLOCK (PIN/BIOMETRIC) =====

document.getElementById('quick-unlock-btn')?.addEventListener('click', async () => {
    const pin = document.getElementById('quick-unlock-pin').value.trim();
    
    if (!pin || pin.length !== 6) {
        alert('Please enter a valid 6-digit PIN');
        return;
    }
    
    // Check if currently locked out
    const lockout = checkPinLockout();
    if (lockout.locked) {
        alert(`Too many failed attempts. Please wait ${lockout.remainingTime} seconds before trying again.`);
        return;
    }
    
    try {
        // Get stored unlock token
        const result = await storageGet(['blockpass-unlock-token']);
        
        if (!result || !result['blockpass-unlock-token']) {
            alert('No unlock token found. Please use your recovery phrase.');
            showScreen('recover-vault-screen');
            return;
        }
        
        // Decrypt unlock token to get mnemonic and vault salt
        const tokenData = await decryptUnlockToken(result['blockpass-unlock-token'], pin);
        
        // Restore vault credentials
        vault.mnemonic = tokenData.mnemonic;
        vault.salt = tokenData.vaultSalt;
        vault.pin = pin;
        
        // Load the vault
        const loaded = await loadVault();
        
        if (!loaded) {
            alert('Failed to load vault. Your data may be corrupted.');
            return;
        }
        
        // Success! Reset failed attempts and start session
        resetPinAttempts();
        sessionActive = true;
        
        document.getElementById('username-display').textContent = vault.username || 'User';
        showScreen('dashboard-screen');
        renderPasswordList();
        
        // Start activity tracking for session timeout
        startActivityTracking();
        
        // Check for pending password save from content script
        checkPendingSave();
        
    } catch (error) {
        console.error('Error during quick unlock:', error);
        
        // Handle failed attempt
        const severeFailure = handleFailedPinAttempt();
        
        if (!severeFailure) {
            alert('Incorrect PIN. Please try again or use your recovery phrase.');
        }
    }
});

document.getElementById('use-recovery-phrase-btn')?.addEventListener('click', () => {
    showScreen('recover-vault-screen');
});

document.getElementById('logout-clear-session-btn')?.addEventListener('click', async () => {
    if (confirm('This will delete your unlock token and you will need to enter your recovery phrase next time. Continue?')) {
        await clearSession();
        alert('Session cleared. You will need your recovery phrase to login next time.');
        showScreen('onboarding-screen');
    }
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
    
    // Update blockchain status when opening settings
    updateBlockchainStatus();
    
    // Populate blockchain config if it exists
    if (typeof BLOCKCHAIN_CONFIG !== 'undefined' && BLOCKCHAIN_CONFIG.contractAddress) {
        document.getElementById('contract-address-input').value = BLOCKCHAIN_CONFIG.contractAddress;
    }
});

document.getElementById('lock-vault-btn')?.addEventListener('click', async () => {
    await lockVault();
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
    
    // Safety check - don't render if elements don't exist (not on dashboard screen)
    if (!passwordList || !emptyState) {
        return;
    }
    
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
    strengthFill.style.width = (strength.score * 20) + '%'; // 0-100%
    
    // Show entropy and text
    if (strength.entropy > 0) {
        strengthText.textContent = `${strength.text} (${strength.entropy} bits)`;
    } else {
        strengthText.textContent = strength.text;
    }
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
    showScreen('dashboard-screen');
    renderPasswordList();
    
    // Show backup modal
    document.getElementById('backup-modal').classList.add('active');
});

// Delete password
document.getElementById('delete-password-btn')?.addEventListener('click', async () => {
    if (confirm('Are you sure you want to delete this password?')) {
        vault.passwords = vault.passwords.filter(pwd => pwd.id !== currentPasswordId);
        await saveVault();
        showScreen('dashboard-screen');
        renderPasswordList();
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
    strengthFill.style.width = (strength.score * 20) + '%';
    if (strength.entropy > 0) {
        strengthText.textContent = `${strength.text} (${strength.entropy} bits)`;
    } else {
        strengthText.textContent = strength.text;
    }
    
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

// ===== AUTO-SAVE PASSWORD MODAL =====

function showAutoSaveModal(pendingData) {
    document.getElementById('auto-save-website').textContent = pendingData.domain;
    document.getElementById('auto-save-username').textContent = pendingData.username;
    document.getElementById('auto-save-modal').classList.add('active');
    
    // Store pending data for save action
    window.currentPendingSave = pendingData;
}

document.getElementById('close-auto-save-modal')?.addEventListener('click', () => {
    document.getElementById('auto-save-modal').classList.remove('active');
    clearPendingSave();
});

document.getElementById('auto-save-not-now-btn')?.addEventListener('click', () => {
    document.getElementById('auto-save-modal').classList.remove('active');
    clearPendingSave();
});

document.getElementById('auto-save-never-btn')?.addEventListener('click', async () => {
    // Add to never-save list
    if (!vault.neverSaveSites) vault.neverSaveSites = [];
    const domain = window.currentPendingSave?.domain;
    if (domain && !vault.neverSaveSites.includes(domain)) {
        vault.neverSaveSites.push(domain);
        await saveVault();
    }
    document.getElementById('auto-save-modal').classList.remove('active');
    clearPendingSave();
});

document.getElementById('auto-save-save-btn')?.addEventListener('click', async () => {
    const pendingData = window.currentPendingSave;
    if (!pendingData) return;
    
    // Encrypt and save the password
    const encryptedPassword = await encryptPassword(pendingData.password, masterKey);
    
    const newPassword = {
        id: Date.now().toString(),
        website: pendingData.domain,
        username: pendingData.username,
        password: encryptedPassword,
        notes: `Auto-saved from ${pendingData.url}`,
        createdAt: new Date().toISOString()
    };
    
    vault.passwords.push(newPassword);
    await saveVault();
    
    showNotification('Password saved successfully!');
    renderPasswordList();
    
    document.getElementById('auto-save-modal').classList.remove('active');
    clearPendingSave();
});

async function clearPendingSave() {
    window.currentPendingSave = null;
    window.pendingPasswordSave = null;
    await chrome.storage.local.remove('pendingSave');
}

// Check for pending save after successful unlock
function checkPendingSave() {
    if (window.pendingPasswordSave) {
        showAutoSaveModal(window.pendingPasswordSave);
    }
}

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
    
    // Update blockchain status
    updateBlockchainStatus();
});

// Toggle blockchain configuration section
document.getElementById('toggle-blockchain-config-btn')?.addEventListener('click', () => {
    const configSection = document.getElementById('blockchain-config-section');
    if (configSection.style.display === 'none') {
        configSection.style.display = 'block';
    } else {
        configSection.style.display = 'none';
    }
});

// Save blockchain configuration
document.getElementById('save-blockchain-config-btn')?.addEventListener('click', () => {
    const contractAddress = document.getElementById('contract-address-input').value.trim();
    const privateKey = document.getElementById('blockchain-private-key-input').value.trim();
    
    if (!contractAddress || !contractAddress.startsWith('0x')) {
        alert('Please enter a valid contract address (starts with 0x)');
        return;
    }
    
    if (!privateKey || privateKey.length < 60) {
        alert('Please enter a valid private key');
        return;
    }
    
    // Remove 0x prefix if present
    const cleanPrivateKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
    
    if (typeof enableBlockchainAudit === 'function') {
        enableBlockchainAudit(contractAddress, cleanPrivateKey);
        showNotification('Blockchain configuration saved!');
        document.getElementById('blockchain-config-section').style.display = 'none';
        updateBlockchainStatus();
    } else {
        alert('Blockchain module not loaded');
    }
});

// View audit logs
document.getElementById('view-audit-logs-btn')?.addEventListener('click', async () => {
    const modal = document.getElementById('audit-logs-modal');
    const logsList = document.getElementById('audit-logs-list');
    
    modal.classList.add('active');
    logsList.innerHTML = '<p style="text-align: center; color: var(--text-muted);">Loading audit logs...</p>';
    
    if (typeof getAuditLogs === 'function') {
        try {
            const logs = await getAuditLogs();
            
            if (logs.length === 0) {
                logsList.innerHTML = '<p style="text-align: center; color: var(--text-muted);">No audit logs found. Make sure blockchain is configured and you\'ve saved your vault.</p>';
            } else {
                logsList.innerHTML = logs.map(log => `
                    <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; margin-bottom: 0.75rem;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                            <span style="font-weight: 600; color: var(--accent-primary);">${log.operation}</span>
                            <span style="font-size: 0.75rem; color: var(--text-muted);">${log.timestamp.toLocaleString()}</span>
                        </div>
                        <div style="font-size: 0.75rem; font-family: monospace; word-break: break-all; color: var(--text-muted);">
                            ${log.hash}
                        </div>
                    </div>
                `).join('');
            }
        } catch (error) {
            logsList.innerHTML = `<p style="text-align: center; color: var(--accent-danger);">Error loading logs: ${error.message}</p>`;
        }
    } else {
        logsList.innerHTML = '<p style="text-align: center; color: var(--accent-danger);">Blockchain module not loaded</p>';
    }
});

document.getElementById('close-audit-logs-modal')?.addEventListener('click', () => {
    document.getElementById('audit-logs-modal').classList.remove('active');
});

// Update blockchain status in UI
function updateBlockchainStatus() {
    const statusSpan = document.getElementById('blockchain-status');
    if (typeof isBlockchainEnabled === 'function') {
        if (isBlockchainEnabled()) {
            statusSpan.textContent = '✅ Configured & Active';
            statusSpan.style.color = 'var(--accent-success)';
        } else {
            statusSpan.textContent = '⚠️ Not configured';
            statusSpan.style.color = 'var(--accent-warning)';
        }
    } else {
        statusSpan.textContent = '❌ Module not loaded';
        statusSpan.style.color = 'var(--accent-danger)';
    }
}

// Update audit info display
function updateAuditInfo(hash, timestamp) {
    document.getElementById('last-hash').textContent = hash ? hash.substring(0, 20) + '...' : 'N/A';
    document.getElementById('last-timestamp').textContent = timestamp || 'N/A';
}

// Session timeout select
document.getElementById('session-timeout-select')?.addEventListener('change', async (e) => {
    vault.sessionTimeout = parseInt(e.target.value);
    await saveVault();
    
    // Reset timeout with new duration
    if (sessionActive) {
        resetSessionTimeout();
    }
    
    console.log(`Session timeout set to ${vault.sessionTimeout} minutes`);
});

// Change PIN button
document.getElementById('change-pin-btn')?.addEventListener('click', () => {
    if (!sessionActive || !vault.mnemonic) {
        alert('Please unlock your vault first to change PIN');
        return;
    }
    
    // Clear inputs and show modal
    document.getElementById('current-pin-input').value = '';
    document.getElementById('new-pin-input').value = '';
    document.getElementById('new-pin-confirm-input').value = '';
    document.getElementById('change-pin-modal').classList.add('active');
});

// Close change PIN modal
document.getElementById('close-change-pin-modal')?.addEventListener('click', () => {
    document.getElementById('change-pin-modal').classList.remove('active');
});

// Confirm PIN change
document.getElementById('confirm-change-pin-btn')?.addEventListener('click', async () => {
    const currentPin = document.getElementById('current-pin-input').value.trim();
    const newPin = document.getElementById('new-pin-input').value.trim();
    const newPinConfirm = document.getElementById('new-pin-confirm-input').value.trim();
    
    // Validation
    if (!currentPin || currentPin.length !== 6) {
        alert('Please enter your current 6-digit PIN');
        return;
    }
    
    if (!newPin || newPin.length !== 6) {
        alert('Please enter a new 6-digit PIN');
        return;
    }
    
    if (newPin !== newPinConfirm) {
        alert('New PINs do not match');
        return;
    }
    
    if (currentPin === newPin) {
        alert('New PIN must be different from current PIN');
        return;
    }
    
    try {
        // Verify current PIN by attempting to decrypt unlock token
        const result = await storageGet(['blockpass-unlock-token']);
        
        if (!result || !result['blockpass-unlock-token']) {
            alert('No unlock token found. Cannot change PIN.');
            return;
        }
        
        // Try to decrypt with current PIN (will throw if wrong)
        await decryptUnlockToken(result['blockpass-unlock-token'], currentPin);
        
        // Current PIN is correct, create new unlock token with new PIN
        const newUnlockToken = await createUnlockToken(vault.mnemonic, vault.salt, newPin);
        await storageSet({ 'blockpass-unlock-token': newUnlockToken });
        
        // Update vault PIN
        vault.pin = newPin;
        await saveVault();
        
        // Close modal and show success
        document.getElementById('change-pin-modal').classList.remove('active');
        alert('PIN changed successfully! Use your new PIN next time you unlock.');
        
        console.log('PIN changed successfully');
        
    } catch (error) {
        console.error('Error changing PIN:', error);
        alert('Current PIN is incorrect. Please try again.');
    }
});

// Export vault
document.getElementById('export-vault-btn')?.addEventListener('click', async () => {
    try {
        // Create export data with encrypted passwords
        const exportData = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            username: vault.username,
            passwords: vault.passwords, // Already encrypted
            salt: vault.salt,
            sessionTimeout: vault.sessionTimeout,
            theme: vault.theme,
            auditEnabled: vault.auditEnabled,
            backupIP: vault.backupIP
        };
        
        // Encrypt the entire export with master key
        const exportJSON = JSON.stringify(exportData);
        const encryptedExport = await encryptData(exportJSON, masterKey);
        
        // Create download
        const blob = new Blob([JSON.stringify({
            encrypted: encryptedExport,
            exportedAt: exportData.exportedAt,
            version: exportData.version
        }, null, 2)], { type: 'application/json' });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `blockpass-vault-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification('Vault exported successfully!');
    } catch (error) {
        console.error('Export error:', error);
        alert('Failed to export vault: ' + error.message);
    }
});

// Import vault
document.getElementById('import-vault-btn')?.addEventListener('click', () => {
    document.getElementById('import-file-input').click();
});

document.getElementById('import-file-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                
                if (!importedData.encrypted || !importedData.version) {
                    alert('Invalid vault file format');
                    return;
                }
                
                // Decrypt the import
                const decryptedJSON = await decryptData(importedData.encrypted, masterKey);
                const importedVault = JSON.parse(decryptedJSON);
                
                // Confirm import
                const confirmMsg = `Import vault data?\n\nUsername: ${importedVault.username}\nPasswords: ${importedVault.passwords?.length || 0}\nExported: ${new Date(importedVault.exportedAt).toLocaleString()}\n\nThis will MERGE with your current vault.`;
                
                if (!confirm(confirmMsg)) {
                    return;
                }
                
                // Merge passwords (avoid duplicates by ID)
                const existingIds = new Set(vault.passwords.map(p => p.id));
                const newPasswords = importedVault.passwords.filter(p => !existingIds.has(p.id));
                
                vault.passwords.push(...newPasswords);
                
                // Update settings if they were exported
                if (importedVault.sessionTimeout !== undefined) {
                    vault.sessionTimeout = importedVault.sessionTimeout;
                }
                if (importedVault.backupIP) {
                    vault.backupIP = importedVault.backupIP;
                }
                
                // Save merged vault
                await saveVault();
                renderPasswordList();
                
                showNotification(`Imported ${newPasswords.length} new passwords!`);
                
            } catch (error) {
                console.error('Import parse error:', error);
                alert('Failed to import vault: Invalid or corrupted file');
            }
        };
        
        reader.readAsText(file);
        
    } catch (error) {
        console.error('Import error:', error);
        alert('Failed to import vault: ' + error.message);
    }
    
    // Reset file input
    e.target.value = '';
});

// Show mnemonic
document.getElementById('show-mnemonic-btn')?.addEventListener('click', () => {
    // In production, require authentication first
    alert('Your recovery phrase:\n\n' + vault.mnemonic + '\n\nKeep this safe!');
});

// ===== SESSION MANAGEMENT =====

/**
 * Lock the vault - clears sensitive data from memory but keeps unlock token
 */
async function lockVault() {
    // Stop activity tracking
    stopActivityTracking();
    
    // Clear sensitive data from memory
    vault.mnemonic = '';
    masterKey = null;
    sessionActive = false;
    
    console.log('Vault locked');
    
    // Check if unlock token exists
    const result = await storageGet(['blockpass-unlock-token']);
    
    if (result && result['blockpass-unlock-token']) {
        // Show quick unlock screen
        document.getElementById('quick-unlock-pin').value = '';
        showScreen('quick-unlock-screen');
    } else {
        // No unlock token, require full recovery
        showScreen('recover-vault-screen');
    }
}

/**
 * Clear session - removes unlock token and requires mnemonic on next login
 */
async function clearSession() {
    // Stop activity tracking
    stopActivityTracking();
    
    // Clear sensitive data
    vault.mnemonic = '';
    vault.pin = '';
    masterKey = null;
    sessionActive = false;
    
    // Reset rate limiting
    resetPinAttempts();
    
    // Remove unlock token from storage
    try {
        await chrome.storage.local.remove(['blockpass-unlock-token']);
        console.log('Unlock token removed');
    } catch (error) {
        console.error('Error removing unlock token:', error);
    }
}

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
            salt: vault.salt,
            sessionTimeout: vault.sessionTimeout
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
        
        // 🔗 BLOCKCHAIN AUDIT LOGGING
        if (vault.auditEnabled && typeof logVaultToBlockchain === 'function') {
            try {
                const encryptedJSON = JSON.stringify(storedVault);
                const blockchainResult = await logVaultToBlockchain(encryptedJSON, 'save');
                
                if (blockchainResult.success) {
                    console.log('✅ Vault logged to blockchain:', blockchainResult.hash);
                    updateAuditInfo(blockchainResult.hash, new Date().toLocaleString());
                } else {
                    console.warn('⚠️ Blockchain logging failed:', blockchainResult.error);
                }
            } catch (blockchainError) {
                console.error('Blockchain audit error:', blockchainError);
                // Don't fail the save operation if blockchain logging fails
            }
        }
        
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
        vault.sessionTimeout = decryptedVault.sessionTimeout !== undefined ? decryptedVault.sessionTimeout : 15;
        
        // Update UI for session timeout
        const timeoutSelect = document.getElementById('session-timeout-select');
        if (timeoutSelect) {
            timeoutSelect.value = vault.sessionTimeout.toString();
        }
        
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
    console.log('BlockPass initializing...');
    
    try {
        // Check for existing vault and unlock token
        const storage = await storageGet(['blockpass-vault', 'blockpass-unlock-token', 'pendingSave']);
        
        const hasVault = storage && storage['blockpass-vault'];
        const hasUnlockToken = storage && storage['blockpass-unlock-token'];
        const pendingSave = storage && storage['pendingSave'];
        
        if (hasVault && hasUnlockToken) {
            // Vault exists with unlock token - show quick unlock screen
            console.log('Vault found with unlock token. Showing quick unlock screen.');
            showScreen('quick-unlock-screen');
            
            // Check for pending password save after unlock
            if (pendingSave) {
                // Store for later processing
                window.pendingPasswordSave = pendingSave;
            }
        } else if (hasVault && !hasUnlockToken) {
            // Vault exists but no unlock token - require full recovery phrase
            console.log('Vault found without unlock token. Please enter recovery phrase.');
            showScreen('recover-vault-screen');
            
            if (pendingSave) {
                window.pendingPasswordSave = pendingSave;
            }
        } else {
            // No vault - show onboarding
            console.log('No vault found. Showing onboarding.');
            showScreen('onboarding-screen');
        }
    } catch (error) {
        console.error('Initialization error:', error);
        showScreen('onboarding-screen');
    }
});
