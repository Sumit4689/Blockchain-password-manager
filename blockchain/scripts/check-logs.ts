import { ethers } from "ethers";
import hre from "hardhat";

async function main() {
    const contractAddress = "0xDc417d49Bf6f1B017e6cff3a4CD4aCCe6840ee91";
    
    // Get contract factory
    const VaultAudit = await hre.artifacts.readArtifact("VaultAudit");
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:7545");
    const contract = new ethers.Contract(contractAddress, VaultAudit.abi, provider);
    
    console.log("📊 Checking VaultAudit contract logs...\n");
    
    // Get total logs
    const totalLogs = await contract.totalLogs();
    console.log(`Total logs in contract: ${totalLogs.toString()}`);
    
    if (totalLogs > 0n) {
        // Check first 10 Ganache accounts
        const accounts = await provider.listAccounts();
        
        console.log("\n🔍 Checking logs for each account:\n");
        
        for (const accountAddr of accounts) {
            const logCount = await contract.getUserLogCount(accountAddr);
            
            if (logCount > 0n) {
                console.log(`✅ Account: ${accountAddr}`);
                console.log(`   Log count: ${logCount.toString()}`);
                
                const logs = await contract.getUserLogs(accountAddr);
                logs.forEach((log: any, idx: number) => {
                    console.log(`   📝 Log ${idx}:`);
                    console.log(`      Hash: ${log.vaultHash}`);
                    console.log(`      User: ${log.user}`);
                    console.log(`      Timestamp: ${new Date(Number(log.timestamp) * 1000).toLocaleString()}`);
                    console.log(`      Operation: ${log.operation}`);
                });
                console.log();
            }
        }
    } else {
        console.log("\n⚠️ No logs found in contract!");
        console.log("Make sure you saved a password with blockchain logging enabled.");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
