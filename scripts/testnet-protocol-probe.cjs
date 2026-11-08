const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const config = JSON.parse(fs.readFileSync(".data/protocol.json", "utf8"));
  const [deployer] = await hre.ethers.getSigners();
  const token = await hre.ethers.getContractAt("MockERC20", config.paymentToken);
  const stake = await hre.ethers.getContractAt("BineraStake", config.addresses.stake);
  const vault = await hre.ethers.getContractAt("BineraBountyVault", config.addresses.vault);

  const stakeAmount = hre.ethers.parseEther("1");
  await (await token.approve(config.addresses.stake, stakeAmount)).wait();
  const stakeTx = await stake.stake(stakeAmount, 3600);
  await stakeTx.wait();
  console.log("stake tx:", stakeTx.hash);

  const reward = hre.ethers.parseEther("0.5");
  const deadline = (await hre.ethers.provider.getBlock("latest")).timestamp + 86400;
  await (await token.approve(config.addresses.vault, reward * 2n)).wait();
  const bountyTx = await vault.createBounty(reward, 2, deadline);
  await bountyTx.wait();
  console.log("bounty tx:", bountyTx.hash);

  console.log("totalStaked:", hre.ethers.formatEther(await stake.totalStaked()));
  console.log("position:", hre.ethers.formatEther((await stake.positions(deployer.address)).amount));
  console.log("bountyCount:", String(await vault.bountyCount()));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
