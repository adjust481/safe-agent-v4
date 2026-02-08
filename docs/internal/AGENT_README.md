# SafeAgentVault Python 自动交易 Agent

完整的 Python 自动交易系统，每 2 秒扫描链上状态，根据策略规则自动执行交易。

## 📁 文件结构

```
agent/
├── common.py          # Web3 连接 + 配置加载 + ABI 管理
├── snapshot.py        # 读取 vault 状态（agentConfigs, balances）
├── policy.py          # 决策逻辑（HOLD or TRADE）
├── trader.py          # 构建/签名/发送交易 + 解析事件
├── loop.py            # 主循环控制器
├── state.json         # Agent 当前状态（自动生成，前端展示用）
├── state.json.example # 状态文件示例
└── README.md          # 本文档
```

## 🚀 快速开始

### 1. 安装依赖

```bash
# 确保已安装 Python 3.8+
python --version

# 安装依赖
pip install web3 eth-account python-dotenv
```

### 2. 准备配置文件

确保以下配置文件存在：

```
deployments/
├── localhost.json        # 合约地址、网络配置
├── agents.local.json     # Agent 配置
└── keys.local.json       # 私钥配置（私密）
```

### 3. 启动本地区块链

```bash
# Terminal 1: 启动 Hardhat 节点
TMPDIR=~/hh-tmp npx hardhat node

# Terminal 2: 部署合约
TMPDIR=~/hh-tmp npx hardhat run scripts/demoAgent.js --network localhost
```

### 4. 运行 Agent

```bash
# 使用默认配置运行第一个 agent
python agent/loop.py

# 指定 agent 索引和策略
python agent/loop.py --agent 0 --strategy default

# 使用保守策略
python agent/loop.py --agent 0 --strategy conservative

# 使用激进策略
python agent/loop.py --agent 0 --strategy aggressive

# 自定义循环间隔（秒）
python agent/loop.py --agent 0 --interval 5
```

### 5. 查看状态

Agent 运行时会自动生成 `agent/state.json` 文件，前端可以读取此文件显示 agent 状态。

```bash
# 查看状态文件
cat agent/state.json | jq
```

## 📚 模块说明

### common.py - 基础设施

