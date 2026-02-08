# SafeAgentVault 配置文件结构说明

## 文件目录结构

```
deployments/
├── localhost.json              # 公开配置（可提交到 git）
├── localhost.json.example      # 配置文件示例（可提交到 git）
├── agents.local.json           # Agent 配置（可提交到 git）
└── keys.local.json             # 私钥配置（私密，已在 .gitignore）
```

---

## A. `deployments/localhost.json` - 公开部署配置

**用途**: 存储合约地址、网络信息、默认路由等公开信息

**可见性**: ✅ 可提交到 git，公开可见

### 字段说明

```json
{
  "network": "localhost",           // 网络名称（localhost, sepolia, mainnet）
  "chainId": 31337,                 // 链 ID（31337=Hardhat, 1=Mainnet, 11155111=Sepolia）
  "rpcUrl": "http://127.0.0.1:8545", // 公开 RPC 端点（可被 keys.local.json 覆盖）

  "addresses": {
    "vault": "0x...",               // SafeAgentVault 合约地址
    "poolManager": "0x...",         // Uniswap v4 PoolManager 地址
    "poolSwapHelper": "0x...",      // PoolSwapHelper 合约地址
    "poolAddress": "0x...",         // 逻辑池地址（用于路由配置）
    "token0": "0x...",              // 交易对 token0（地址较小）
    "token1": "0x..."               // 交易对 token1（地址较大）
  },

  "actors": {
    "deployer": "0x...",            // 合约部署者地址（owner）
    "user": "0x...",                // 测试用户地址（vault 中有资金）
    "agents": [                     // Agent 地址数组
      "0x...",
      "0x...",
      "0x..."
    ]
  },

  "defaultRoute": {
    "token0": "0x...",              // 默认路由 token0
    "token1": "0x...",              // 默认路由 token1
    "fee": 3000,                    // 费率（3000 = 0.3%）
    "pool": "0x..."                 // 池地址
  }
}
```

### 示例值

参见 `deployments/localhost.json.example`

---

## B. `deployments/agents.local.json` - Agent 配置

**用途**: 存储每个 agent 的配置信息（ENS 名称、限额、策略等）

**可见性**: ✅ 可提交到 git，公开可见（不含私钥）

### 字段说明

```json
{
  "agents": [
    {
      "address": "0x3C44...",                    // Agent 地址（必须与链上配置匹配）
      "ensName": "agent.safe.eth",               // ENS 名称（用于 UI 显示）
      "label": "Primary Trading Agent",          // 描述性标签（UI 显示）
      "enabled": true,                           // 是否启用（布尔值）
      "maxNotionalPerTrade": "100000000000000000000",  // 每笔最大交易额（wei）
      "allowedRoutes": [                         // 允许的路由 ID 数组（bytes32）
        "0x46fcae8228bf81035765c1a020e21c67eff7bd6dbdf58779d19588907eb80683"
      ],
      "strategy": "market-maker"                 // 策略类型
    }
  ]
}
```

### 字段详解

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `address` | string | Agent 以太坊地址 | `"0x3C44..."` |
| `ensName` | string | ENS 名称（人类可读） | `"agent.safe.eth"` |
| `label` | string | UI 显示标签 | `"Primary Trading Agent"` |
| `enabled` | boolean | 是否启用 | `true` / `false` |
| `maxNotionalPerTrade` | string | 每笔最大交易额（wei） | `"100000000000000000000"` (100 ETH) |
| `allowedRoutes` | array | 允许的路由 ID | `["0x46fc..."]` |
| `strategy` | string | 策略类型 | `"market-maker"`, `"arbitrage"`, `"liquidation"` |

### maxNotionalPerTrade 示例值

| 金额 | Wei 值 |
|------|--------|
| 1 ETH | `"1000000000000000000"` |
| 10 ETH | `"10000000000000000000"` |
| 100 ETH | `"100000000000000000000"` |
| 1000 ETH | `"1000000000000000000000"` |

