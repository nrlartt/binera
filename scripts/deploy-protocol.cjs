const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) throw new Error("No deployer. Set DEPLOYER_PRIVATE_KEY for the selected network.");
  let tokenAddress = process.env.PAYMENT_TOKEN_ADDRESS;
  if (!tokenAddress) throw new Error("Set PAYMENT_TOKEN_ADDRESS to the ERC-20 used for stake and bounties (U on BSC).");
  const arbiter = process.env.ARBITER_ADDRESS || deployer.address;
  if (!hre.ethers.isAddress(tokenAddress) || !hre.ethers.isAddress(arbiter)) throw new Error("Invalid token or arbiter address.");

  const network = await hre.ethers.provider.getNetwork();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Network: ${network.name} (${network.chainId})`);
  console.log(`Deployer: ${deployer.address} (${hre.ethers.formatEther(balance)} gas token)`);
  if (balance === 0n) throw new Error("Deployer has no gas token on this network.");

  const deployments = [];
  const record = async (name, contract) => {
    const address = await contract.getAddress();
    const receipt = await contract.deploymentTransaction()?.wait();
    deployments.push({ name, address, txHash: receipt?.hash ?? null, block: receipt?.blockNumber ?? null });
    return address;
  };

  const tokenCode = await hre.ethers.provider.getCode(tokenAddress);
  if (network.chainId !== 56n && tokenCode === "0x") {
    console.log("Payment token has no code on this network; deploying a test ERC-20 (MockERC20).");
    const token = await hre.ethers.deployContract("MockERC20");
    await token.waitForDeployment();
    tokenAddress = await record("MockERC20", token);
    await (await token.mint(deployer.address, hre.ethers.parseEther("1000000"))).wait();
    console.log(`Test payment token: ${tokenAddress} (minted 1,000,000 to deployer)`);
  }

  const stake = await hre.ethers.deployContract("BineraStake", [tokenAddress, arbiter]);
  await stake.waitForDeployment();
  await record("BineraStake", stake);

  const reputation = await hre.ethers.deployContract("BineraReputation", [deployer.address]);
  await reputation.waitForDeployment();
  await record("BineraReputation", reputation);

  const arbitration = await hre.ethers.deployContract("BineraArbitration");
  await arbitration.waitForDeployment();
  await record("BineraArbitration", arbitration);

  const vault = await hre.ethers.deployContract("BineraBountyVault", [tokenAddress]);
  await vault.waitForDeployment();
  await record("BineraBountyVault", vault);

  const config = {
    addresses: {
      stake: deployments.find(item => item.name === "BineraStake").address,
      reputation: deployments.find(item => item.name === "BineraReputation").address,
      arbitration: deployments.find(item => item.name === "BineraArbitration").address,
      vault: deployments.find(item => item.name === "BineraBountyVault").address,
    },
    paymentToken: tokenAddress,
    updatedAt: new Date().toISOString(),
  };
  fs.mkdirSync(".data", { recursive: true });
  fs.writeFileSync(".data/protocol.json", JSON.stringify(config, null, 2));
  fs.writeFileSync(`.data/protocol-deployment-${network.chainId}.json`, JSON.stringify({ chainId: Number(network.chainId), deployer: deployer.address, arbiter, ...config, deployments }, null, 2));

  console.log("Deployed:", JSON.stringify(config.addresses));
  console.log("Payment token:", tokenAddress);
  console.log("Arbiter:", arbiter);
  console.log("Config written to .data/protocol.json (gitignored).");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
