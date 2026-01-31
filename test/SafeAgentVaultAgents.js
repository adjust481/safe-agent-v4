const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SafeAgentVault - agent subaccounts & limits", function () {
  let owner;
  let user;
  let controller;
  let agent;
  let other;

  let token;
  let vault;

  beforeEach(async function () {
    [owner, user, controller, agent, other] = await ethers.getSigners();

    // 部署 MockERC20
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    token = await MockERC20.connect(owner).deploy("Mock Token", "MTK");
    await token.waitForDeployment();

    // 部署 SafeAgentVault
    const SafeAgentVault = await ethers.getContractFactory("SafeAgentVault");
    vault = await SafeAgentVault.connect(owner).deploy(await token.getAddress());
    await vault.waitForDeployment();

    // 设置 controller
    await vault.connect(owner).setController(controller.address);

    // 给 user 铸币并授权给 vault
    const mintAmount = ethers.parseUnits("1000", 18);
    await token.connect(owner).mint(user.address, mintAmount);
    await token.connect(user).approve(await vault.getAddress(), mintAmount);
  });

  it("deposit / withdraw 正常更新余额", async function () {
    const depositAmount = ethers.parseUnits("100", 18);

    await vault.connect(user).deposit(depositAmount);
    expect(await vault.balances(user.address)).to.equal(depositAmount);

    const withdrawAmount = ethers.parseUnits("40", 18);
    await vault.connect(user).withdraw(withdrawAmount);

    const expected = depositAmount - withdrawAmount;
    expect(await vault.balances(user.address)).to.equal(expected);
  });

  it("allocateToAgent / deallocateFromAgent 在主余额和子账户之间守恒", async function () {
    const depositAmount = ethers.parseUnits("200", 18);
    await vault.connect(user).deposit(depositAmount);

    const allocAmount = ethers.parseUnits("120", 18);
    await vault.connect(user).allocateToAgent(agent.address, allocAmount);

    const userBalAfterAlloc = await vault.balances(user.address);
    const agentBal = await vault.agentBalances(user.address, agent.address);

    expect(userBalAfterAlloc).to.equal(depositAmount - allocAmount);
    expect(agentBal).to.equal(allocAmount);

    const deallocAmount = ethers.parseUnits("50", 18);
    await vault.connect(user).deallocateFromAgent(agent.address, deallocAmount);

    const userBalAfterDealloc = await vault.balances(user.address);
    const agentBalAfterDealloc = await vault.agentBalances(user.address, agent.address);

    expect(userBalAfterDealloc).to.equal(depositAmount - allocAmount + deallocAmount);
    expect(agentBalAfterDealloc).to.equal(allocAmount - deallocAmount);
  });

  it("controller 可以在限额内消费 agent 额度，更新 agentBalances 和 agentSpent", async function () {
    const depositAmount = ethers.parseUnits("300", 18);
    await vault.connect(user).deposit(depositAmount);

    const allocAmount = ethers.parseUnits("150", 18);
    await vault.connect(user).allocateToAgent(agent.address, allocAmount);

    // 配置 agent 限额
    const maxPerTrade = ethers.parseUnits("80", 18);
    await vault
      .connect(owner)
      .setAgentLimits(agent.address, maxPerTrade, 0, false);

    const spendAmount = ethers.parseUnits("60", 18);

    await vault
      .connect(controller)
      .consumeAgentBalance(user.address, agent.address, spendAmount);

    const remaining = await vault.agentBalances(user.address, agent.address);
    const spent = await vault.agentSpent(user.address, agent.address);

    expect(remaining).to.equal(allocAmount - spendAmount);
    expect(spent).to.equal(spendAmount);
  });

  it("非 controller 调用 consumeAgentBalance 会被拦截", async function () {
    const depositAmount = ethers.parseUnits("200", 18);
    await vault.connect(user).deposit(depositAmount);

    const allocAmount = ethers.parseUnits("100", 18);
    await vault.connect(user).allocateToAgent(agent.address, allocAmount);

    const maxPerTrade = ethers.parseUnits("100", 18);
    await vault
      .connect(owner)
      .setAgentLimits(agent.address, maxPerTrade, 0, false);

    const spendAmount = ethers.parseUnits("50", 18);

    // 用 user 或其他地址调用，应该 revert "not controller"
    await expect(
      vault
        .connect(user)
        .consumeAgentBalance(user.address, agent.address, spendAmount)
    ).to.be.revertedWith("not controller");

    await expect(
      vault
        .connect(other)
        .consumeAgentBalance(user.address, agent.address, spendAmount)
    ).to.be.revertedWith("not controller");
  });

  it("consumeAgentBalance 超过 maxPerTrade 会失败", async function () {
    const depositAmount = ethers.parseUnits("300", 18);
    await vault.connect(user).deposit(depositAmount);

    const allocAmount = ethers.parseUnits("200", 18);
    await vault.connect(user).allocateToAgent(agent.address, allocAmount);

    const maxPerTrade = ethers.parseUnits("50", 18);
    await vault
      .connect(owner)
      .setAgentLimits(agent.address, maxPerTrade, 0, false);

    const overSpend = ethers.parseUnits("60", 18);

    await expect(
      vault
        .connect(controller)
        .consumeAgentBalance(user.address, agent.address, overSpend)
    ).to.be.revertedWith("limit: maxPerTrade");
  });
});