### strategy 类型

- `market-maker` - 做市策略
- `arbitrage` - 套利策略
- `liquidation` - 清算策略
- `trend-following` - 趋势跟踪
- `mean-reversion` - 均值回归
- `custom` - 自定义策略

---

## C. `deployments/keys.local.json` - 私钥配置

**用途**: 存储私钥和敏感 RPC 端点

**可见性**: ❌ 私密文件，已在 `.gitignore` 中，**绝不提交到 git**

### 字段说明

```json
{
  "WARNING": "DO NOT COMMIT THIS FILE - FOR LOCAL TESTING ONLY",
  "WARNING_CN": "请勿提交此文件 - 仅用于本地测试",

  "rpcUrl": "http://127.0.0.1:8545",                              // 本地 RPC
  "rpcUrlMainnet": "https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY", // 主网 RPC
  "rpcUrlSepolia": "https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY", // 测试网 RPC

  "agentPrivateKeys": {                                           // Agent 地址 → 私钥映射
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC": "0x5de4111afa...",
    "0x90F79bf6EB2c4f870365E785982E1f101E93b906": "0x7c85211829...",
    "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65": "0x47e179ec19..."
  },

  "deployerPrivateKey": "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "userPrivateKey": "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
}
```

### 字段详解

| 字段 | 类型 | 说明 |
|------|------|------|
| `rpcUrl` | string | 默认 RPC 端点（本地开发） |
| `rpcUrlMainnet` | string | 主网 RPC（需替换 YOUR_KEY） |
| `rpcUrlSepolia` | string | Sepolia 测试网 RPC |
| `agentPrivateKeys` | object | Agent 地址到私钥的映射 |
| `deployerPrivateKey` | string | 部署者私钥（Hardhat account #0） |
| `userPrivateKey` | string | 测试用户私钥（Hardhat account #1） |

### ⚠️ 安全注意事项

1. **生产环境**: 绝不使用 Hardhat 默认私钥
2. **Git 忽略**: 确保 `keys.local.json` 在 `.gitignore` 中
3. **环境变量**: 生产环境考虑使用环境变量
4. **硬件钱包**: 主网部署使用硬件钱包（Ledger, Trezor）
5. **密钥管理**: 生产环境使用专业密钥管理系统（AWS KMS, HashiCorp Vault）

### Hardhat 默认账户

| 账户 | 地址 | 私钥 | 角色 |
|------|------|------|------|
| #0 | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974bec3...` | deployer |
| #1 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e99...` | user |
| #2 | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `0x5de4111afa...` | agent |
| #3 | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | `0x7c85211829...` | agent |
| #4 | `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` | `0x47e179ec19...` | agent |

---

## 使用示例

### 1. 读取配置（JavaScript/TypeScript）

```javascript
import deployment from './deployments/localhost.json';
import agents from './deployments/agents.local.json';
import keys from './deployments/keys.local.json';

// 获取 vault 地址
const vaultAddress = deployment.addresses.vault;

// 获取第一个 agent 配置
const agent = agents.agents[0];
console.log(`Agent: ${agent.ensName} (${agent.address})`);
console.log(`Max per trade: ${agent.maxNotionalPerTrade} wei`);

// 获取 agent 私钥
const agentPrivateKey = keys.agentPrivateKeys[agent.address];
```

### 2. 读取配置（Python）

```python
import json

# 读取部署配置
with open('deployments/localhost.json') as f:
    deployment = json.load(f)

# 读取 agent 配置
with open('deployments/agents.local.json') as f:
    agents_config = json.load(f)

# 读取私钥（小心处理！）
with open('deployments/keys.local.json') as f:
    keys = json.load(f)

# 使用配置
vault_address = deployment['addresses']['vault']
agent = agents_config['agents'][0]
agent_pk = keys['agentPrivateKeys'][agent['address']]
```

### 3. 环境变量覆盖（生产环境推荐）

