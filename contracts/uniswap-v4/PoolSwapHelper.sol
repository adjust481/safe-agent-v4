// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./PoolManager.sol";
import "../mocks/MockERC20.sol";

/// @notice Helper contract for executing swaps through PoolManager
/// @dev Simplified version that pulls tokens first, then swaps
contract PoolSwapHelper {
    PoolManager public immutable poolManager;
    MockERC20 public immutable token0;
    MockERC20 public immutable token1;

    constructor(address _poolManager, address _token0, address _token1) {
        require(_poolManager != address(0), "poolManager = 0");
        require(_token0 != address(0), "token0 = 0");
        require(_token1 != address(0), "token1 = 0");
        require(_token0 < _token1, "token0 >= token1");

        poolManager = PoolManager(_poolManager);
        token0 = MockERC20(_token0);
        token1 = MockERC20(_token1);
    }

    /// @notice Execute a swap
    /// @param key Pool key containing token addresses and fee
    /// @param zeroForOne Direction of swap (true = token0 -> token1)
    /// @param amountIn Amount of input token
    /// @return amountOut Amount of output token received
    function swap(
        PoolManager.PoolKey memory key,
        bool zeroForOne,
        uint256 amountIn
    ) external returns (uint256 amountOut) {
        require(amountIn > 0, "amountIn = 0");
        require(key.token0 == address(token0), "invalid token0");
        require(key.token1 == address(token1), "invalid token1");

        // Determine input and output tokens
        MockERC20 tokenIn = zeroForOne ? token0 : token1;
        MockERC20 tokenOut = zeroForOne ? token1 : token0;

        // Pull input tokens from caller (Vault) to this contract
        tokenIn.transferFrom(msg.sender, address(this), amountIn);

        // Approve PoolManager to spend input tokens
        tokenIn.approve(address(poolManager), amountIn);

        // Create swap params
        PoolManager.SwapParams memory params = PoolManager.SwapParams({
            zeroForOne: zeroForOne,
            amountSpecified: int256(amountIn),
            sqrtPriceLimitX96: 0 // not used in our simplified implementation
        });

        // Execute swap
        (int256 delta0, int256 delta1) = poolManager.swap(key, params, "");

        // Calculate output amount (negative delta indicates tokens received)
        amountOut = uint256(zeroForOne ? -delta1 : -delta0);

        // Transfer output tokens back to caller (Vault)
        tokenOut.transfer(msg.sender, amountOut);
    }

    /// @notice Get pool information
    function getPoolInfo(
        PoolManager.PoolKey memory key
    ) external view returns (PoolManager.Pool memory) {
        return poolManager.getPool(key);
    }
}
