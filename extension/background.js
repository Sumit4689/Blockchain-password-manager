// Background Service Worker for BlockPass
// Handles background tasks, message passing, and extension lifecycle

console.log('BlockPass background service worker loaded');

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('BlockPass installed for the first time');
        // Could open onboarding page or show welcome message
    } else if (details.reason === 'update') {
        console.log('BlockPass updated to version', chrome.runtime.getManifest().version);
    }
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Message received:', request);
    
    switch (request.action) {
        case 'backup':
            // Handle backup to server
            handleBackup(request.data)
                .then(result => sendResponse({ success: true, data: result }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true; // Keep channel open for async response
            
        case 'authenticate':
            // Handle WebAuthn or other authentication
            handleAuthentication(request.method)
                .then(result => sendResponse({ success: true, data: result }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;
            
        default:
            sendResponse({ success: false, error: 'Unknown action' });
    }
});

// Backup handler
async function handleBackup(data) {
    // In production, implement actual backup to LAN server or blockchain
    console.log('Backing up vault data:', data);
    
    // Simulate backup delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
        timestamp: Date.now(),
        status: 'success'
    };
}

// Authentication handler
async function handleAuthentication(method) {
    console.log('Authentication requested:', method);
    
    switch (method) {
        case 'biometric':
            // Implement WebAuthn biometric authentication
            // This would use navigator.credentials.get() in the popup
            return { authenticated: true, method: 'biometric' };
            
        case 'pin':
            // PIN authentication handled in popup
            return { authenticated: true, method: 'pin' };
            
        case 'usb':
            // USB security key authentication
            return { authenticated: true, method: 'usb' };
            
        default:
            throw new Error('Unknown authentication method');
    }
}

// Periodic backup reminder (every 24 hours)
chrome.alarms.create('backup-reminder', { periodInMinutes: 1440 });

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'backup-reminder') {
        console.log('Time to backup vault');
        // Could send notification to user
        chrome.notifications?.create({
            type: 'basic',
            iconUrl: 'icons/icon48.svg',
            title: 'BlockPass Backup Reminder',
            message: 'Remember to backup your password vault!'
        });
    }
});
