const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const U = (value) => ethers.parseEther(String(value));
async function advance(seconds) {
  await network.provider.send("evm_increaseTime", [seconds]);
  await network.provider.send("evm_mine");
}

describe("Binera on-chain protocol", function () {
  let token, owner, agent, buyer, evaluator1, evaluator2, evaluator3, outsider;

  beforeEach(async () => {
    [owner, agent, buyer, evaluator1, evaluator2, evaluator3, outsider] = await ethers.getSigners();
    token = await ethers.deployContract("MockERC20");
    await token.mint(agent.address, U(1000));
    await token.mint(buyer.address, U(1000));
  });

  describe("BineraStake", function () {
    let stake;
    beforeEach(async () => { stake = await ethers.deployContract("BineraStake", [await token.getAddress(), owner.address]); });

    it("locks a stake for the chosen period and releases it afterwards", async () => {
      await token.connect(agent).approve(await stake.getAddress(), U(100));
      await stake.connect(agent).stake(U(100), 60);
      expect(await stake.totalStaked()).to.equal(U(100));
      await expect(stake.connect(agent).unstake(U(40))).to.be.revertedWithCustomError(stake, "Locked");
      await advance(61);
      await stake.connect(agent).unstake(U(40));
      expect(await stake.totalStaked()).to.equal(U(60));
      expect((await stake.positions(agent.address)).amount).to.equal(U(60));
    });

    it("rejects oversized locks and zero amounts", async () => {
      await token.connect(agent).approve(await stake.getAddress(), U(10));
      await expect(stake.connect(agent).stake(0, 60)).to.be.revertedWithCustomError(stake, "ZeroAmount");
      await expect(stake.connect(agent).stake(U(1), 366 * 24 * 60 * 60)).to.be.revertedWithCustomError(stake, "LockTooLong");
    });

    it("allows only the arbiter to slash and never beyond the locked amount", async () => {
      await token.connect(agent).approve(await stake.getAddress(), U(50));
      await stake.connect(agent).stake(U(50), 0);
      await expect(stake.connect(outsider).slash(agent.address, buyer.address, U(10), ethers.id("case-1")))
        .to.be.revertedWithCustomError(stake, "NotArbiter");
      await stake.connect(owner).slash(agent.address, buyer.address, U(10), ethers.id("case-1"));
      const buyerBalance = await token.balanceOf(buyer.address);
      expect(buyerBalance).to.equal(U(1010));
      await expect(stake.connect(owner).slash(agent.address, buyer.address, U(41), ethers.id("case-2")))
        .to.be.revertedWithCustomError(stake, "InsufficientStake");
    });
  });

  describe("BineraReputation", function () {
    let reputation;
    beforeEach(async () => { reputation = await ethers.deployContract("BineraReputation", [owner.address]); });

    it("starts unseen agents at 5000 and moves the score with recorded outcomes", async () => {
      expect(await reputation.scoreOf(agent.address)).to.equal(5000);
      await reputation.record(agent.address, true, 200);
      await reputation.record(agent.address, true, 200);
      expect(await reputation.scoreOf(agent.address)).to.equal(5400);
      await reputation.record(agent.address, false, 1000);
      expect(await reputation.scoreOf(agent.address)).to.equal(4400);
      const stats = await reputation.stats(agent.address);
      expect(stats.jobs).to.equal(3n);
      expect(stats.won).to.equal(2n);
      expect(stats.lost).to.equal(1n);
    });

    it("caps scores and rejects unauthorized recorders or bad weights", async () => {
      await reputation.record(agent.address, true, 1000);
      for (let i = 0; i < 12; i++) await reputation.record(agent.address, true, 1000);
      expect(await reputation.scoreOf(agent.address)).to.equal(10000);
      await expect(reputation.connect(outsider).record(agent.address, true, 100)).to.be.revertedWithCustomError(reputation, "NotRecorder");
      await expect(reputation.record(agent.address, true, 0)).to.be.revertedWithCustomError(reputation, "BadWeight");
    });
  });

  describe("BineraArbitration", function () {
    let arbitration;
    beforeEach(async () => { arbitration = await ethers.deployContract("BineraArbitration"); });

    it("opens a fixed three-seat panel and resolves on two matching votes", async () => {
      await arbitration.connect(buyer).openCase(agent.address, [evaluator1.address, evaluator2.address, evaluator3.address], 300, 300);
      const opened = await arbitration.getCase(1);
      expect(opened.buyer).to.equal(buyer.address);
      expect(opened.provider).to.equal(agent.address);
      await expect(arbitration.connect(evaluator1).vote(1, true)).to.be.revertedWithCustomError(arbitration, "WrongPhase");
      await advance(301);
      await arbitration.connect(evaluator1).vote(1, true);
      const voting = await arbitration.getCase(1);
      expect(voting.phase).to.equal(2);
      expect(voting.finalVerdict).to.equal(false);
      await expect(arbitration.connect(evaluator1).vote(1, true)).to.be.revertedWithCustomError(arbitration, "AlreadyVoted");
      await expect(arbitration.connect(outsider).vote(1, true)).to.be.revertedWithCustomError(arbitration, "NotSeated");
      await arbitration.connect(evaluator2).vote(1, true);
      const resolved = await arbitration.getCase(1);
      expect(resolved.phase).to.equal(3);
      expect(resolved.providerUpheld).to.equal(true);
      expect(resolved.finalVerdict).to.equal(true);
      expect(resolved.votesForProvider).to.equal(2n);
    });

    it("rejects duplicate or participant seats", async () => {
      await expect(arbitration.connect(buyer).openCase(agent.address, [evaluator1.address, evaluator1.address, evaluator2.address], 300, 300))
        .to.be.revertedWithCustomError(arbitration, "BadPanel");
      await expect(arbitration.connect(buyer).openCase(agent.address, [buyer.address, evaluator2.address, evaluator3.address], 300, 300))
        .to.be.revertedWithCustomError(arbitration, "BadPanel");
    });

    it("closes an expired split vote for the buyer and marks it non-final", async () => {
      await arbitration.connect(buyer).openCase(agent.address, [evaluator1.address, evaluator2.address, evaluator3.address], 300, 300);
      await advance(301);
      await arbitration.connect(evaluator1).vote(1, true);
      await arbitration.connect(evaluator2).vote(1, false);
      await advance(301);
      await arbitration.closeExpired(1);
      const closed = await arbitration.getCase(1);
      expect(closed.phase).to.equal(3);
      expect(closed.providerUpheld).to.equal(false);
      expect(closed.finalVerdict).to.equal(true);
    });
  });

  describe("BineraBountyVault", function () {
    let vault;
    beforeEach(async () => {
      vault = await ethers.deployContract("BineraBountyVault", [await token.getAddress()]);
      await token.connect(buyer).approve(await vault.getAddress(), U(100));
    });

    it("funds slots, releases approved work and refunds the remainder", async () => {
      const deadline = (await ethers.provider.getBlock("latest")).timestamp + 3600;
      await vault.connect(buyer).createBounty(U(10), 3, deadline);
      expect(await vault.locked()).to.equal(U(30));
      const proof = ethers.id("delivery-proof");
      await vault.connect(agent).claimSlot(1, 0, proof);
      await expect(vault.connect(outsider).approveSlot(1, 0)).to.be.revertedWithCustomError(vault, "NotCreator");
      await vault.connect(buyer).approveSlot(1, 0);
      expect(await token.balanceOf(agent.address)).to.equal(U(1010));
      expect(await vault.locked()).to.equal(U(20));
      await advance(3601);
      await vault.connect(buyer).cancelBounty(1);
      expect(await token.balanceOf(buyer.address)).to.equal(U(990));
      expect(await vault.locked()).to.equal(0);
    });

    it("prevents duplicate claims and claims after the deadline", async () => {
      const deadline = (await ethers.provider.getBlock("latest")).timestamp + 60;
      await vault.connect(buyer).createBounty(U(5), 1, deadline);
      await vault.connect(agent).claimSlot(1, 0, ethers.id("proof"));
      await expect(vault.connect(outsider).claimSlot(1, 0, ethers.id("other"))).to.be.revertedWithCustomError(vault, "WrongStatus");
      await advance(61);
      await expect(vault.connect(outsider).claimSlot(1, 0, ethers.id("late"))).to.be.revertedWithCustomError(vault, "TooLate");
    });

    it("reopens a rejected slot so a different provider can claim it", async () => {
      const deadline = (await ethers.provider.getBlock("latest")).timestamp + 600;
      await vault.connect(buyer).createBounty(U(5), 1, deadline);
      await vault.connect(agent).claimSlot(1, 0, ethers.id("first-proof"));
      await vault.connect(buyer).rejectSlot(1, 0);
      await expect(vault.connect(outsider).reopenSlot(1, 0)).to.be.revertedWithCustomError(vault, "NotCreator");
      await vault.connect(buyer).reopenSlot(1, 0);
      await vault.connect(outsider).claimSlot(1, 0, ethers.id("second-proof"));
      await vault.connect(buyer).approveSlot(1, 0);
      expect(await token.balanceOf(outsider.address)).to.equal(U(5));
    });
  });
});
