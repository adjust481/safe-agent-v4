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
  const tokenA = await MockERC20.deploy("Mock USD", "mUSD");
  await tokenA.waitForDeployment();
  const tokenAAddress = await tokenA.getAddress();

  const tokenB = await MockERC20.deploy("Mock USDC", "mUSDC");
  await tokenB.waitForDeployment();
  const tokenBAddress = await tokenB.getAddress();

  // Ensure token0 < token1 for PoolManager
  let token, token0Addr, token1, token1Addr;
  if (tokenAAddress.toLowerCase() < tokenBAddress.toLowerCase()) {
    token = tokenA;
    token0Addr = tokenAAddress;
    token1 = tokenB;
    token1Addr = tokenBAddress;
  } else {
    token = tokenB;
    token0Addr = tokenBAddress;
    token1 = tokenA;
    token1Addr = tokenAAddress;
  }

  console.log("  MockERC20 (mUSD) deployed at:", tokenAAddress);
  console.log("  MockERC20 (mUSDC) deployed at:", tokenBAddress);
  console.log("  Using token0:", token0Addr);
  console.log("  Using token1:", token1Addr);
  console.log();

  // ========== 步骤 3：部署 SafeAgentVault ==========
  console.log("Step 3: Deploying SafeAgentVault...");
  const SafeAgentVault = await ethers.getContractFactory("SafeAgentVault");
  const vault = await SafeAgentVault.deploy(token0Addr);
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
  const swapHelper = await PoolSwapHelper.deploy(
    poolManagerAddress,
    token0Addr,
    token1Addr
  );
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
  const ensName = "agent.safe.eth";
  const ensNode = ethers.namehash(ensName);
  const maxNotionalPerTrade = ethers.parseUnits("100", 18);

  // Compute routeId for Phase 5
  const routeId = await vault.computeRouteId(token0Addr, token1Addr, 3000, poolAddress);
  const allowedRoutes = [routeId];

  await vault
    .connect(deployer)
    .setAgentConfig(
      agent.address,
      true,
      ensNode,
      allowedRoutes,
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
  console.log("    allowedRoutes        :", agentConfig.allowedRoutes);
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
    .executeSwap(user.address, routeId, true, amountIn, minOut);
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
    console.log("    ensNode    :", parsed.args.ensNode);
    console.log("    routeId    :", parsed.args.routeId);
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

  // ========== 落盘部署信息 ==========
  console.log("\nStep 12: Writing deployment info to deployments/localhost.json...");
  const fs = require("fs");
  const path = require("path");

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(deploymentsDir, { recursive: true });

  const network = await ethers.provider.getNetwork();
  const deploymentInfo = {
    network: "localhost",
    chainId: Number(network.chainId),
    rpcUrl: "http://127.0.0.1:8545",
    ensName: ensName,
    addresses: {
      token0: token0Addr,
      token1: token1Addr,
      vault: vaultAddress,
      poolManager: poolManagerAddress,
      poolSwapHelper: swapHelperAddress,
      poolAddress: poolAddress
    },
    actors: {
      user: user.address,
      agent: agent.address,
      deployer: deployer.address
    }
  };

  const deploymentPath = path.join(deploymentsDir, "localhost.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("  Deployment info written to:", deploymentPath);

  // 写入私钥信息（仅用于本地测试）
  const keysInfo = {
    warning: "DO NOT COMMIT THIS FILE - FOR LOCAL TESTING ONLY",
    deployerPrivateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // hardhat account #0
    userPrivateKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",   // hardhat account #1
    agentPrivateKey: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"  // hardhat account #2
  };

  const keysPath = path.join(deploymentsDir, "keys.local.json");
  fs.writeFileSync(keysPath, JSON.stringify(keysInfo, null, 2));
  console.log("  Keys info written to:", keysPath);
  console.log("  ⚠️  Remember: keys.local.json is gitignored for security");
  console.log();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
