const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SafeAgentVault - executeSwap (Phase 5: routeId-based swap)", function () {
  let deployer, user, agent, other, poolSigner;
  let token0, token1;
  let token0Addr, token1Addr;
  let vault, poolManager, swapHelper;
  let poolAddress;
  let routeId;  // Phase 5: use routeId instead of poolAddress
  let ensNode, maxPerTrade;

  beforeEach(async function () {
    // Get signers
    [deployer, user, agent, other, poolSigner] = await ethers.getSigners();

    // Deploy two MockERC20 tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const tokenA = await MockERC20.deploy("Token A", "TKA");
    await tokenA.waitForDeployment();
    const tokenB = await MockERC20.deploy("Token B", "TKB");
    await tokenB.waitForDeployment();

    const addrA = await tokenA.getAddress();
    const addrB = await tokenB.getAddress();

    // Force token0 < token1 by address sorting
    if (addrA.toLowerCase() < addrB.toLowerCase()) {
      token0 = tokenA;
      token1 = tokenB;
      token0Addr = addrA;
      token1Addr = addrB;
    } else {
      token0 = tokenB;
      token1 = tokenA;
      token0Addr = addrB;
      token1Addr = addrA;
    }

    // Deploy SafeAgentVault with token0 as the asset
    const SafeAgentVault = await ethers.getContractFactory("SafeAgentVault");
    vault = await SafeAgentVault.deploy(token0Addr);
    await vault.waitForDeployment();

    // Deploy PoolManager
    const PoolManager = await ethers.getContractFactory("PoolManager");
    poolManager = await PoolManager.deploy();
    await poolManager.waitForDeployment();

    // Initialize pool with sorted tokens
    const poolKey = {
      token0: token0Addr,
      token1: token1Addr,
      fee: 3000
    };
    const initialSqrtPriceX96 = 1n << 96n;
    await poolManager.initialize(poolKey, initialSqrtPriceX96);

    // Add liquidity to the pool
    const liquidityAmount = ethers.parseUnits("10000", 18);
    await token0.mint(deployer.address, liquidityAmount);
    await token1.mint(deployer.address, liquidityAmount);
    await token0.approve(await poolManager.getAddress(), liquidityAmount);
    await token1.approve(await poolManager.getAddress(), liquidityAmount);
    await poolManager.addLiquidity(poolKey, liquidityAmount, liquidityAmount);

    // Deploy PoolSwapHelper with token addresses
    const PoolSwapHelper = await ethers.getContractFactory("PoolSwapHelper");
    swapHelper = await PoolSwapHelper.deploy(
      await poolManager.getAddress(),
      token0Addr,
      token1Addr
    );
    await swapHelper.waitForDeployment();

    // Use poolSigner address as logical pool address
    poolAddress = poolSigner.address;

    // Configure vault
    await vault.connect(deployer).setPoolSwapHelper(await swapHelper.getAddress());
    await vault.connect(deployer).setDefaultRoute(
      token0Addr,
      token1Addr,
      3000,
      poolAddress
    );

    // Give user tokens and deposit to vault
    const userAmount = ethers.parseUnits("1000", 18);
    await token0.mint(user.address, userAmount);
    await token0.connect(user).approve(await vault.getAddress(), userAmount);
    await vault.connect(user).deposit(userAmount);

    // Allocate to agent
    const allocAmount = ethers.parseUnits("200", 18);
    await vault.connect(user).allocateToAgent(agent.address, allocAmount);

    // Compute routeId for Phase 5
    routeId = await vault.computeRouteId(token0Addr, token1Addr, 3000, poolAddress);

    // Configure agent with routeId
    ensNode = ethers.encodeBytes32String("agent.safe.eth");
    maxPerTrade = ethers.parseUnits("100", 18);
    await vault
      .connect(deployer)
      .setAgentConfig(agent.address, true, ensNode, [routeId], maxPerTrade);
  });

  it("allows an enabled agent to execute real swap and emit AgentSwapExecuted", async function () {
    const amountIn = ethers.parseUnits("50", 18);
    const minAmountOut = 0n;

    const balanceBefore = await vault.agentBalances(user.address, agent.address);
    const spentBefore = await vault.agentSpent(user.address, agent.address);

    await expect(
      vault
        .connect(agent)
        .executeSwap(user.address, routeId, true, amountIn, minAmountOut)
    ).to.emit(vault, "AgentSwapExecuted");

    const balanceAfter = await vault.agentBalances(user.address, agent.address);
    const spentAfter = await vault.agentSpent(user.address, agent.address);

    expect(balanceAfter).to.equal(balanceBefore - amountIn);
    expect(spentAfter).to.equal(spentBefore + amountIn);
  });

  it("reverts when agent is disabled", async function () {
    await vault
      .connect(deployer)
      .setAgentConfig(agent.address, false, ensNode, [routeId], maxPerTrade);

    const amountIn = ethers.parseUnits("10", 18);
    await expect(
      vault
        .connect(agent)
        .executeSwap(user.address, routeId, true, amountIn, 0n)
    ).to.be.revertedWith("agent disabled");
  });

  it("reverts when route is not in whitelist", async function () {
    const wrongRouteId = ethers.encodeBytes32String("wrong-route");

    await vault
      .connect(deployer)
      .setAgentConfig(agent.address, true, ensNode, [wrongRouteId], maxPerTrade);

    const amountIn = ethers.parseUnits("50", 18);
    await expect(
      vault
        .connect(agent)
        .executeSwap(user.address, routeId, true, amountIn, 0n)
    ).to.be.revertedWith("route not allowed");
  });

  it("reverts when amount exceeds maxNotionalPerTrade", async function () {
    const amountIn = ethers.parseUnits("200", 18);
    await expect(
      vault
        .connect(agent)
        .executeSwap(user.address, routeId, true, amountIn, 0n)
    ).to.be.revertedWith("trade too big");
  });

  it("reverts when non-configured agent tries to execute swap", async function () {
    const amountIn = ethers.parseUnits("50", 18);
    await expect(
      vault
        .connect(other)
        .executeSwap(user.address, routeId, true, amountIn, 0n)
    ).to.be.revertedWith("agent disabled");
  });

  it("reverts when route does not exist", async function () {
    const nonExistentRouteId = ethers.encodeBytes32String("non-existent");
    const amountIn = ethers.parseUnits("50", 18);
    await expect(
      vault
        .connect(agent)
        .executeSwap(user.address, nonExistentRouteId, true, amountIn, 0n)
    ).to.be.revertedWith("route not exists");
  });

  it("reverts when amount is zero", async function () {
    await expect(
      vault
        .connect(agent)
        .executeSwap(user.address, routeId, true, 0n, 0n)
    ).to.be.revertedWith("amount=0");
  });

  it("reverts when user address is zero", async function () {
    const amountIn = ethers.parseUnits("50", 18);
    await expect(
      vault
        .connect(agent)
        .executeSwap(ethers.ZeroAddress, routeId, true, amountIn, 0n)
    ).to.be.revertedWith("user=0");
  });

  it("reverts when poolSwapHelper is not set", async function () {
    // Deploy a fresh vault without helper
    const SafeAgentVault = await ethers.getContractFactory("SafeAgentVault");
    const freshVault = await SafeAgentVault.deploy(token0Addr);
    await freshVault.waitForDeployment();

    // Set defaultRoute
    await freshVault.connect(deployer).setDefaultRoute(
      token0Addr,
      token1Addr,
      3000,
      poolAddress
    );

    // Compute routeId
    const freshRouteId = await freshVault.computeRouteId(token0Addr, token1Addr, 3000, poolAddress);

    // Configure agent
    await freshVault
      .connect(deployer)
      .setAgentConfig(agent.address, true, ensNode, [freshRouteId], maxPerTrade);

    // Give user tokens and allocate
    const depositAmount = ethers.parseUnits("100", 18);
    await token0.mint(user.address, depositAmount);
    await token0.connect(user).approve(await freshVault.getAddress(), depositAmount);
    await freshVault.connect(user).deposit(depositAmount);
    await freshVault.connect(user).allocateToAgent(agent.address, ethers.parseUnits("50", 18));

    const amountIn = ethers.parseUnits("10", 18);
    await expect(
      freshVault
        .connect(agent)
        .executeSwap(user.address, freshRouteId, true, amountIn, 0n)
    ).to.be.revertedWith("poolSwapHelper not set");
  });

  it("allows multiple swaps within limits", async function () {
    const amountIn = ethers.parseUnits("30", 18);

    // First swap (zeroForOne = true)
    await expect(
      vault
        .connect(agent)
        .executeSwap(user.address, routeId, true, amountIn, 0n)
    ).to.emit(vault, "AgentSwapExecuted");

    // Second swap (also zeroForOne = true, same direction)
    await expect(
      vault
        .connect(agent)
        .executeSwap(user.address, routeId, true, amountIn, 0n)
    ).to.emit(vault, "AgentSwapExecuted");

    // Check total spent
    const spent = await vault.agentSpent(user.address, agent.address);
    expect(spent).to.equal(amountIn * 2n);
  });
});
