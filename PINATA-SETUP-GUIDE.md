# 🌐 Pinata IPFS Setup Guide for BlockPass

## Overview

BlockPass uses **Pinata** for decentralized, permanent backup storage of your encrypted vaults. This guide will help you set up IPFS backup in under 5 minutes.

---

## 🎯 What is Pinata?

- **Free permanent storage**: 1GB free tier (plenty for password vaults!)
- **Decentralized**: Your data is distributed across IPFS network
- **Privacy-first**: Only encrypted vault data is uploaded
- **No credit card**: Sign up with email only
- **Fast & Reliable**: Enterprise-grade IPFS pinning service

---

## 🚀 Quick Setup (5 Minutes)

### Step 1: Create Pinata Account

1. Visit: **https://app.pinata.cloud/**
2. Click **"Sign Up"**
3. Sign up with your email (no credit card needed)
4. Verify your email address

### Step 2: Generate JWT Token

1. Log in to Pinata
2. Go to **"API Keys"** in the left sidebar (or visit: https://app.pinata.cloud/developers/api-keys)
3. Click **"+ New Key"** button
4. Configure permissions:
   - ✅ **Check "pinFileToIPFS"** (required for uploads)
   - ✅ **Check "pinList"** (optional, for viewing uploads)
   - Name: `BlockPass-Vault-Backup`
5. Click **"Generate Key"**
6. **Copy the JWT token** - you won't see it again!

Example JWT format:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI...
```

### Step 3: Configure BlockPass Extension

1. Open **BlockPass** extension
2. Click **⚙️ Settings**
3. Scroll to **"☁️ IPFS Backup"** section
4. Click **"⚙️ Configure IPFS"**
5. Paste your Pinata JWT token
6. Click **"💾 Save IPFS Configuration"**
7. Click **"🧪 Test Connection"** to verify
8. Toggle **"Enable IPFS Decentralized Backup"** ON

---

## 🔐 How It Works

### Backup Flow

```
User saves password
        ↓
Vault encrypted with AES-GCM (local)
        ↓
Encrypted vault uploaded to Pinata IPFS
        ↓
IPFS returns Content ID (CID)
        ↓
CID + vault hash logged to blockchain
        ↓
Backup complete!
```

### Privacy & Security

✅ **What's uploaded to IPFS:**
- Encrypted vault data (ciphertext)
- Encryption metadata (IV, salt)

❌ **What's NOT uploaded:**
- Passwords (plain or encrypted individually)
- Usernames
- Recovery mnemonic
- PIN code

🔐 **Security Guarantees:**
- Vault encrypted with **AES-256-GCM** before upload
- Encryption key derived from your **12-word mnemonic**
- Without your mnemonic, encrypted data is unreadable
- CID stored on blockchain for tamper-proof audit

---

## 📦 What Gets Stored Where

| Data | Location | Encrypted? | Purpose |
|------|----------|-----------|---------|
| **Encrypted Vault** | Pinata IPFS | ✅ Yes (AES-256) | Decentralized backup |
| **IPFS CID** | Ethereum Blockchain | ❌ No (public) | Content addressing |
| **Vault Hash** | Ethereum Blockchain | ❌ No (public) | Tamper verification |
| **Mnemonic** | Your memory/paper | N/A | Vault encryption key |
| **Unencrypted Vault** | Browser Local Storage | ❌ No | Active session only |

---

## 🔄 Recovery Process

### Scenario: Lost device, need to recover vault

1. Install BlockPass on new device
2. Click **"📥 Restore from IPFS"**
3. Extension fetches latest CID from blockchain
4. Downloads encrypted vault from Pinata IPFS
5. Enter your **12-word mnemonic**
6. Vault decrypted and restored!

### Manual Recovery (if needed)

If automatic recovery fails:

1. Get your CID from blockchain:
   - Use blockchain explorer with your wallet address
   - Or enter CID manually if you saved it
2. Download from IPFS: `https://gateway.pinata.cloud/ipfs/YOUR_CID`
3. Enter recovery mnemonic
4. Vault restored

---

## 🧪 Testing Your Setup

### Test 1: Connection Test

```
Settings → IPFS Backup → Test Connection
Expected: "✅ Connected to Pinata successfully!"
```

### Test 2: Backup Test

```
1. Add a test password
2. Check browser console (F12)
3. Look for: "📤 Uploading vault to Pinata IPFS..."
4. Then: "✅ Vault uploaded to Pinata IPFS"
5. Check: "📦 CID: bafybeig..."
```

### Test 3: Recovery Test

```
1. Note down a password you added
2. Click "📥 Restore from IPFS"
3. Enter your mnemonic
4. Verify password is restored correctly
```

---

## 📊 Pinata Console

Access your backups at: **https://app.pinata.cloud/**

Features:
- View all pinned files in "Files" tab
- Check storage usage (1GB free!)
- Monitor pin status
- Manage API keys
- See IPFS CIDs and file details

---

## 🛠️ Troubleshooting

### ❌ "No JWT token configured"

**Solution:**
- Go to Settings → IPFS Backup
- Click "Configure IPFS"
- Paste your Pinata JWT token
- Save configuration

---

### ❌ "Connection test failed: 401"

**Cause:** Invalid or expired JWT token

**Solution:**
1. Log in to Pinata: https://app.pinata.cloud/
2. Go to API Keys
3. Generate new JWT token with "pinFileToIPFS" permission
4. Update token in BlockPass
5. Test connection again

---

### ❌ "Upload failed: 403 Forbidden"

**Cause:** Token doesn't have upload permissions

**Solution:**
1. Go to Pinata → API Keys
2. Delete old key
3. Create new key with **"pinFileToIPFS"** permission checked
4. Update token in extension

---

### ❌ "Download failed: CID not found"

**Cause:** Content may not be fully propagated yet

**Solution:**
1. Wait 1-2 minutes (IPFS propagation time)
2. Try recovery again
3. Or download manually: `https://gateway.pinata.cloud/ipfs/YOUR_CID`

---

### ❌ "Decryption failed" during recovery

**Cause:** Wrong mnemonic entered

**Solution:**
1. Verify your 12-word mnemonic is correct
2. Check for typos (spaces, spelling)
3. Mnemonic is case-sensitive
4. Try recovering from local backup first

---

## 💡 Best Practices

### Security
- ✅ **Write down** your 12-word mnemonic on paper
- ✅ Store mnemonic in a **safe place** (not digitally)
- ✅ Never share your JWT token publicly
- ✅ Keep backup CIDs in a secure location
- ❌ Don't store mnemonic in cloud/email

### Backups
- ✅ Test recovery flow immediately after setup
- ✅ Enable automatic IPFS backup (toggle ON)
- ✅ Monitor "Last backup" timestamp in settings
- ✅ Verify files appear in Pinata console
- ❌ Don't disable blockchain logging (needed for recovery)

### Recovery
- ✅ Keep multiple copies of your mnemonic
- ✅ Test recovery on a different device
- ✅ Save at least one CID manually as backup
- ✅ Export vault locally as additional backup
- ❌ Don't rely on memory for mnemonic

---

## 🔗 Useful Links

- **Pinata Dashboard**: https://app.pinata.cloud/
- **Pinata API Keys**: https://app.pinata.cloud/developers/api-keys
- **Pinata Docs**: https://docs.pinata.cloud/
- **IPFS Gateway**: https://gateway.pinata.cloud/ipfs/
- **Pinata Support**: https://docs.pinata.cloud/

---

## 📈 Storage Limits

| Plan | Storage | Cost | Pin Limit |
|------|---------|------|-----------|
| **Free** | 1GB | $0 | 100 pins |
| Typical vault size | ~5-50KB | - | Thousands of backups |

**Note:** BlockPass vaults are tiny (KB-sized), so 1GB = **tens of thousands of backups**!

If you need more space, Pinata's paid plans start at $20/month for 100GB.

---

## 🆘 Support

If you encounter issues:

1. **Check browser console** (F12) for error messages
2. **Verify JWT token** in Pinata console
3. **Test connection** in extension settings
4. **Check CID** appears in audit history
5. **Review** this guide's troubleshooting section
6. **Visit Pinata docs**: https://docs.pinata.cloud/

---

## 🎉 You're All Set!

Your BlockPass vault is now backed up to decentralized IPFS storage via Pinata. You can recover your passwords from anywhere, on any device, as long as you have your 12-word mnemonic.

**Next Steps:**
1. ✅ Test recovery flow on same device
2. ✅ Write down mnemonic on paper
3. ✅ Save a CID manually as backup
4. ✅ Test recovery on different device (optional)

Happy password managing! 🔐🌐
