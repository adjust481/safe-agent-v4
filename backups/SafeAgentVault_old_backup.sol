// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title SafeAgentVault v0
/// @notice Minimal ERC20 vault: supports deposit & withdraw, tracks per-user balances.
///         之后我们会在这个基础上继续加：限额 / 白名单 / Uniswap v4 交互 / Agent 风控。
contract SafeAgentVault {
    IERC20 public immutable asset;

    // 用户在金库里的“记账余额”（不是链上整体余额，只是“存在金库里的那部分”）
    mapping(address => uint256) public balances;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    constructor(address _asset) {
        require(_asset != address(0), "asset is zero");
        asset = IERC20(_asset);
    }

    /// @notice 存款：把 ERC20 从用户地址拉进金库，并更新内部余额
    function deposit(uint256 amount) external {
        require(amount > 0, "amount=0");

        // 从 msg.sender 把 token 拉到金库
        bool ok = asset.transferFrom(msg.sender, address(this), amount);
        require(ok, "transferFrom failed");

        balances[msg.sender] += amount;

        emit Deposited(msg.sender, amount);
    }

    /// @notice 取款：从金库把 ERC20 还给用户，并更新内部余额
    function withdraw(uint256 amount) external {
        require(amount > 0, "amount=0");
        uint256 bal = balances[msg.sender];
        require(bal >= amount, "insufficient balance");

        balances[msg.sender] = bal - amount;

        bool ok = asset.transfer(msg.sender, amount);
        require(ok, "transfer failed");

        emit Withdrawn(msg.sender, amount);
    }
}

