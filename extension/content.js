// Content Script for BlockPass
// Runs on web pages to detect login forms and offer to save/autofill passwords

console.log('BlockPass content script loaded');

// Detect password input fields on the page
function detectPasswordFields() {
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    const usernameInputs = document.querySelectorAll('input[type="text"], input[type="email"]');
    
    if (passwordInputs.length > 0) {
        console.log('Password fields detected:', passwordInputs.length);
        
        // Add visual indicator that BlockPass is active
        passwordInputs.forEach(input => {
            if (!input.dataset.blockpassDetected) {
                input.dataset.blockpassDetected = 'true';
                addBlockPassIndicator(input);
            }
        });
    }
}

// Add visual indicator next to password field
function addBlockPassIndicator(input) {
    const indicator = document.createElement('div');
    indicator.className = 'blockpass-indicator';
    indicator.innerHTML = '🔐';
    indicator.style.cssText = `
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        cursor: pointer;
        font-size: 18px;
        z-index: 10000;
        opacity: 0.6;
        transition: opacity 0.2s;
    `;
    
    indicator.addEventListener('mouseenter', () => {
        indicator.style.opacity = '1';
    });
    
    indicator.addEventListener('mouseleave', () => {
        indicator.style.opacity = '0.6';
    });
    
    indicator.addEventListener('click', () => {
        // Open BlockPass popup or show autofill options
        chrome.runtime.sendMessage({
            action: 'autofill',
            domain: window.location.hostname
        });
    });
    
    // Position indicator relative to input
    const inputRect = input.getBoundingClientRect();
    const wrapper = input.parentElement;
    
    if (wrapper && window.getComputedStyle(wrapper).position !== 'static') {
        wrapper.style.position = 'relative';
    } else {
        input.style.position = 'relative';
    }
    
    input.parentElement?.appendChild(indicator);
}

// Detect form submission to offer password saving
function detectFormSubmission() {
    const forms = document.querySelectorAll('form');
    
    forms.forEach(form => {
        if (!form.dataset.blockpassListener) {
            form.dataset.blockpassListener = 'true';
            
            form.addEventListener('submit', (e) => {
                const passwordInput = form.querySelector('input[type="password"]');
                const usernameInput = form.querySelector('input[type="text"], input[type="email"]');
                
                if (passwordInput && usernameInput) {
                    const credentials = {
                        domain: window.location.hostname,
                        username: usernameInput.value,
                        password: passwordInput.value,
                        url: window.location.href
                    };
                    
                    // Send to background script to save
                    chrome.runtime.sendMessage({
                        action: 'save-password',
                        data: credentials
                    });
                }
            });
        }
    });
}

// Listen for messages from popup or background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'fill-password':
            // Autofill password fields with provided credentials
            fillCredentials(request.data);
            sendResponse({ success: true });
            break;
            
        case 'get-page-info':
            // Return current page information
            sendResponse({
                domain: window.location.hostname,
                url: window.location.href,
                title: document.title
            });
            break;
            
        default:
            sendResponse({ success: false, error: 'Unknown action' });
    }
});

// Fill credentials into detected form fields
function fillCredentials(credentials) {
    const usernameInput = document.querySelector('input[type="text"], input[type="email"]');
    const passwordInput = document.querySelector('input[type="password"]');
    
    if (usernameInput) {
        usernameInput.value = credentials.username;
        usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    if (passwordInput) {
        passwordInput.value = credentials.password;
        passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

// Initialize detection
detectPasswordFields();
detectFormSubmission();

// Re-check for password fields when DOM changes (for SPAs)
const observer = new MutationObserver(() => {
    detectPasswordFields();
    detectFormSubmission();
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});
