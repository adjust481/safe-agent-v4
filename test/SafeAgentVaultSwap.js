const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SafeAgentVault - executeSwap (Phase 3: risk shell)", function () {
  let token;
  let vault;
  let deployer;
  let agent;
  let other;
  let pool1;
  let pool2;

  let ensNode;
  let maxPerTrade;

  beforeEach(async function () {
    [deployer, agent, other, pool1, pool2] = await ethers.getSigners();

    // Deploy MockERC20
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    token = await MockERC20.deploy("Mock USD", "mUSD");
    await token.waitForDeployment();

    // Deploy SafeAgentVault
    const SafeAgentVault = await ethers.getContractFactory("SafeAgentVault");
    vault = await SafeAgentVault.deploy(await token.getAddress());
    await vault.waitForDeployment();

    // Configure one agent with a whitelist and per-trade cap
    ensNode = ethers.encodeBytes32String("agent1.eth");
    const pools = [pool1.address]; // pool1 is an allowed pool
    maxPerTrade = ethers.parseUnits("100", 18);

    await vault
      .connect(deployer)
      .setAgentConfig(agent.address, true, ensNode, pools, maxPerTrade);
  });

  it("allows an enabled agent to emit AgentSwapPlanned when pool is allowed and amount <= maxNotionalPerTrade", async function () {
    const amountIn = ethers.parseUnits("50", 18);
    const minAmountOut = ethers.parseUnits("49", 18);

    await expect(
      vault
        .connect(agent)
        .executeSwap(pool1.address, true, amountIn, minAmountOut)
    )
      .to.emit(vault, "AgentSwapPlanned")
      .withArgs(
        agent.address,
        ensNode,
        pool1.address,
        true,
        amountIn,
        minAmountOut
      );
  });

  it("reverts when agent is disabled", async function () {
    // Reconfigure the agent with enabled = false
    await vault
      .connect(deployer)
      .setAgentConfig(agent.address, false, ensNode, [pool1.address], maxPerTrade);

    await expect(
      vault
        .connect(agent)
        .executeSwap(pool1.address, true, ethers.parseUnits("10", 18), 0)
    ).to.be.revertedWith("agent disabled");
  });

  it("reverts when pool is not in whitelist", async function () {
    // agent is enabled, but only pool1 is allowed
    const amountIn = ethers.parseUnits("50", 18);
    const minAmountOut = ethers.parseUnits("49", 18);

    await expect(
      vault
        .connect(agent)
        .executeSwap(pool2.address, true, amountIn, minAmountOut)
    ).to.be.revertedWith("pool not allowed");
  });

  it("reverts when amount exceeds maxNotionalPerTrade", async function () {
    // maxPerTrade is 100, try to swap 150
    const amountIn = ethers.parseUnits("150", 18);
    const minAmountOut = ethers.parseUnits("145", 18);

    await expect(
      vault
        .connect(agent)
        .executeSwap(pool1.address, true, amountIn, minAmountOut)
    ).to.be.revertedWith("trade too big");
  });

  it("reverts when non-configured agent tries to execute swap", async function () {
    // 'other' signer never had setAgentConfig called
    const amountIn = ethers.parseUnits("50", 18);
    const minAmountOut = ethers.parseUnits("49", 18);

    await expect(
      vault
        .connect(other)
        .executeSwap(pool1.address, true, amountIn, minAmountOut)
    ).to.be.revertedWith("agent disabled");
  });

  it("allows multiple swaps within limits", async function () {
    const amountIn = ethers.parseUnits("30", 18);
    const minAmountOut = ethers.parseUnits("29", 18);

    // First swap
    await expect(
      vault
        .connect(agent)
        .executeSwap(pool1.address, true, amountIn, minAmountOut)
    )
      .to.emit(vault, "AgentSwapPlanned")
      .withArgs(
        agent.address,
        ensNode,
        pool1.address,
        true,
        amountIn,
        minAmountOut
      );

    // Second swap
    await expect(
      vault
        .connect(agent)
        .executeSwap(pool1.address, false, amountIn, minAmountOut)
    )
      .to.emit(vault, "AgentSwapPlanned")
      .withArgs(
        agent.address,
        ensNode,
        pool1.address,
        false,
        amountIn,
        minAmountOut
      );
  });

  it("reverts when pool address is zero", async function () {
    const amountIn = ethers.parseUnits("50", 18);
    const minAmountOut = ethers.parseUnits("49", 18);

    await expect(
      vault
        .connect(agent)
        .executeSwap(ethers.ZeroAddress, true, amountIn, minAmountOut)
    ).to.be.revertedWith("pool=0");
  });

  it("reverts when amount is zero", async function () {
    await expect(
      vault
        .connect(agent)
        .executeSwap(pool1.address, true, 0, 0)
    ).to.be.revertedWith("amount=0");
  });

  it("allows owner to update agent config and new limits apply", async function () {
    // Update maxNotionalPerTrade to 50
    const newMaxPerTrade = ethers.parseUnits("50", 18);
    await vault
      .connect(deployer)
      .setAgentConfig(agent.address, true, ensNode, [pool1.address], newMaxPerTrade);

    // Try to swap 60 (should fail now)
    const amountIn = ethers.parseUnits("60", 18);
    await expect(
      vault
        .connect(agent)
        .executeSwap(pool1.address, true, amountIn, 0)
    ).to.be.revertedWith("trade too big");

    // Try to swap 40 (should succeed)
    const validAmount = ethers.parseUnits("40", 18);
    await expect(
      vault
        .connect(agent)
        .executeSwap(pool1.address, true, validAmount, 0)
    ).to.emit(vault, "AgentSwapPlanned");
  });

  it("allows owner to add multiple pools to whitelist", async function () {
    // Add both pool1 and pool2 to whitelist
    const pools = [pool1.address, pool2.address];
    await vault
      .connect(deployer)
      .setAgentConfig(agent.address, true, ensNode, pools, maxPerTrade);

    const amountIn = ethers.parseUnits("50", 18);

    // Both pools should work now
    await expect(
      vault
        .connect(agent)
        .executeSwap(pool1.address, true, amountIn, 0)
    ).to.emit(vault, "AgentSwapPlanned");

    await expect(
      vault
        .connect(agent)
        .executeSwap(pool2.address, true, amountIn, 0)
    ).to.emit(vault, "AgentSwapPlanned");
  });
});
