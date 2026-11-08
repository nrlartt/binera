const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) throw new Error("No deployer. Set DEPLOYER_PRIVATE_KEY for the selected network.");
  const tokenAddress = process.env.PAYMENT_TOKEN_ADDRESS;
  if (!tokenAddress) throw new Error("Set PAYMENT_TOKEN_ADDRESS to the ERC-20 used for stake and bounties (U on BSC).");
  const arbiter = process.env.ARBITER_ADDRESS || deployer.address;
  if (!hre.ethers.isAddress(tokenAddress) || !hre.ethers.isAddress(arbiter)) throw new Error("Invalid token or arbiter address.");

  const network = await hre.ethers.provider.getNetwork();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Network: ${network.name} (${network.chainId})`);
  console.log(`Deployer: ${deployer.address} (${hre.ethers.formatEther(balance)} gas token)`);
  if (balance === 0n) throw new Error("Deployer has no gas token on this network.");

  const stake = await hre.ethers.deployContract("BineraStake", [tokenAddress, arbiter]);
  await stake.waitForDeployment();
  const reputation = await hre.ethers.deployContract("BineraReputation", [deployer.address]);
  await reputation.waitForDeployment();
  const arbitration = await hre.ethers.deployContract("BineraArbitration");
  await arbitration.waitForDeployment();
  const vault = await hre.ethers.deployContract("BineraBountyVault", [tokenAddress]);
  await vault.waitForDeployment();

  console.log("BineraStake:", await stake.getAddress());
  console.log("BineraReputation:", await reputation.getAddress());
  console.log("BineraArbitration:", await arbitration.getAddress());
  console.log("BineraBountyVault:", await vault.getAddress());
  console.log("Arbiter:", arbiter);
  console.log("Next: verify these addresses on BscScan and point the operator env at them after an independent review.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
