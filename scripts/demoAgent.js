/**
 * demoAgent.js
 *
 * 本地 demo 脚本，演示 SafeAgentVault 的完整工作流程：
 * - 部署 MockERC20 和 SafeAgentVault
 * - 用户存款
 * - 配置 Agent
 * - 用户分配余额给 Agent 子账户
 * - Agent 发起 executeSwap（仅触发事件，不实际交易）
 *
 * 用法：
 *   TMPDIR=~/hh-tmp npx hardhat run scripts/demoAgent.js
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("=== SafeAgentVault Demo Script ===\n");

  // ========== 步骤 1：获取 4 个 signer ==========
  console.log("Step 1: Getting signers...");
  const [deployer, user, agent, pool1] = await ethers.getSigners();

  console.log("  Deployer address:", deployer.address);
  console.log("  User address    :", user.address);
  console.log("  Agent address   :", agent.address);
  console.log("  Pool1 address   :", pool1.address);
  console.log();

  // ========== 步骤 2：部署 MockERC20 ==========
  console.log("Step 2: Deploying MockERC20...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const token = await MockERC20.deploy("Mock USD", "mUSD");
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();

  console.log("  MockERC20 deployed at:", tokenAddress);
  console.log();

  // ========== 步骤 3：部署 SafeAgentVault ==========
  console.log("Step 3: Deploying SafeAgentVault...");
  const SafeAgentVault = await ethers.getContractFactory("SafeAgentVault");
  const vault = await SafeAgentVault.deploy(tokenAddress);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();

  console.log("  SafeAgentVault deployed at:", vaultAddress);
  console.log();

  // ========== 步骤 4：给 user 铸 1000 mUSD 并存入 Vault ==========
  console.log("Step 4: Minting 1000 mUSD to user and depositing to vault...");
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
  const userTokenBalanceAfterDeposit = await token.balanceOf(user.address);

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
  console.log(
    "  User token balance (on-chain) :",
    ethers.formatUnits(userTokenBalanceAfterDeposit, 18),
    "mUSD"
  );
  console.log();

  // ========== 步骤 5：配置 Agent（setAgentConfig）==========
  console.log("Step 5: Configuring agent via setAgentConfig...");
  const ensNode = ethers.encodeBytes32String("agent.safe.eth");
  const allowedPools = [pool1.address];
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

  // ========== 步骤 6：用户分配余额给 Agent 子账户 ==========
  console.log("Step 6: User allocates 200 mUSD to agent sub-account...");
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

  // ========== 步骤 7：Agent 发起 executeSwap ==========
  console.log(
    "Step 7: Agent executes swap (emits event only, no actual trade)..."
  );
  const amountIn = ethers.parseUnits("50", 18);
  const minOut = ethers.parseUnits("49", 18);

  const tx = await vault
    .connect(agent)
    .executeSwap(pool1.address, true, amountIn, minOut);
  const receipt = await tx.wait();

  console.log("  executeSwap tx hash:", receipt.hash);
  console.log("  Transaction confirmed in block:", receipt.blockNumber);
  console.log();

  console.log("=== Demo completed successfully! ===");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

