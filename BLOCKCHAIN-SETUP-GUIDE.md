# Blockchain Integration Setup Guide

This guide will help you set up blockchain-based audit logging for BlockPass.

## Prerequisites

- Node.js and npm installed
- Ganache installed ([Download here](https://trufflesuite.com/ganache/))

## Step 1: Start Ganache

1. Open Ganache
2. Create a new workspace or use Quickstart
3. Ensure it's running on `http://127.0.0.1:7545` (default)
4. Note down one of the account addresses and its **private key** (click the key icon)

## Step 2: Deploy Smart Contract

1. Navigate to the blockchain directory:
```bash
cd blockchain
```

2. Install dependencies (if not already installed):
```bash
npm install
```

3. Compile the contract:
```bash
npx hardhat compile
```

4. Deploy to Ganache:
```bash
npx hardhat run scripts/deploy-vault-audit.ts --network ganache
```

5. **Save the output!** You'll see something like:
```
✅ VaultAudit deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
```

Copy the contract address - you'll need it!

## Step 3: Configure Extension

1. Load the extension in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `extension` folder

2. Open BlockPass extension

3. Create or unlock your vault

4. Go to **Settings** → **Blockchain Audit**

5. Click "⚙️ Configure Blockchain"

6. Enter:
   - **Contract Address**: The address from Step 2 (e.g., `0x5FbDB2315678afecb367f032d93F642f64180aa3`)
   - **Private Key**: Your Ganache account private key (without the `0x` prefix)

7. Click "💾 Save Configuration"

8. Toggle "Enable Blockchain Audit Logs" to **ON**

## Step 4: Test It Out

1. Save a password in BlockPass
2. Check the browser console (F12) - you should see:
   ```
   📝 Logging to blockchain: {...}
   ⏳ Transaction sent: 0x...
   ✅ Transaction confirmed in block: 1
   ```

3. In Ganache:
   - Go to "Transactions" tab
   - You should see a new transaction to your VaultAudit contract
   - Click on it to see the logged event

4. In BlockPass Settings:
   - Go to "Blockchain Audit" section
   - Click "📊 View Audit History"
   - You should see your logged vault hashes with timestamps

## How It Works

### Vault Save Flow
```
1. User saves password
2. Vault is encrypted with master key (AES-GCM)
3. Encrypted vault is stored in chrome.storage.local
4. Hash of encrypted vault (keccak256) is computed
5. Hash is sent to VaultAudit smart contract
6. Transaction is mined on Ganache blockchain
7. Event "VaultLogged" is emitted
8. Hash is permanently stored on blockchain
```

### Verification
```
1. Anyone can verify the vault hasn't been tampered with
2. Compare current vault hash with blockchain records
3. If hashes match → vault is authentic
4. If hashes don't match → vault was tampered with
```

## Smart Contract Functions

### `logVault(bytes32 _hash, string _operation)`
Logs a vault hash to the blockchain.
- `_hash`: keccak256 hash of encrypted vault
- `_operation`: "save", "update", "delete", etc.

### `getUserLogs(address _user)`
Returns all audit logs for a user.

### `getLatestLog(address _user)`
Returns the most recent audit log.

### `verifyHash(address _user, bytes32 _hash)`
Checks if a hash exists in user's audit trail.

## Troubleshooting

### "Blockchain audit not enabled"
- Make sure Ganache is running on `http://127.0.0.1:7545`
- Check that you've configured the contract address and private key
- Toggle the "Enable Blockchain Audit Logs" switch in Settings

### "Transaction failed" or "Network error"
- Verify Ganache is running
- Check the RPC URL is `http://127.0.0.1:7545`
- Make sure the account has enough ETH (Ganache provides 100 ETH by default)

### "Contract not found"
- Redeploy the contract
- Update the contract address in the extension configuration

### Ethers.js not loading
- Check your internet connection (CDN load)
- Open browser console (F12) and check for CSP errors
- Manifest.json should allow `https://cdn.ethers.io`

## Security Considerations

⚠️ **IMPORTANT**: This setup is for **LOCAL DEVELOPMENT ONLY**

- **Never** use Ganache private keys in production
- **Never** commit private keys to git
- For production, use:
  - Hardware wallet integration (Ledger/Trezor)
  - MetaMask injection
  - Secure key management system
  - Real blockchain network (Ethereum, Polygon, etc.)

## What's Logged to Blockchain?

✅ **Logged:**
- Keccak256 hash of encrypted vault
- User's Ethereum address
- Timestamp (block.timestamp)
- Operation type ("save", "update", etc.)

❌ **NOT Logged:**
- Passwords (encrypted or plain)
- Usernames
- Vault contents
- Recovery phrase
- PIN

Only the **hash** is logged, making the audit trail tamper-proof while preserving privacy.

## Advanced: View Logs Programmatically

Open browser console in the extension popup and run:

```javascript
// Get all audit logs
const logs = await getAuditLogs();
console.log(logs);

// Get latest log
const latest = await getLatestAuditLog();
console.log(latest);

// Verify a specific hash
const isValid = await verifyVaultHash('0xYOUR_HASH_HERE');
console.log('Hash verified:', isValid);
```

## Production Deployment

For production use on a real blockchain:

1. Deploy VaultAudit.sol to mainnet/testnet
2. Update `blockchain.js`:
   - Change `rpcUrl` to your provider (Infura, Alchemy, etc.)
   - Implement wallet connection (MetaMask)
   - Add gas estimation and optimization
3. Add user-facing wallet connection UI
4. Implement transaction confirmation dialogs
5. Add error handling for network issues

## Testing the Smart Contract

Run the included tests:

```bash
cd blockchain
npx hardhat test
```

Create a test file `test/VaultAudit.test.ts` to verify contract functionality.

---

**Need help?** Check the console logs (F12) for detailed error messages.

**Next steps:**
- Set up automatic backup to blockchain
- Add vault verification on load
- Implement multi-signature audit logs
- Add blockchain explorer link in UI