**功能**:
- Web3 连接管理
- 配置文件加载（deployments/*.json）
- 合约 ABI 加载
- 合约实例创建
- 工具函数（格式化、地址缩写等）

**主要类**:
- `Config`: 配置管理类
- `Web3Manager`: Web3 连接管理类

**使用示例**:
```python
from common import get_config, get_web3_manager

config = get_config()
w3m = get_web3_manager()
vault = w3m.get_vault_contract()
```

### snapshot.py - 状态快照

**功能**:
- 读取用户主余额
- 读取 agent 子账户余额和已消费额度
- 读取 agent 配置（enabled, ensNode, maxNotionalPerTrade）
- 读取默认路由信息
- 获取最新区块信息

**主要类**:
- `VaultSnapshot`: Vault 状态快照类

**使用示例**:
```python
from snapshot import VaultSnapshot

snapshot = VaultSnapshot(agent_address)
snapshot.fetch()

print(f"Available balance: {snapshot.get_available_balance()}")
print(f"Max trade amount: {snapshot.get_max_trade_amount()}")
print(f"Agent enabled: {snapshot.is_agent_enabled()}")
```

### policy.py - 决策引擎

**功能**:
- 根据链上状态决定是否交易
- 保守原则：默认 HOLD，只有满足所有条件才 TRADE
- 可配置的阈值和规则
- 返回决策结果和原因

**主要类**:
- `TradingDecision`: 交易决策结果
- `TradingPolicy`: 默认策略（平衡）
- `ConservativePolicy`: 保守策略（更严格）
- `AggressivePolicy`: 激进策略（更宽松）

**决策规则**:
1. ✅ Agent 必须启用
2. ✅ 路由必须启用
3. ✅ 子账户余额必须充足
4. ✅ 必须过了冷却期
5. ✅ 交易金额必须达到最小值
6. ✅ 交易金额不能超过限额
7. ✅ 交易后必须保留足够余额
8. ✅ 计算最小输出金额（考虑滑点）

**策略对比**:

| 参数 | 默认策略 | 保守策略 | 激进策略 |
|------|---------|---------|---------|
| 保留余额比例 | 10% | 20% | 5% |
| 每次交易比例 | 25% | 15% | 40% |
| 最小交易金额 | 1 token | 5 tokens | 1 token |
| 滑点容忍度 | 2% | 1% | 5% |
| 冷却区块数 | 5 blocks | 10 blocks | 2 blocks |

**使用示例**:
```python
from policy import TradingPolicy, ConservativePolicy

# 默认策略
policy = TradingPolicy()
decision = policy.decide(snapshot)

# 保守策略
conservative = ConservativePolicy()
decision = conservative.decide(snapshot)

if decision.should_trade():
    print(f"交易金额: {decision.amount_in}")
    print(f"最小输出: {decision.min_amount_out}")
```

### trader.py - 交易执行

**功能**:
- 构建 executeSwap 交易
- 签名并发送交易
- 等待交易确认
- 解析 AgentSwapExecuted 事件
- 返回交易结果

**主要类**:
- `TradeResult`: 交易结果
- `Trader`: 交易执行器

**使用示例**:
```python
from trader import Trader

trader = Trader(agent_address, private_key)
result = trader.execute_swap(decision, snapshot)

if result.success:
    print(f"TX Hash: {result.tx_hash.hex()}")
    print(f"Event: {result.event_data}")
else:
    print(f"Error: {result.error}")
```

### loop.py - 主循环

**功能**:
- 每 N 秒执行一次循环（默认 2 秒）
- 执行流程：snapshot → policy → trader
- 更新 state.json 状态文件
- 异常处理和日志记录
- 优雅退出（Ctrl+C）

**主要类**:
- `AgentLoop`: 主循环控制器

**命令行参数**:
```bash
python agent/loop.py --help

Options:
  --agent AGENT         Agent 索引（默认 0）
  --strategy STRATEGY   交易策略（default/conservative/aggressive）
  --interval INTERVAL   循环间隔（秒，默认 2）
```

## 📊 state.json 结构

Agent 运行时会自动生成 `state.json` 文件，包含以下信息：

```json
{
  "agent": {
    "address": "0x3C44...",
    "ensName": "agent.safe.eth",
    "label": "Primary Trading Agent",
    "strategy": "market-maker"
  },
  "status": "running",
  "loop_count": 42,
  "total_trades": 5,
  "last_update": "2026-02-02T16:30:45.123456",
  "last_trade_time": "2026-02-02T16:28:12.456789",
  "snapshot": {
    "block_number": 1234,
    "timestamp": 1738512645,
    "user_balance": "800000000000000000000",
    "agent_sub_balance": "150000000000000000000",
    "agent_spent": "50000000000000000000",
    "agent_config": { ... },
    "default_route": { ... }
  },
  "decision": {
    "action": "TRADE",
    "reason": "满足所有交易条件",
    "amount_in": "37500000000000000000",
    "min_amount_out": "36750000000000000000"
  },
  "last_trade": {
    "tx_hash": "0x320706ec...",
    "block_number": 1234,
    "gas_used": 225637,
    "event": { ... },
    "timestamp": "2026-02-02T16:28:12.456789"
  },
  "last_error": null
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `agent` | object | Agent 基本信息 |
| `status` | string | 运行状态（running/stopped/error） |
| `loop_count` | number | 循环执行次数 |
| `total_trades` | number | 总交易次数 |
| `last_update` | string | 最后更新时间（ISO 8601） |
| `last_trade_time` | string | 最后交易时间（ISO 8601） |
| `snapshot` | object | 链上状态快照 |
| `decision` | object | 策略决策结果 |
| `last_trade` | object | 最后一笔交易详情 |
| `last_error` | object | 最后一次错误信息 |

## 🔧 测试各个模块

### 测试 common.py

```bash
python agent/common.py
```

输出：
```
✅ 已连接到网络: localhost
   Chain ID: 31337
   Latest block: 59

=== 测试配置加载 ===
Network: localhost
Chain ID: 31337
Vault: 0x84eA74d481Ee0A5332c457a4d796187F6Ba67fEB
User: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8

=== Agents 配置 ===
  agent.safe.eth: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
    Enabled: True
    Max per trade: 100.0 ETH
```

### 测试 snapshot.py

```bash
python agent/snapshot.py
```

输出：
```
📸 获取链上状态快照...
   Block: #59
   Timestamp: 1738512645

💰 余额状态:
   User main balance: 800.0000 tokens
   Agent sub-balance: 150.0000 tokens
   Agent spent:       50.0000 tokens

⚙️  Agent 配置:
   Enabled: True
   ENS Node: 0xb63b...b834
   Max per trade: 100.0000 tokens
```

### 测试 policy.py

```bash
python agent/policy.py
```

输出：
```
🤔 策略决策中...
   ✅ 所有规则通过
   📊 交易参数:
      Amount in: 37.5000 tokens
      Min out: 36.7500 tokens
      Slippage: 2.0%

决策结果: TRADE: 满足所有交易条件 (amount_in=37.5000)
```

### 测试 trader.py

```bash
python agent/trader.py
```

输出：
```
🚀 执行交易...
   Amount in: 37.5000 tokens
   Min out: 36.7500 tokens
   📝 交易构建完成
      Nonce: 5
      Gas price: 1.50 gwei
   ✍️  交易已签名
   📤 交易已发送: 0x320706ec...
   ⏳ 等待交易确认: 0x320706ec...
   ✅ 交易确认成功
      Block: #60
      Gas used: 225637

📋 解析事件...
   ✅ AgentSwapExecuted 事件:
      Agent: 0x3C44...93BC
      User: 0x7099...79C8
      Amount In: 37.500000 tokens
      Amount Out: 37.102730 tokens
```

## 🎯 使用场景

### 场景 1: 本地测试

```bash
# Terminal 1: 启动本地节点
TMPDIR=~/hh-tmp npx hardhat node

# Terminal 2: 部署合约
TMPDIR=~/hh-tmp npx hardhat run scripts/demoAgent.js --network localhost

# Terminal 3: 运行 agent（默认策略）
python agent/loop.py

# Terminal 4: 监控状态
watch -n 1 'cat agent/state.json | jq ".decision, .last_trade"'
```

### 场景 2: 保守策略运行

```bash
# 使用保守策略，每 5 秒循环一次
python agent/loop.py --strategy conservative --interval 5
```

### 场景 3: 多 Agent 并行

```bash
# Terminal 1: Agent #0（默认策略）
python agent/loop.py --agent 0 --strategy default

# Terminal 2: Agent #1（保守策略）
python agent/loop.py --agent 1 --strategy conservative

# Terminal 3: Agent #2（激进策略）
python agent/loop.py --agent 2 --strategy aggressive
```

## 📈 前端集成

前端可以通过读取 `agent/state.json` 文件来显示 agent 状态：

```javascript
// 读取 agent 状态
fetch('/agent/state.json')
  .then(res => res.json())
  .then(state => {
    console.log('Agent status:', state.status);
    console.log('Total trades:', state.total_trades);
    console.log('Last decision:', state.decision.action);
    console.log('Last trade:', state.last_trade);
  });
```

或者使用 Python 状态服务器（已有的 `agent_py/status_server.py`）：

```python
# 修改 status_server.py 读取 state.json
import json
from pathlib import Path

@app.get("/status")
def get_status():
    state_file = Path(__file__).parent.parent / 'agent' / 'state.json'
    if state_file.exists():
        with open(state_file) as f:
            return json.load(f)
    return {"status": "offline"}
```

## ⚠️ 注意事项

### 安全性

1. **私钥保护**: `keys.local.json` 必须在 `.gitignore` 中
2. **测试环境**: 仅在测试网或本地节点使用
3. **资金限制**: 设置合理的 `maxNotionalPerTrade` 限额
4. **监控**: 定期检查 `state.json` 和日志

### 性能

1. **循环间隔**: 默认 2 秒，可根据需要调整
2. **RPC 限制**: 注意 RPC 提供商的速率限制
3. **Gas 费用**: 监控 gas 消耗，避免频繁交易

### 错误处理

1. **网络错误**: Agent 会自动重试下一次循环
2. **交易失败**: 记录在 `last_error` 中
3. **配置错误**: 启动时会检查并报错

## 🐛 故障排查

### 问题 1: 无法连接到 RPC

**错误**: `ConnectionError: 无法连接到 RPC`

**解决**:
```bash
# 检查 Hardhat 节点是否运行
lsof -i :8545

# 启动节点
TMPDIR=~/hh-tmp npx hardhat node
```

### 问题 2: 找不到配置文件

**错误**: `FileNotFoundError: 配置文件不存在`

**解决**:
```bash
# 确保配置文件存在
ls -la deployments/

# 运行部署脚本生成配置
TMPDIR=~/hh-tmp npx hardhat run scripts/demoAgent.js --network localhost
```

### 问题 3: Agent 一直 HOLD

**原因**: 可能不满足交易条件

**检查**:
```bash
# 运行 snapshot 查看状态
python agent/snapshot.py

# 运行 policy 查看决策原因
python agent/policy.py
```

### 问题 4: 交易失败

**错误**: `交易被 revert`

**可能原因**:
- 子账户余额不足
- 超过 maxNotionalPerTrade 限额
- 路由未启用
- Agent 未启用

**解决**: 检查 `state.json` 中的 `last_error` 字段

## 📝 开发指南

### 自定义策略

创建自己的策略类：

```python
from policy import TradingPolicy

class MyCustomPolicy(TradingPolicy):
    def __init__(self):
        super().__init__({
            'min_balance_ratio': 0.15,
            'trade_size_ratio': 0.3,
            'min_trade_amount': 2 * 10**18,
            'slippage_tolerance': 0.03,
            'cooldown_blocks': 7,
        })

    def decide(self, snapshot):
        # 添加自定义规则
        decision = super().decide(snapshot)

        # 例如：只在特定时间交易
        import datetime
        hour = datetime.datetime.now().hour
        if hour < 9 or hour > 17:
            return TradingDecision("HOLD", "非交易时间")

        return decision
```

### 添加新的决策规则

在 `policy.py` 的 `decide()` 方法中添加新规则：

```python
# 规则 10: 检查 gas 价格
gas_price = self.w3m.w3.eth.gas_price
max_gas_price = Web3.to_wei(50, 'gwei')
if gas_price > max_gas_price:
    return TradingDecision("HOLD", f"Gas 价格过高 ({Web3.from_wei(gas_price, 'gwei'):.2f} gwei)")
```

## 📄 许可证

MIT

---

**Happy Trading! 🚀**
