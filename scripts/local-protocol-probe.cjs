const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const config = JSON.parse(fs.readFileSync(".data/protocol.json", "utf8"));
  const [deployer, provider] = await hre.ethers.getSigners();
  const token = await hre.ethers.getContractAt("MockERC20", config.paymentToken);
  const stake = await hre.ethers.getContractAt("BineraStake", config.addresses.stake);
  const vault = await hre.ethers.getContractAt("BineraBountyVault", config.addresses.vault);

  await (await token.connect(provider).approve(config.addresses.stake, hre.ethers.parseEther("100"))).wait();
  await (await stake.connect(provider).stake(hre.ethers.parseEther("100"), 3600)).wait();

  await (await token.connect(deployer).approve(config.addresses.vault, hre.ethers.parseEther("100"))).wait();
  const deadline = (await hre.ethers.provider.getBlock("latest")).timestamp + 86400;
  await (await vault.connect(deployer).createBounty(hre.ethers.parseEther("10"), 2, deadline)).wait();

  console.log("provider:", provider.address);
  console.log("staked:", hre.ethers.formatEther((await stake.positions(provider.address)).amount));
  console.log("bountyCount:", String(await vault.bountyCount()));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
