// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../mocks/MockERC20.sol";

/// @notice Minimal Uniswap v4 PoolManager for local testing
/// @dev This is a simplified version for demonstration purposes only
contract PoolManager {
    struct PoolKey {
        address token0;
        address token1;
        uint24 fee;
    }

    struct SwapParams {
        bool zeroForOne;
        int256 amountSpecified;
        uint160 sqrtPriceLimitX96;
    }

    struct Pool {
        bool initialized;
        uint256 reserve0;
        uint256 reserve1;
        uint24 fee; // fee in hundredths of a bip (e.g., 3000 = 0.3%)
    }

    // poolId => Pool
    mapping(bytes32 => Pool) public pools;

    event PoolInitialized(bytes32 indexed poolId, address token0, address token1, uint24 fee);
    event Swap(
        bytes32 indexed poolId,
        address indexed sender,
        bool zeroForOne,
        int256 amount0,
        int256 amount1
    );

    /// @notice Initialize a new pool
    function initialize(PoolKey memory key, uint160 sqrtPriceX96) external returns (bytes32 poolId) {
        require(key.token0 < key.token1, "token0 >= token1");
        require(key.token0 != address(0), "token0 = 0");

        poolId = keccak256(abi.encode(key.token0, key.token1, key.fee));
        require(!pools[poolId].initialized, "already initialized");

        pools[poolId] = Pool({
            initialized: true,
            reserve0: 0,
            reserve1: 0,
            fee: key.fee
        });

        emit PoolInitialized(poolId, key.token0, key.token1, key.fee);
    }

    /// @notice Add liquidity to a pool (simplified - no LP tokens)
    function addLiquidity(
        PoolKey memory key,
        uint256 amount0,
        uint256 amount1
    ) external {
        bytes32 poolId = keccak256(abi.encode(key.token0, key.token1, key.fee));
        Pool storage pool = pools[poolId];
        require(pool.initialized, "pool not initialized");

        // Transfer tokens from sender
        if (amount0 > 0) {
            MockERC20(key.token0).transferFrom(msg.sender, address(this), amount0);
            pool.reserve0 += amount0;
        }
        if (amount1 > 0) {
            MockERC20(key.token1).transferFrom(msg.sender, address(this), amount1);
            pool.reserve1 += amount1;
        }
    }

    /// @notice Execute a swap (simplified constant product AMM)
    function swap(
        PoolKey memory key,
        SwapParams memory params,
        bytes calldata hookData
    ) external returns (int256 amount0, int256 amount1) {
        bytes32 poolId = keccak256(abi.encode(key.token0, key.token1, key.fee));
        Pool storage pool = pools[poolId];
        require(pool.initialized, "pool not initialized");
        require(pool.reserve0 > 0 && pool.reserve1 > 0, "insufficient liquidity");

        // Simple constant product formula: x * y = k
        // For zeroForOne: selling token0 for token1
        // For oneForZero: selling token1 for token0

        if (params.zeroForOne) {
            // Selling token0 for token1
            require(params.amountSpecified > 0, "invalid amount");
            uint256 amountIn = uint256(params.amountSpecified);

            // Apply fee (e.g., 3000 = 0.3% = 0.997 multiplier)
            uint256 amountInWithFee = (amountIn * (1000000 - pool.fee)) / 1000000;

            // Calculate output using constant product
            uint256 amountOut = (pool.reserve1 * amountInWithFee) / (pool.reserve0 + amountInWithFee);

            require(amountOut > 0, "insufficient output");
            require(amountOut <= pool.reserve1, "exceeds reserve");

            // Transfer tokens
            MockERC20(key.token0).transferFrom(msg.sender, address(this), amountIn);
            MockERC20(key.token1).transfer(msg.sender, amountOut);

            // Update reserves
            pool.reserve0 += amountIn;
            pool.reserve1 -= amountOut;

            amount0 = int256(amountIn);
            amount1 = -int256(amountOut);
        } else {
            // Selling token1 for token0
            require(params.amountSpecified > 0, "invalid amount");
            uint256 amountIn = uint256(params.amountSpecified);

            // Apply fee
            uint256 amountInWithFee = (amountIn * (1000000 - pool.fee)) / 1000000;

            // Calculate output using constant product
            uint256 amountOut = (pool.reserve0 * amountInWithFee) / (pool.reserve1 + amountInWithFee);

            require(amountOut > 0, "insufficient output");
            require(amountOut <= pool.reserve0, "exceeds reserve");

            // Transfer tokens
            MockERC20(key.token1).transferFrom(msg.sender, address(this), amountIn);
            MockERC20(key.token0).transfer(msg.sender, amountOut);

            // Update reserves
            pool.reserve1 += amountIn;
            pool.reserve0 -= amountOut;

            amount0 = -int256(amountOut);
            amount1 = int256(amountIn);
        }

        emit Swap(poolId, msg.sender, params.zeroForOne, amount0, amount1);
    }

    /// @notice Get pool reserves
    function getPool(PoolKey memory key) external view returns (Pool memory) {
        bytes32 poolId = keccak256(abi.encode(key.token0, key.token1, key.fee));
        return pools[poolId];
    }
}
