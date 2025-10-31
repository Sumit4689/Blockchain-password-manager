import { network } from "hardhat";

async function main() {
  console.log("Deploying VaultAudit contract...");

  // Connect to the network
  const { ethers } = await network.connect({
    network: "hardhatMainnet",
    chainType: "l1",
  });

  const networkInfo = await ethers.provider.getNetwork();
  console.log("Chain ID:", networkInfo.chainId);

  // Get the contract factory
  const VaultAudit = await ethers.getContractFactory("VaultAudit");

  // Deploy the contract
  console.log("Deployment in progress...");
  const vaultAudit = await VaultAudit.deploy();

  await vaultAudit.waitForDeployment();

  const address = await vaultAudit.getAddress();
  console.log("✅ VaultAudit deployed to:", address);

  // Get deployer info
  const [deployer] = await ethers.getSigners();
  console.log("Deployed by:", deployer.address);
  console.log("Deployer balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // Log initial state
  const totalLogs = await vaultAudit.totalLogs();
  console.log("Initial total logs:", totalLogs.toString());

  // Save deployment info
  console.log("\n📝 Save this information:");
  console.log("=====================================");
  console.log("Contract Address:", address);
  console.log("Chain ID:", networkInfo.chainId);
  console.log("Block Number:", await ethers.provider.getBlockNumber());
  console.log("=====================================\n");

  // Test log a sample vault hash
  console.log("Testing logVault function...");
  const testHash = ethers.keccak256(ethers.toUtf8Bytes("test vault data"));
  const tx = await vaultAudit.logVault(testHash, "deploy-test");
  await tx.wait();
  console.log("✅ Test vault logged with hash:", testHash);

  const newTotalLogs = await vaultAudit.totalLogs();
  console.log("Total logs after test:", newTotalLogs.toString());

  // Get the log count for deployer
  const logCount = await vaultAudit.getUserLogCount(deployer.address);
  console.log("Deployer log count:", logCount.toString());

  if (logCount > 0n) {
    const latestLog = await vaultAudit.getLatestLog(deployer.address);
    console.log("Latest log:");
    console.log("  - Hash:", latestLog.vaultHash);
    console.log("  - User:", latestLog.user);
    console.log("  - Timestamp:", new Date(Number(latestLog.timestamp) * 1000).toLocaleString());
    console.log("  - Operation:", latestLog.operation);
  }

  console.log("\n🎉 Deployment and testing complete!");
  console.log("\n⚠️  NOTE: This is deployed to Hardhat's in-memory network.");
  console.log("For persistent deployment, use Ganache or a local Hardhat node:");
  console.log("  1. Run: npx hardhat node (in a separate terminal)");
  console.log("  2. Deploy: npx hardhat run scripts/deploy-vault-audit-local.ts --network localhost");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
