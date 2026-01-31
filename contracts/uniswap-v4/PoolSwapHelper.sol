// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./PoolManager.sol";
import "../mocks/MockERC20.sol";

/// @notice Helper contract for executing swaps through PoolManager
/// @dev Provides a simplified interface for SafeAgentVault to interact with v4
contract PoolSwapHelper {
    PoolManager public immutable poolManager;

    constructor(address _poolManager) {
        require(_poolManager != address(0), "poolManager = 0");
        poolManager = PoolManager(_poolManager);
    }

    /// @notice Execute a simple swap
    /// @param token0 First token in the pair (must be < token1)
    /// @param token1 Second token in the pair
    /// @param fee Pool fee tier
    /// @param zeroForOne Direction of swap
    /// @param amountIn Amount of input token
    /// @return amountOut Amount of output token received
    function executeSwap(
        address token0,
        address token1,
        uint24 fee,
        bool zeroForOne,
        uint256 amountIn
    ) external returns (uint256 amountOut) {
        require(amountIn > 0, "amountIn = 0");

        // Determine input and output tokens
        address tokenIn = zeroForOne ? token0 : token1;
        address tokenOut = zeroForOne ? token1 : token0;

        // Pull input tokens from caller (Vault)
        MockERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);

        // Approve PoolManager to spend input tokens
        MockERC20(tokenIn).approve(address(poolManager), amountIn);

        // Create pool key
        PoolManager.PoolKey memory key = PoolManager.PoolKey({
            token0: token0,
            token1: token1,
            fee: fee
        });

        // Create swap params
        PoolManager.SwapParams memory params = PoolManager.SwapParams({
            zeroForOne: zeroForOne,
            amountSpecified: int256(amountIn),
            sqrtPriceLimitX96: 0 // not used in our simplified implementation
        });

        // Execute swap
        (int256 amount0, int256 amount1) = poolManager.swap(key, params, "");

        // Calculate output amount (negative value indicates output)
        if (zeroForOne) {
            amountOut = uint256(-amount1);
        } else {
            amountOut = uint256(-amount0);
        }

        // Transfer output tokens back to caller
        MockERC20(tokenOut).transfer(msg.sender, amountOut);
    }

    /// @notice Get pool information
    function getPoolInfo(
        address token0,
        address token1,
        uint24 fee
    ) external view returns (PoolManager.Pool memory) {
        PoolManager.PoolKey memory key = PoolManager.PoolKey({
            token0: token0,
            token1: token1,
            fee: fee
        });
        return poolManager.getPool(key);
    }
}
