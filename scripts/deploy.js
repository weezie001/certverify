// Deploys CertificateRegistry. Works for any configured network:
//   local:   npx hardhat run scripts/deploy.js                 (in-process, ephemeral)
//   node:    npx hardhat run scripts/deploy.js --network localhost
//   sepolia: npx hardhat run scripts/deploy.js --network sepolia
// The deployer becomes the platform admin.
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const net = hre.network.name;
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);

  console.log(`Network:  ${net}`);
  console.log(`Deployer: ${deployer.address}  (becomes platform admin)`);
  console.log(`Balance:  ${hre.ethers.formatEther(balance)} ETH\n`);

  const Factory = await hre.ethers.getContractFactory("CertificateRegistry");
  const registry = await Factory.deploy();
  await registry.waitForDeployment();
  const address = await registry.getAddress();

  console.log(`✔ CertificateRegistry deployed at: ${address}`);

  // Record the deployment.
  const dir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, `${net}.json`),
    JSON.stringify({ network: net, address, admin: deployer.address }, null, 2) + "\n"
  );

  // Keep the backend ABI in sync with what we just compiled & deployed.
  try {
    require("../backend/scripts/sync-abi.js");
  } catch (e) {
    console.warn("(could not sync backend ABI automatically:", e.message, ")");
  }

  console.log(`\nNext steps:`);
  console.log(`  • backend/.env  -> CONTRACT_ADDRESS=${address}`);
  if (net !== "hardhat") console.log(`  • backend/.env  -> RPC_URL=<your ${net} RPC url>`);
  console.log(`  • Frontend      -> open "Network settings" and paste the address`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
