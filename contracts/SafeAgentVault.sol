// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice 最小版 ERC20 接口，用于托管指定资产（例如 USDC）
interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @notice PoolKey structure for Uniswap v4
struct PoolKey {
    address token0;
    address token1;
    uint24 fee;
}

/// @notice Interface for Uniswap v4 PoolSwapHelper
interface IPoolSwapHelper {
    function swap(
        PoolKey memory key,
        bool zeroForOne,
        uint256 amountIn
    ) external returns (uint256 amountOut);
}

/// @notice ENS interface for identity verification
interface IENS {
    function owner(bytes32 node) external view returns (address);
}

/// @notice SafeAgentVault (Phase 5.1-5.3)
/// - 托管某个 ERC20 资产
/// - 用户有自己的主余额 balances[user]
/// - 用户可以把一部分余额分配给某个 agent：agentBalances[user][agent]
/// - owner 可以为每个 agent 设置限额 AgentLimits
/// - 只有 controller 可以调用 consumeAgentBalance，在限额内"消耗" agent 子账户额度
/// - Phase 5.1: 使用 routeId 封装路由信息
/// - Phase 5.2: ENS 集成用于身份验证
/// - Phase 5.3: 升级事件结构
contract SafeAgentVault {
    struct AgentLimits {
        uint256 maxPerTrade;   // 单笔最大可用额度
        uint256 dailyLimit;    // 预留字段：每日限额（目前未强制）
        bool canUseLeverage;   // 预留字段：是否允许杠杆（目前未强制）
    }

    struct AgentConfig {
        bool enabled;
        bytes32 ensNode;              // optional ENS node for identity
        uint256 maxNotionalPerTrade;  // per-trade notional cap (in asset units)
        bytes32[] allowedRoutes;      // Phase 5.1: whitelisted routeIds
    }

    /// @notice Phase 5.1: Route structure
    struct Route {
        address token0;
        address token1;
        uint24 fee;
        address pool;
        bool enabled;
    }

    /// @notice Execution request structure for permission-based execution
    struct ExecutionRequest {
        address agent;
        uint256 amount;
        bool zeroForOne;
        bool approved;
        bool executed;
    }

    address public owner;
    address public controller;
    IERC20 public immutable asset;
    IPoolSwapHelper public poolSwapHelper; // Uniswap v4 integration
    IENS public ens; // Phase 5.2: ENS interface

    uint256 private _locked;

    // Pending execution request (single request at a time)
    ExecutionRequest public pendingRequest;

    // Phase 5.1: Route management
    mapping(bytes32 => Route) public routes;
    bytes32 public defaultRouteId;

    // 用户主余额（Vault 内部账本）
    mapping(address => uint256) public balances;

    // 用户 → agent → 为该 agent 分配的子账户余额
    mapping(address => mapping(address => uint256)) public agentBalances;

    // agent 配置的风险限额
    mapping(address => AgentLimits) public agentLimits;

    // agent 配置（用于 executeSwap 的风险检查）
    mapping(address => AgentConfig) public agentConfigs;

    // 用户 → agent → 累计已消耗额度（方便审计、展示）
    mapping(address => mapping(address => uint256)) public agentSpent;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    event AgentAllocated(address indexed user, address indexed agent, uint256 amount);
    event AgentDeallocated(address indexed user, address indexed agent, uint256 amount);

    event AgentSpend(address indexed user, address indexed agent, uint256 amount);
    event AgentLimitsUpdated(address indexed agent, uint256 maxPerTrade, uint256 dailyLimit, bool canUseLeverage);
    event ControllerUpdated(address indexed oldController, address indexed newController);

    /// @notice Phase 5.3: Upgraded event structure
    event AgentSwapExecuted(
        address indexed agent,
        address indexed user,
        bytes32 indexed ensNode,
        bytes32 routeId,
        address pool,
        bool zeroForOne,
        uint256 amountIn,
        uint256 amountOut
    );

    event PoolSwapHelperUpdated(address indexed oldHelper, address indexed newHelper);
    event RouteUpdated(bytes32 indexed routeId, address token0, address token1, uint24 fee, address pool, bool enabled);
    event DefaultRouteIdUpdated(bytes32 indexed oldRouteId, bytes32 indexed newRouteId);
    event ENSUpdated(address indexed oldENS, address indexed newENS);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlyController() {
        require(msg.sender == controller, "not controller");
        _;
    }

    modifier nonReentrant() {
        require(_locked == 0, "reentrant");
        _locked = 1;
        _;
        _locked = 0;
    }

    constructor(address _asset) {
        require(_asset != address(0), "asset is zero");
        owner = msg.sender;
        controller = msg.sender; // 默认为部署者，也可以之后改
        asset = IERC20(_asset);
    }

    /// @notice owner 可以更新 controller（例如设置为某个 Router / AgentManager 合约）
    function setController(address newController) external onlyOwner {
        require(newController != address(0), "controller=0");
        address old = controller;
        controller = newController;
        emit ControllerUpdated(old, newController);
    }

    /// @notice owner 可以设置 Uniswap v4 PoolSwapHelper
    function setPoolSwapHelper(address _poolSwapHelper) external onlyOwner {
        address old = address(poolSwapHelper);
        poolSwapHelper = IPoolSwapHelper(_poolSwapHelper);
        emit PoolSwapHelperUpdated(old, _poolSwapHelper);
    }

    /// @notice Phase 5.2: Set ENS registry address
    function setENS(address ens_) external onlyOwner {
        address old = address(ens);
        ens = IENS(ens_);
        emit ENSUpdated(old, ens_);
    }

    /// @notice Phase 5.1: Compute routeId from route parameters
    function computeRouteId(
        address token0,
        address token1,
        uint24 fee,
        address pool
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(token0, token1, fee, pool));
    }

    /// @notice Phase 5.1: Set or update a route
    function setRoute(
        bytes32 routeId,
        address token0,
        address token1,
        uint24 fee,
        address pool,
        bool enabled
    ) external onlyOwner {
        require(token0 != address(0), "token0=0");
        require(token1 != address(0), "token1=0");
        require(pool != address(0), "pool=0");

        routes[routeId] = Route({
            token0: token0,
            token1: token1,
            fee: fee,
            pool: pool,
            enabled: enabled
        });

        emit RouteUpdated(routeId, token0, token1, fee, pool, enabled);
    }

    /// @notice Phase 5.1: Set default routeId
    function setDefaultRouteId(bytes32 routeId) external onlyOwner {
        require(routes[routeId].pool != address(0), "route not exists");
        bytes32 old = defaultRouteId;
        defaultRouteId = routeId;
        emit DefaultRouteIdUpdated(old, routeId);
    }

    /// @notice Helper: Set route and make it default in one call
    function setDefaultRoute(
        address token0,
        address token1,
        uint24 fee,
        address pool
    ) external onlyOwner {
        bytes32 routeId = computeRouteId(token0, token1, fee, pool);

        // Set route
        routes[routeId] = Route({
            token0: token0,
            token1: token1,
            fee: fee,
            pool: pool,
            enabled: true
        });
        emit RouteUpdated(routeId, token0, token1, fee, pool, true);

        // Set as default
        bytes32 old = defaultRouteId;
        defaultRouteId = routeId;
        emit DefaultRouteIdUpdated(old, routeId);
    }

    /// @notice 用户把 token 存入 Vault，内部记在 balances[user]
    function deposit(uint256 amount) external {
        require(amount > 0, "amount=0");

        bool ok = asset.transferFrom(msg.sender, address(this), amount);
        require(ok, "transferFrom failed");

        balances[msg.sender] += amount;

        emit Deposited(msg.sender, amount);
    }

    /// @notice 用户从 Vault 取回 token
    function withdraw(uint256 amount) external {
        require(amount > 0, "amount=0");
        uint256 bal = balances[msg.sender];
        require(bal >= amount, "insufficient balance");

        balances[msg.sender] = bal - amount;

        bool ok = asset.transfer(msg.sender, amount);
        require(ok, "transfer failed");

        emit Withdrawn(msg.sender, amount);
    }

    /// @notice 用户把自己 Vault 里的钱，划一部分给某个 agent 子账户
    function allocateToAgent(address agent, uint256 amount) external {
        require(agent != address(0), "agent=0");
        require(amount > 0, "amount=0");
        require(balances[msg.sender] >= amount, "insufficient vault balance");

        balances[msg.sender] -= amount;
        agentBalances[msg.sender][agent] += amount;

        emit AgentAllocated(msg.sender, agent, amount);
    }

    /// @notice 用户从某个 agent 子账户收回部分额度，回到主余额
    function deallocateFromAgent(address agent, uint256 amount) external {
        require(agent != address(0), "agent=0");
        require(amount > 0, "amount=0");
        require(agentBalances[msg.sender][agent] >= amount, "insufficient agent balance");

        agentBalances[msg.sender][agent] -= amount;
        balances[msg.sender] += amount;

        emit AgentDeallocated(msg.sender, agent, amount);
    }

    /// @notice owner 配置某个 agent 的限额
    function setAgentLimits(
        address agent,
        uint256 maxPerTrade,
        uint256 dailyLimit,
        bool canUseLeverage
    ) external onlyOwner {
        require(agent != address(0), "agent=0");

        agentLimits[agent] = AgentLimits({
            maxPerTrade: maxPerTrade,
            dailyLimit: dailyLimit,
            canUseLeverage: canUseLeverage
        });

        emit AgentLimitsUpdated(agent, maxPerTrade, dailyLimit, canUseLeverage);
    }

    /// @notice controller 在限额内"消耗"某个 user 为某个 agent 预留的额度
    /// 当前版本只改内部账本，不实际对接 Uniswap；后续可以在这里联动真实交易。
    function consumeAgentBalance(
        address user,
        address agent,
        uint256 amount
    ) external onlyController {
        require(user != address(0), "user=0");
        require(agent != address(0), "agent=0");
        require(amount > 0, "amount=0");

        AgentLimits memory limits = agentLimits[agent];
        require(limits.maxPerTrade > 0, "agent not configured");
        require(amount <= limits.maxPerTrade, "limit: maxPerTrade");

        uint256 bal = agentBalances[user][agent];
        require(bal >= amount, "insufficient agent balance");

        // 扣子账户余额，累计记账到 agentSpent
        agentBalances[user][agent] = bal - amount;
        agentSpent[user][agent] += amount;

        emit AgentSpend(user, agent, amount);

        // 这里暂时不动真实 token 余额，表示"已用于交易或在路上"
        // 将来接到 Uniswap v4 Router 时，可以在这里实际调用 pool / hook。
    }

    /// @notice Phase 5.1: owner 配置某个 agent 的 swap 配置（使用 routeId）
    function setAgentConfig(
        address agent,
        bool enabled,
        bytes32 ensNode,
        bytes32[] calldata allowedRoutes,
        uint256 maxNotionalPerTrade
    ) external onlyOwner {
        require(agent != address(0), "agent=0");
        AgentConfig storage cfg = agentConfigs[agent];
        cfg.enabled = enabled;
        cfg.ensNode = ensNode;
        cfg.allowedRoutes = allowedRoutes;
        cfg.maxNotionalPerTrade = maxNotionalPerTrade;
    }

    /// @notice Get all allowed routes for an agent
    function getAllowedRoutes(address agent) external view returns (bytes32[] memory) {
        return agentConfigs[agent].allowedRoutes;
    }

    /// @notice Get count of allowed routes for an agent
    function getAllowedRouteCount(address agent) external view returns (uint256) {
        return agentConfigs[agent].allowedRoutes.length;
    }

    /// @notice Get specific allowed route by index
    function getAllowedRouteAt(address agent, uint256 i) external view returns (bytes32) {
        return agentConfigs[agent].allowedRoutes[i];
    }

    /// @notice Phase 5.1: 检查某个 routeId 是否在 agent 的白名单中
    function _isAllowedRoute(AgentConfig storage cfg, bytes32 routeId) internal view returns (bool) {
        uint256 len = cfg.allowedRoutes.length;
        for (uint256 i = 0; i < len; i++) {
            if (cfg.allowedRoutes[i] == routeId) {
                return true;
            }
        }
        return false;
    }

    /// @notice Phase 5.1-5.3: agent 发起 swap 请求（使用 routeId）
    /// @param user The user whose allocation should be used
    /// @param routeId The route identifier
    /// @param zeroForOne Swap direction
    /// @param amountIn Amount to swap
    /// @param minAmountOut Minimum output (slippage protection)
    function executeSwap(
        address user,
        bytes32 routeId,
        bool zeroForOne,
        uint256 amountIn,
        uint256 minAmountOut
    ) external nonReentrant returns (uint256 amountOut) {
        AgentConfig storage cfg = agentConfigs[msg.sender];

        // Basic config checks
        require(cfg.enabled, "agent disabled");
        require(user != address(0), "user=0");
        require(amountIn > 0, "amount=0");
        require(amountIn <= cfg.maxNotionalPerTrade, "trade too big");

        // Phase 5.1: Check route exists and is enabled
        Route memory route = routes[routeId];
        require(route.pool != address(0), "route not exists");
        require(route.enabled, "route disabled");
        require(_isAllowedRoute(cfg, routeId), "route not allowed");

        // Phase 5.2: ENS verification (if configured)
        if (address(ens) != address(0) && cfg.ensNode != bytes32(0)) {
            require(ens.owner(cfg.ensNode) == msg.sender, "ENS owner mismatch");
        }

        // Check poolSwapHelper is set
        require(address(poolSwapHelper) != address(0), "poolSwapHelper not set");

        // Check agent has sufficient balance from this user
        require(agentBalances[user][msg.sender] >= amountIn, "insufficient agent balance");

        // Deduct from agent balance
        agentBalances[user][msg.sender] -= amountIn;
        agentSpent[user][msg.sender] += amountIn;

        // Approve poolSwapHelper to spend tokens
        asset.approve(address(poolSwapHelper), amountIn);

        // Execute swap through helper using route info
        PoolKey memory key = PoolKey({
            token0: route.token0,
            token1: route.token1,
            fee: route.fee
        });

        amountOut = poolSwapHelper.swap(key, zeroForOne, amountIn);

        // Check slippage protection
        require(amountOut >= minAmountOut, "slippage");

        // Phase 5.3: Emit upgraded event
        emit AgentSwapExecuted(
            msg.sender,
            user,
            cfg.ensNode,
            routeId,
            route.pool,
            zeroForOne,
            amountIn,
            amountOut
        );
    }

    /// @notice Agent requests execution permission (does not execute swap)
    /// @param amount Amount to swap
    /// @param zeroForOne Swap direction
    function requestExecution(
        uint256 amount,
        bool zeroForOne
    ) external {
        // Only enabled agents can request
        require(agentConfigs[msg.sender].enabled, "AGENT_DISABLED");

        // Amount must be positive
        require(amount > 0, "INVALID_AMOUNT");

        // No pending request allowed
        require(
            !pendingRequest.approved && !pendingRequest.executed,
            "REQUEST_EXISTS"
        );

        // Create new request
        pendingRequest = ExecutionRequest({
            agent: msg.sender,
            amount: amount,
            zeroForOne: zeroForOne,
            approved: false,
            executed: false
        });
    }

    /// @notice Owner approves and executes the pending request
    function approveAndExecute() external onlyOwner {
        ExecutionRequest storage r = pendingRequest;

        // Validate request state
        require(!r.executed, "ALREADY_EXECUTED");
        require(!r.approved, "ALREADY_APPROVED");

        // Get agent config
        AgentConfig storage cfg = agentConfigs[r.agent];

        // Check cap
        require(r.amount <= cfg.maxNotionalPerTrade, "CAP_EXCEEDED");

        // Mark as approved
        r.approved = true;

        // Execute swap using internal logic
        _executeSwap(
            r.agent,
            r.amount,
            r.zeroForOne
        );

        // Mark as executed
        r.executed = true;

        // Auto-revoke agent permissions
        cfg.enabled = false;
        cfg.maxNotionalPerTrade = 0;
    }

    /// @notice Internal swap execution logic
    function _executeSwap(
        address agent,
        uint256 amount,
        bool zeroForOne
    ) internal {
        // Get agent config
        AgentConfig storage cfg = agentConfigs[agent];

        // Use default route
        bytes32 routeId = defaultRouteId;
        Route memory route = routes[routeId];
        require(route.pool != address(0), "route not exists");
        require(route.enabled, "route disabled");

        // Check poolSwapHelper is set
        require(address(poolSwapHelper) != address(0), "poolSwapHelper not set");

        // Approve poolSwapHelper to spend tokens
        asset.approve(address(poolSwapHelper), amount);

        // Execute swap through helper using route info
        PoolKey memory key = PoolKey({
            token0: route.token0,
            token1: route.token1,
            fee: route.fee
        });

        uint256 amountOut = poolSwapHelper.swap(key, zeroForOne, amount);

        // Emit event
        emit AgentSwapExecuted(
            agent,
            owner, // user is owner in this case
            cfg.ensNode,
            routeId,
            route.pool,
            zeroForOne,
            amount,
            amountOut
        );
    }
}
