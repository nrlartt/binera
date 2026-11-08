const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer, provider] = await hre.ethers.getSigners();
  const token = await hre.ethers.deployContract("MockERC20");
  await token.waitForDeployment();
  await (await token.mint(deployer.address, hre.ethers.parseEther("100000"))).wait();
  await (await token.mint(provider.address, hre.ethers.parseEther("10000"))).wait();
  const tokenAddress = await token.getAddress();

  const stake = await hre.ethers.deployContract("BineraStake", [tokenAddress, deployer.address]);
  await stake.waitForDeployment();
  const reputation = await hre.ethers.deployContract("BineraReputation", [deployer.address]);
  await reputation.waitForDeployment();
  const arbitration = await hre.ethers.deployContract("BineraArbitration");
  await arbitration.waitForDeployment();
  const vault = await hre.ethers.deployContract("BineraBountyVault", [tokenAddress]);
  await vault.waitForDeployment();

  const config = {
    addresses: {
      stake: await stake.getAddress(),
      reputation: await reputation.getAddress(),
      arbitration: await arbitration.getAddress(),
      vault: await vault.getAddress(),
    },
    paymentToken: tokenAddress,
    updatedAt: new Date().toISOString(),
  };
  fs.mkdirSync(".data", { recursive: true });
  fs.writeFileSync(".data/protocol.json", JSON.stringify(config, null, 2));
  console.log("Local protocol deployed:", JSON.stringify(config.addresses));
  console.log("Payment token:", tokenAddress);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