```bash
# .env 文件
VAULT_ADDRESS=0x84eA74d481Ee0A5332c457a4d796187F6Ba67fEB
AGENT_ADDRESS=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
AGENT_PRIVATE_KEY=0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
```

```javascript
// 优先使用环境变量
const vaultAddress = process.env.VAULT_ADDRESS || deployment.addresses.vault;
const agentPrivateKey = process.env.AGENT_PRIVATE_KEY || keys.agentPrivateKeys[agentAddress];
```

---

## 配置文件更新流程

### 部署新合约后

1. **运行部署脚本**:
   ```bash
   TMPDIR=~/hh-tmp npx hardhat run scripts/demoAgent.js --network localhost
   ```

2. **自动生成 `localhost.json`**:
   - 脚本会自动写入合约地址
   - 包含 `ensName` 字段

3. **同步到前端**:
   ```bash
   cd frontend && npm run sync:deploy
   ```

4. **手动更新 `agents.local.json`**:
   - 添加新 agent 配置
   - 设置 ENS 名称、限额、策略

5. **手动更新 `keys.local.json`**:
   - 添加新 agent 私钥映射
   - 更新 RPC 端点（如需要）

---

## .gitignore 配置

确保以下文件在 `.gitignore` 中：

```gitignore
# Private keys and sensitive data
deployments/keys.local.json
deployments/*.private.json
.env
.env.local

# Keep example files
!deployments/*.example
```

---

## 最佳实践

### ✅ 推荐做法

1. **分离公开和私密配置**: 公开配置可提交，私密配置本地保存
2. **使用示例文件**: 提供 `.example` 文件供团队参考
3. **环境变量优先**: 生产环境使用环境变量覆盖配置
4. **版本控制**: 公开配置文件提交到 git，便于团队协作
5. **文档注释**: 在配置文件中添加 `_comments` 字段说明

### ❌ 避免做法

1. **提交私钥**: 绝不将 `keys.local.json` 提交到 git
2. **硬编码私钥**: 不在代码中硬编码私钥
3. **共享私钥**: 不通过聊天工具、邮件分享私钥
4. **生产用测试密钥**: 不在主网使用 Hardhat 默认私钥
5. **明文存储**: 生产环境不明文存储私钥

---

## 故障排查

### 问题 1: 找不到配置文件

**错误**: `Cannot find module './deployments/localhost.json'`

**解决**:
```bash
# 运行部署脚本生成配置
TMPDIR=~/hh-tmp npx hardhat run scripts/demoAgent.js --network localhost

# 或复制示例文件
cp deployments/localhost.json.example deployments/localhost.json
```

### 问题 2: Agent 私钥不匹配

**错误**: `Agent address mismatch`

**解决**: 确保 `agents.local.json` 中的地址与 `keys.local.json` 中的键一致

```javascript
// agents.local.json
"address": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"

// keys.local.json
"agentPrivateKeys": {
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC": "0x5de4111afa..."
}
```

### 问题 3: ENS namehash 不匹配

**错误**: `⚠️ mismatch with ensNode`

**解决**: 确保 `ensName` 与链上 `ensNode` 一致

```javascript
// 验证 namehash
const { ethers } = require('ethers');
const ensName = "agent.safe.eth";
const namehash = ethers.namehash(ensName);
console.log(namehash);
// 应该与链上 ensNode 匹配
```

---

## 总结

| 文件 | 可见性 | 用途 | 提交到 git |
|------|--------|------|-----------|
| `localhost.json` | 公开 | 合约地址、网络配置 | ✅ 是 |
| `agents.local.json` | 公开 | Agent 配置（无私钥） | ✅ 是 |
| `keys.local.json` | 私密 | 私钥、敏感 RPC | ❌ 否 |
| `*.example` | 公开 | 配置示例 | ✅ 是 |

**核心原则**: 公开配置可提交，私密配置本地保存，使用环境变量覆盖生产配置。
