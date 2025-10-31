# Two Options for Blockchain Deployment

## ✅ Option 1: Hardhat Node (RECOMMENDED - Easier)

### Step 1: Start Hardhat Node
Open a **new terminal** and run:
```bash
cd blockchain
npx hardhat node
```

Leave this running! You'll see 20 accounts with 10,000 ETH each.

### Step 2: Copy an Account's Private Key
From the Hardhat node terminal, copy any private key (without 0x):
```
Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Private Key: ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

### Step 3: Deploy Contract
In your **original terminal**:
```bash
npx hardhat run scripts/deploy-vault-audit-local.ts --network localhost
```

Copy the contract address!

### Step 4: Update Extension blockchain.js
Edit `extension/blockchain.js`:
```javascript
const BLOCKCHAIN_CONFIG = {
    enabled: false,
    contractAddress: "0x5FbDB2315678afecb367f032d93F642f64180aa3", // Your address
    rpcUrl: "http://127.0.0.1:8545", // Hardhat node port
    privateKey: "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
};
```

### Step 5: Use BlockPass
- Load extension
- Go to Settings → Blockchain Audit
- Click "Configure Blockchain"
- Enter contract address and private key
- Enable audit logging

**Advantages:**
- ✅ No additional software needed
- ✅ Comes with Hardhat
- ✅ 20 accounts with 10,000 ETH each
- ✅ Shows transactions in terminal
- ✅ Easier setup

**Disadvantage:**
- ⚠️ No GUI (command-line only)

---

## Option 2: Ganache (GUI but More Setup)

### Step 1: Install & Start Ganache
1. Download from: https://trufflesuite.com/ganache/
2. Open Ganache
3. Click "Quickstart Ethereum"
4. Verify RPC: `http://127.0.0.1:7545`

### Step 2: Get Private Key
- Click 🔑 icon next to any account
- Copy private key (without 0x)

### Step 3: Deploy Contract
```bash
cd blockchain
npx hardhat run scripts/deploy-vault-audit.ts --network ganache
```

**⚠️ If you get "insufficient funds" error:**
The default Ganache mnemonic may have changed. You have two options:

**Option A: Use Custom Mnemonic**
1. In Ganache, go to Settings → Accounts & Keys
2. Copy the mnemonic
3. Edit `blockchain/hardhat.config.ts`:
```typescript
ganache: {
  type: "http",
  chainType: "l1",
  url: "http://127.0.0.1:7545",
  accounts: {
    mnemonic: "YOUR_GANACHE_MNEMONIC_HERE",
  },
},
```

**Option B: Use Direct Private Key**
Edit `blockchain/hardhat.config.ts`:
```typescript
ganache: {
  type: "http",
  chainType: "l1",
  url: "http://127.0.0.1:7545",
  accounts: ["0xYOUR_PRIVATE_KEY_HERE"], // Include 0x prefix
},
```

### Step 4: Update Extension
Edit `extension/blockchain.js`:
```javascript
const BLOCKCHAIN_CONFIG = {
    enabled: false,
    contractAddress: "0xYOUR_CONTRACT_ADDRESS",
    rpcUrl: "http://127.0.0.1:7545", // Ganache port
    privateKey: "YOUR_PRIVATE_KEY", // without 0x
};
```

**Advantages:**
- ✅ Nice GUI
- ✅ Visual transaction list
- ✅ Block explorer
- ✅ Account management

**Disadvantage:**
- ⚠️ Requires separate installation
- ⚠️ Mnemonic configuration needed

---

## Recommended Workflow

**For Testing/Development:**
Use **Hardhat Node** (Option 1) - it's simpler and requires no extra software.

**For Demonstrations:**
Use **Ganache** (Option 2) - the GUI looks more professional.

---

## Quick Test After Deployment

1. Open BlockPass extension
2. Save a password
3. Check browser console (F12)
4. You should see:
```
📝 Logging to blockchain: {operation: 'save', hash: '0x...', address: '0x...'}
⏳ Transaction sent: 0x...
✅ Transaction confirmed in block: 2
```

5. In Hardhat Node terminal OR Ganache GUI:
   - See your transaction!

---

## Troubleshooting

### Hardhat Node Issues

**"Connection refused"**
- Make sure `npx hardhat node` is running in another terminal
- Check port 8545 is not blocked

**"Nonce too high"**
- Restart Hardhat node
- Redeploy contract

### Ganache Issues

**"Insufficient funds"**
- See Option A or B above
- Make sure account has ETH

**"Invalid opcode" (FIXED)**
- We updated Solidity to 0.8.19 (Ganache-compatible)
- Run `npx hardhat clean` then `npx hardhat compile`

---

## Files Updated for Compatibility

✅ `VaultAudit.sol` - Changed from ^0.8.28 to ^0.8.0
✅ `hardhat.config.ts` - Changed compiler to 0.8.19
✅ `Counter.sol` - Changed to ^0.8.0 for consistency
✅ Created `deploy-vault-audit-local.ts` for Hardhat node

---

**Choose your option and start logging to the blockchain!** 🚀
