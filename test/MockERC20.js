const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MockERC20 basic behavior", function () {
  let token;
  let deployer;
  let user;
  let spender;

  beforeEach(async function () {
    [deployer, user, spender] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    token = await MockERC20.deploy("Mock USD", "mUSD");
    await token.waitForDeployment(); // ethers v6 写法
  });

  it("部署后 name / symbol / decimals 正确", async function () {
    expect(await token.name()).to.equal("Mock USD");
    expect(await token.symbol()).to.equal("mUSD");
    expect(await token.decimals()).to.equal(18);
  });

  it("mint 会增加余额和 totalSupply", async function () {
    const amount = ethers.parseUnits("1000", 18);

    await token.mint(user.address, amount);

    const userBal = await token.balanceOf(user.address);
    const supply = await token.totalSupply();

    expect(userBal).to.equal(amount);
    expect(supply).to.equal(amount);
  });

  it("approve 会正确记录 allowance", async function () {
    const amount = ethers.parseUnits("500", 18);

    await token.mint(user.address, amount);
    await token.connect(user).approve(spender.address, amount);

    const allowed = await token.allowance(user.address, spender.address);
    expect(allowed).to.equal(amount);
  });

  it("transferFrom 会消耗 allowance 并完成转账", async function () {
    const amount = ethers.parseUnits("200", 18);

    await token.mint(user.address, amount);
    await token.connect(user).approve(spender.address, amount);

    await token
      .connect(spender)
      .transferFrom(user.address, spender.address, amount);

    const userBal = await token.balanceOf(user.address);
    const spenderBal = await token.balanceOf(spender.address);
    const allowed = await token.allowance(user.address, spender.address);

    // ethers v6 返回 bigint，这里用 0n 对比
    expect(userBal).to.equal(0n);
    expect(spenderBal).to.equal(amount);
    expect(allowed).to.equal(0n);
  });
});

