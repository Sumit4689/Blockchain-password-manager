# Download ethers.js for BlockPass Extension

## Why Download Locally?

Chrome extensions have strict Content Security Policy (CSP) rules that don't allow loading scripts from external CDNs for security reasons. We need to bundle ethers.js with the extension.

## Option 1: Manual Download (Recommended)

1. Open your browser and go to:
   https://cdn.ethers.io/lib/ethers-5.7.2.umd.min.js

2. Right-click → "Save As..."

3. Save to: `g:\blockchain-password-manager\extension\ethers-5.7.2.umd.min.js`

## Option 2: Using PowerShell (if network allows)

```powershell
cd g:\blockchain-password-manager\extension
Invoke-WebRequest -Uri "https://cdn.ethers.io/lib/ethers-5.7.2.umd.min.js" -OutFile "ethers-5.7.2.umd.min.js"
```

## Option 3: Using npm

```bash
cd extension
npm install ethers@5.7.2
# Then copy node_modules/ethers/dist/ethers.umd.min.js to extension/ethers-5.7.2.umd.min.js
```

## Option 4: Direct Link

Download from this alternative CDN:
https://unpkg.com/ethers@5.7.2/dist/ethers.umd.min.js

Save as `ethers-5.7.2.umd.min.js` in the extension folder.

## Verification

After downloading, check that the file exists:
- Path: `extension/ethers-5.7.2.umd.min.js`
- Size: ~280 KB
- File should start with: `(function(global,factory){`

## What Changed?

- ❌ Removed CSP entry allowing CDN
- ✅ Updated popup.html to use local file
- ✅ Extension will now load without CSP errors

## Reload Extension

After downloading ethers.js:
1. Go to `chrome://extensions/`
2. Click the reload icon for BlockPass
3. Open the extension - blockchain features should now work!
