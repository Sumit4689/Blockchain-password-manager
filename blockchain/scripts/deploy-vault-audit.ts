import { network } from "hardhat";

async function main() {
  console.log("Deploying VaultAudit contract...");

  // Connect to the network
  const { ethers } = await network.connect({
    network: "ganache",
    chainType: "l1",
  });

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
  console.log("Network:", (await ethers.provider.getNetwork()).name);
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
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
