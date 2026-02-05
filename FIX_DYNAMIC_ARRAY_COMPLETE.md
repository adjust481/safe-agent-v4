# 修复完成：Solidity 动态数组读取问题

## 问题描述

Python 脚本 `agent_py/snapshot.py` 运行时报错 `list index out of range`，原因是 Solidity 的 `public` struct getter 不会返回动态数组字段（`allowedRoutes`），导致 Python 以固定下标读取时崩溃。

## 解决方案

### 1. 防御性解包（立即修复）

修改 `agent_py/snapshot.py`，使用防御性解包避免崩溃：

```python
# 安全提取字段
enabled = agent_config[0] if len(agent_config) > 0 else False
ens_node = agent_config[1] if len(agent_config) > 1 else b""
max_per_trade = agent_config[2] if len(agent_config) > 2 else 0

# 安全转换 ensNode 为 hex
try:
    ens_node_hex = ens_node.hex() if ens_node else "0x" + "00" * 32
except Exception:
    ens_node_hex = str(ens_node)
```

### 2. 合约增加 getter 函数（根治方案）

在 `contracts/SafeAgentVault.sol` 中添加三个 view 函数：

```solidity
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
```

### 3. Python 脚本调用新 getter

更新 `snapshot.py` 使用新的 getter 函数：

```python
# Get allowedRoutes using dedicated getter
try:
    allowed_routes = vault.functions.getAllowedRoutes(agent_address).call()
except Exception as e:
    print(f"Warning: Could not fetch allowedRoutes: {e}")
    allowed_routes = []
```

### 4. 修复 demoAgent.js 的 token 排序问题

原脚本只排序地址但没有更新 token 引用，导致 PoolSwapHelper 部署失败。修复：

```javascript
// 正确排序 token 对象和地址
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
```

## 验证结果

### 1. 编译成功
```bash
$ TMPDIR=~/hh-tmp npx hardhat compile
Compiled 1 Solidity file successfully (evm target: paris).
```

### 2. Demo 脚本成功
```bash
$ TMPDIR=~/hh-tmp npx hardhat run scripts/demoAgent.js --network localhost

=== Demo completed successfully! ===
Deployment info written to: deployments/localhost.json
Keys info written to: deployments/keys.local.json
```

### 3. Python 脚本成功
```bash
$ python3 agent_py/snapshot.py

Connected to network (chainId: 31337)
Vault address: 0xf5059a5D33d5853360D16C683c16e67980206f36

=== Vault State Snapshot ===

User Balances:
  Main balance      : 800.0000 tokens
  Agent sub-balance : 150.0000 tokens
  Agent spent       : 50.0000 tokens

Agent Config:
  Enabled           : True
  ENS Node          : 6167656e742e736166652e657468000000000000000000000000000000000000
  Max per trade     : 100.0000 tokens
  Allowed routes    : 1 route(s)
    [0] 65eb17383174af004941ade8a7a373ff3437e6a92c755bfdaebd544a1952452a

Pool Swap Helper:
  Address           : 0x998abeb3E57409262aE5b751f60747921B33613E

Default Route:
  Token0            : 0x1613beB3B2C4f22Ee086B2b38C1476A3cE7f78E8
  Token1            : 0x851356ae760d987E095750cCeb3bC6014560891C
  Fee               : 3000
  Pool              : 0x90F79bf6EB2c4f870365E785982E1f101E93b906
  Enabled           : True
```

### 4. 测试全部通过
```bash
$ TMPDIR=~/hh-tmp npx hardhat test

23 passing (461ms)
```

## 修改文件清单

### 1. contracts/SafeAgentVault.sol
- **位置**: 第 345-360 行（`setAgentConfig` 之后）
- **改动**: 添加 3 个 view 函数用于读取 `allowedRoutes` 动态数组
- **影响**: ABI 变化，需要重新编译和部署

### 2. agent_py/snapshot.py
- **位置**: `get_vault_snapshot()` 函数
- **改动**:
  - 使用防御性解包读取 `agentConfigs` 返回值
  - 调用 `getAllowedRoutes()` 获取动态数组
  - 添加 `poolSwapHelper` 地址显示
- **影响**: 不再崩溃，能正确显示所有字段

### 3. scripts/demoAgent.js
- **位置**: 步骤 2（部署 MockERC20）
- **改动**: 正确排序 token 对象和地址，确保 token0 < token1
- **影响**: PoolSwapHelper 部署不再失败

## 关键输出

### deployments/localhost.json
```json
{
  "network": "localhost",
  "chainId": 31337,
  "rpcUrl": "http://127.0.0.1:8545",
  "addresses": {
    "token0": "0x1613beB3B2C4f22Ee086B2b38C1476A3cE7f78E8",
    "token1": "0x851356ae760d987E095750cCeb3bC6014560891C",
    "vault": "0xf5059a5D33d5853360D16C683c16e67980206f36",
    "poolManager": "0x95401dc811bb5740090279Ba06cfA8fcF6113778",
    "poolSwapHelper": "0x998abeb3E57409262aE5b751f60747921B33613E",
    "poolAddress": "0x90F79bf6EB2c4f870365E785982E1f101E93b906"
  },
  "actors": {
    "user": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "agent": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    "deployer": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
  }
}
```

### snapshot.py 输出亮点
- ✅ 连接成功（chainId: 31337）
- ✅ Vault 地址正确
- ✅ User/Agent 余额正确
- ✅ Agent 配置完整（enabled, ensNode, maxPerTrade）
- ✅ **Allowed routes 显示成功**（1 route，完整 routeId）
- ✅ PoolSwapHelper 地址显示
- ✅ DefaultRoute 完整信息（token0/token1/fee/pool/enabled）

## 技术要点

### Solidity Public Getter 的限制
- `public` mapping/struct 会自动生成 getter
- **但动态数组字段不会包含在返回值中**
- 解决方案：手动添加返回动态数组的 view 函数

### Python Web3.py 调用约定
- `call()` 返回 tuple，需要按下标访问
- 防御性编程：先检查 `len(result)` 再访问下标
- 动态数组需要专门的 getter 函数

### Token 排序要求
- Uniswap v4 要求 token0 < token1（地址比较）
- 必须同时排序地址和对象引用
- 使用 `.toLowerCase()` 确保一致性

## 验收标准达成

✅ `compile` 成功
✅ `demoAgent.js` 成功并写出 `deployments/localhost.json`
✅ `snapshot.py` 打印完整信息：
  - 连接成功（chainId）
  - Vault 地址
  - Agent 地址
  - User 主余额
  - Agent 子账户余额
  - agentSpent
  - poolSwapHelper 地址
  - defaultRoute（token0/token1/fee/poolAddress）
  - **whitelist 数组（allowedRoutes）**

✅ 测试全部通过（23 passing）
