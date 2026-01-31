const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SafeAgentVault v0 (ERC20 vault)", function () {
  let token;      // MockERC20
  let vault;      // SafeAgentVault
  let deployer;
  let user;
  let other;

  beforeEach(async function () {
    [deployer, user, other] = await ethers.getSigners();

    // 1. 部署 MockERC20，当成“USDC”
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    token = await MockERC20.deploy("Mock USD", "mUSD");
    await token.waitForDeployment();

    // 2. 部署 SafeAgentVault，指定托管的 token
    const SafeAgentVault = await ethers.getContractFactory("SafeAgentVault");
    vault = await SafeAgentVault.deploy(await token.getAddress());
    await vault.waitForDeployment();

    // 3. 给 user 铸一点假 USDC，并预先授权给金库
    const amount = ethers.parseUnits("1000", 18);
    await token.mint(user.address, amount);
    await token.connect(user).approve(await vault.getAddress(), amount);
  });

  it("constructor 正确记录 asset 地址", async function () {
    expect(await vault.asset()).to.equal(await token.getAddress());
  });

  it("deposit: 把 token 从用户拉进金库，并更新内部余额", async function () {
    const depositAmount = ethers.parseUnits("300", 18);

    // 调用存款
    await vault.connect(user).deposit(depositAmount);

    const userVaultBal = await vault.balances(user.address);
    const vaultTokenBal = await token.balanceOf(await vault.getAddress());
    const userTokenBal = await token.balanceOf(user.address);

    expect(userVaultBal).to.equal(depositAmount);
    expect(vaultTokenBal).to.equal(depositAmount);

    // 初始 1000，存进去 300，链上余额应该还剩 700
    const expectedUserTokenBal = ethers.parseUnits("700", 18);
    expect(userTokenBal).to.equal(expectedUserTokenBal);
  });

  it("withdraw: 从金库取款，退还 token 并扣减内部余额", async function () {
    const depositAmount = ethers.parseUnits("500", 18);
    const withdrawAmount = ethers.parseUnits("200", 18);

    // 先存 500
    await vault.connect(user).deposit(depositAmount);

    // 再取 200
    await vault.connect(user).withdraw(withdrawAmount);

    const userVaultBal = await vault.balances(user.address);
    const vaultTokenBal = await token.balanceOf(await vault.getAddress());
    const userTokenBal = await token.balanceOf(user.address);

    // 金库内部：500 - 200 = 300
    const expectedVaultInternal = ethers.parseUnits("300", 18);
    expect(userVaultBal).to.equal(expectedVaultInternal);

    // 金库存的 token: 300
    expect(vaultTokenBal).to.equal(expectedVaultInternal);

    // 链上 user 的 token：1000 - 500 + 200 = 700
    const expectedUserTokenBal = ethers.parseUnits("700", 18);
    expect(userTokenBal).to.equal(expectedUserTokenBal);
  });

  it("withdraw: 超额取款应该 revert", async function () {
    const depositAmount = ethers.parseUnits("100", 18);
    const withdrawAmount = ethers.parseUnits("200", 18);

    await vault.connect(user).deposit(depositAmount);

    await expect(
      vault.connect(user).withdraw(withdrawAmount)
    ).to.be.revertedWith("insufficient balance");
  });
});

