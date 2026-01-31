/**
 * demoAgent.js
 *
 * 本地 demo 脚本，演示 SafeAgentVault 的完整工作流程（Phase 4）：
 * - 部署 MockERC20 和 SafeAgentVault
 * - 部署 mini v4 PoolManager + PoolSwapHelper
 * - 配置 Vault 的 poolSwapHelper 和 defaultRoute
 * - 用户存款
 * - 配置 Agent
 * - 用户分配余额给 Agent 子账户
 * - Agent 发起 executeSwap（真实执行 swap）
 *
 * 用法：
 *   TMPDIR=~/hh-tmp npx hardhat run scripts/demoAgent.js
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("=== SafeAgentVault Demo Script (Phase 4) ===\n");

  // ========== 步骤 1：获取 signers ==========
  console.log("Step 1: Getting signers...");
  const [deployer, user, agent, poolSigner] = await ethers.getSigners();

  console.log("  Deployer address  :", deployer.address);
  console.log("  User address      :", user.address);
  console.log("  Agent address     :", agent.address);
  console.log("  PoolSigner address:", poolSigner.address);
  console.log();

  // ========== 步骤 2：部署 MockERC20 ==========
  console.log("Step 2: Deploying MockERC20 tokens...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const token = await MockERC20.deploy("Mock USD", "mUSD");
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();

  const token1 = await MockERC20.deploy("Mock USDC", "mUSDC");
  await token1.waitForDeployment();
  const token1Address = await token1.getAddress();

  // Ensure token0 < token1 for PoolManager
  const token0Addr = tokenAddress < token1Address ? tokenAddress : token1Address;
  const token1Addr = tokenAddress < token1Address ? token1Address : tokenAddress;

  console.log("  MockERC20 (mUSD) deployed at:", tokenAddress);
  console.log("  MockERC20 (mUSDC) deployed at:", token1Address);
  console.log("  Using token0:", token0Addr);
  console.log("  Using token1:", token1Addr);
  console.log();

  // ========== 步骤 3：部署 SafeAgentVault ==========
  console.log("Step 3: Deploying SafeAgentVault...");
  const SafeAgentVault = await ethers.getContractFactory("SafeAgentVault");
  const vault = await SafeAgentVault.deploy(tokenAddress);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();

  console.log("  SafeAgentVault deployed at:", vaultAddress);
  console.log();

  // ========== 步骤 4：部署 mini v4 PoolManager ==========
  console.log("Step 4: Deploying mini v4 PoolManager...");
  const PoolManager = await ethers.getContractFactory("PoolManager");
  const poolManager = await PoolManager.deploy();
  await poolManager.waitForDeployment();
  const poolManagerAddress = await poolManager.getAddress();

  console.log("  PoolManager deployed at:", poolManagerAddress);
  console.log();

  // ========== 步骤 5：部署 PoolSwapHelper ==========
  console.log("Step 5: Deploying PoolSwapHelper...");
  const PoolSwapHelper = await ethers.getContractFactory("PoolSwapHelper");
  const swapHelper = await PoolSwapHelper.deploy(poolManagerAddress);
  await swapHelper.waitForDeployment();
  const swapHelperAddress = await swapHelper.getAddress();

  console.log("  PoolSwapHelper deployed at:", swapHelperAddress);
  console.log();

  // ========== 步骤 6：初始化 pool 并添加流动性 ==========
  console.log("Step 6: Initializing pool and adding liquidity...");
  const poolKey = {
    token0: token0Addr,
    token1: token1Addr,
    fee: 3000
  };

  await poolManager.initialize(poolKey, 0);
  console.log("  Pool initialized");

  // Add liquidity
  const liquidityAmount = ethers.parseUnits("10000", 18);
  await token.mint(deployer.address, liquidityAmount);
  await token1.mint(deployer.address, liquidityAmount);
  await token.approve(poolManagerAddress, liquidityAmount);
  await token1.approve(poolManagerAddress, liquidityAmount);
  await poolManager.addLiquidity(poolKey, liquidityAmount, liquidityAmount);
  console.log("  Added liquidity: 10000 + 10000");
  console.log();

  // Use poolSigner address as logical pool address
  const poolAddress = poolSigner.address;

  // ========== 步骤 7：配置 Vault 的 poolSwapHelper 和 defaultRoute ==========
  console.log("Step 7: Configuring vault's poolSwapHelper and defaultRoute...");
  await vault.connect(deployer).setPoolSwapHelper(swapHelperAddress);
  console.log("  Set poolSwapHelper to:", swapHelperAddress);

  await vault.connect(deployer).setDefaultRoute(
    token0Addr,
    token1Addr,
    3000,
    poolAddress
  );
  console.log("  Set defaultRoute:");
  console.log("    token0      :", token0Addr);
  console.log("    token1      :", token1Addr);
  console.log("    fee         : 3000");
  console.log("    poolAddress :", poolAddress);
  console.log();

  // ========== 步骤 8：给 user 铸 1000 mUSD 并存入 Vault ==========
  console.log("Step 8: Minting 1000 mUSD to user and depositing to vault...");
  const thousand = ethers.parseUnits("1000", 18);

  await token.mint(user.address, thousand);
  const userBalanceAfterMint = await token.balanceOf(user.address);
  console.log(
    "  User token balance after mint:",
    ethers.formatUnits(userBalanceAfterMint, 18),
    "mUSD"
  );

  await token.connect(user).approve(vaultAddress, thousand);
  console.log("  User approved vault for 1000 mUSD");

  await vault.connect(user).deposit(thousand);
  console.log("  User deposited 1000 mUSD to vault");

  const userVaultBalance = await vault.balances(user.address);
  const vaultTokenBalance = await token.balanceOf(vaultAddress);

  console.log(
    "  User vault balance (internal):",
    ethers.formatUnits(userVaultBalance, 18),
    "mUSD"
  );
  console.log(
    "  Vault token balance (actual)  :",
    ethers.formatUnits(vaultTokenBalance, 18),
    "mUSD"
  );
  console.log();

  // ========== 步骤 9：配置 Agent（setAgentConfig）==========
  console.log("Step 9: Configuring agent via setAgentConfig...");
  const ensNode = ethers.encodeBytes32String("agent.safe.eth");
  const allowedPools = [poolAddress];
  const maxNotionalPerTrade = ethers.parseUnits("100", 18);

  await vault
    .connect(deployer)
    .setAgentConfig(
      agent.address,
      true,
      ensNode,
      allowedPools,
      maxNotionalPerTrade
    );

  console.log("  Agent configured:");
  const agentConfig = await vault.agentConfigs(agent.address);
  console.log("    enabled              :", agentConfig.enabled);
  console.log(
    "    maxNotionalPerTrade  :",
    ethers.formatUnits(agentConfig.maxNotionalPerTrade, 18),
    "mUSD"
  );
  console.log("    allowedPools         :", agentConfig.allowedPools);
  console.log();

  // ========== 步骤 10：用户分配余额给 Agent 子账户 ==========
  console.log("Step 10: User allocates 200 mUSD to agent sub-account...");
  const twoHundred = ethers.parseUnits("200", 18);

  await vault.connect(user).allocateToAgent(agent.address, twoHundred);

  const userMainBalance = await vault.balances(user.address);
  const agentSubBalance = await vault.agentBalances(user.address, agent.address);

  console.log("  After allocation:");
  console.log(
    "    User main balance  :",
    ethers.formatUnits(userMainBalance, 18),
    "mUSD"
  );
  console.log(
    "    Agent sub-balance  :",
    ethers.formatUnits(agentSubBalance, 18),
    "mUSD"
  );
  console.log();

  // ========== 步骤 11：Agent 发起 executeSwap（真实 swap）==========
  console.log("Step 11: Agent executes real swap through v4 PoolManager...");
  const amountIn = ethers.parseUnits("50", 18);
  const minOut = ethers.parseUnits("1", 18);

  console.log("  Before swap:");
  console.log(
    "    Agent sub-balance:",
    ethers.formatUnits(await vault.agentBalances(user.address, agent.address), 18),
    "mUSD"
  );
  console.log(
    "    Agent spent      :",
    ethers.formatUnits(await vault.agentSpent(user.address, agent.address), 18),
    "mUSD"
  );

  const tx = await vault
    .connect(agent)
    .executeSwap(user.address, poolAddress, true, amountIn, minOut);
  const receipt = await tx.wait();

  console.log("\n  executeSwap tx hash:", receipt.hash);
  console.log("  Transaction confirmed in block:", receipt.blockNumber);

  // Parse events to get amountOut
  const swapEvent = receipt.logs.find(log => {
    try {
      const parsed = vault.interface.parseLog(log);
      return parsed && parsed.name === "AgentSwapExecuted";
    } catch {
      return false;
    }
  });

  if (swapEvent) {
    const parsed = vault.interface.parseLog(swapEvent);
    console.log("\n  AgentSwapExecuted event:");
    console.log("    agent      :", parsed.args.agent);
    console.log("    user       :", parsed.args.user);
    console.log("    pool       :", parsed.args.pool);
    console.log("    zeroForOne :", parsed.args.zeroForOne);
    console.log("    amountIn   :", ethers.formatUnits(parsed.args.amountIn, 18), "mUSD");
    console.log("    amountOut  :", ethers.formatUnits(parsed.args.amountOut, 18), "mUSD");
  }

  console.log("\n  After swap:");
  console.log(
    "    Agent sub-balance:",
    ethers.formatUnits(await vault.agentBalances(user.address, agent.address), 18),
    "mUSD"
  );
  console.log(
    "    Agent spent      :",
    ethers.formatUnits(await vault.agentSpent(user.address, agent.address), 18),
    "mUSD"
  );
  console.log(
    "    Vault token bal  :",
    ethers.formatUnits(await token.balanceOf(vaultAddress), 18),
    "mUSD"
  );
  console.log();

  console.log("=== Demo completed successfully! ===");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
