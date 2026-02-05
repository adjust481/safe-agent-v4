# 4-Terminal Setup Guide (推荐黄金路径)

## 终端 A: Hardhat 本地链
```bash
cd ~/Desktop/safe-agent-v4
npx hardhat node
```
**作用**: 运行本地 Ethereum 测试网络 (chainId: 31337)
**保持运行**: 是
**端口**: 8545

---

## 终端 B: HTTP 服务器 (Flask + CORS)
```bash
cd ~/Desktop/safe-agent-v4
python3 server.py
```
**作用**: 提供 HTTP 服务，让前端能访问 `agent_py/state.json`
**保持运行**: 是
**端口**: 8888
**关键**: 必须在项目根目录启动，否则 `/agent_py/state.json` 会 404

**验证**:
```bash
curl http://localhost:8888/agent_py/state.json | python3 -m json.tool
```

---

## 终端 C: Agent 循环 (loop_agent.py)
```bash
cd ~/Desktop/safe-agent-v4/agent_py
source .venv/bin/activate

# DRY_RUN 模式 (推荐测试)
DRY_RUN=1 POLL_INTERVAL=5 python loop_agent.py

# 或者限制交易次数后自动停止
DRY_RUN=1 POLL_INTERVAL=5 STOP_AFTER_N_TRADES=10 python loop_agent.py

# LIVE 模式 (真实交易)
POLL_INTERVAL=10 python loop_agent.py
```
**作用**: 运行 agent 主循环，每 N 秒读取 `signals.json` 并执行策略
**保持运行**: 是
**输出**: 每轮决策日志 + 写入 `state.json`

**环境变量**:
- `DRY_RUN=1`: 模拟模式，不发送真实交易
- `POLL_INTERVAL=N`: 每 N 秒轮询一次 (默认 10)
- `STOP_AFTER_N_TRADES=N`: 执行 N 次交易后自动停止

---

## 终端 D: 前端开发服务器 (Vite)
```bash
cd ~/Desktop/safe-agent-v4/frontend
npm run dev
```
**作用**: 运行前端界面，实时显示 agent 状态
**保持运行**: 是
**端口**: 5173
**访问**: http://localhost:5173

---

## 快速自检命令

### 检查 state.json 是否正常
```bash
cd ~/Desktop/safe-agent-v4
bash check-state-json.sh
```

### 检查所有服务是否运行
```bash
# Hardhat (8545)
lsof -i :8545

# HTTP Server (8888)
lsof -i :8888

# Vite (5173)
lsof -i :5173

# Agent 进程
ps aux | grep loop_agent.py | grep -v grep
```

### 手动编辑信号 (触发策略)
```bash
cd ~/Desktop/safe-agent-v4/agent_py

# 编辑 signals.json
nano signals.json

# 示例: 触发 sniper 策略 (best_ask < target_price)
{
  "best_bid": 0.998,
  "best_ask": 0.999,
  "spread": 0.001,
  "timestamp": "2026-02-04T22:30:00Z",
  "source": "manual"
}
```

---

## 常见问题

### 1. 前端显示 "Unexpected token <"
**原因**: HTTP 服务器返回了 HTML (404 页面) 而不是 JSON
**解决**: 确保 `server.py` 在项目根目录 (`~/Desktop/safe-agent-v4`) 启动

### 2. state.json 格式不对
**原因**: 可能有旧的 agent 进程还在运行
**解决**:
```bash
# 杀掉所有 agent 进程
pkill -9 -f "python.*loop_agent"

# 删除旧文件
rm -f agent_py/state.json agent_py/state.json.tmp

# 重新启动 agent
cd agent_py && source .venv/bin/activate && DRY_RUN=1 POLL_INTERVAL=5 python loop_agent.py
```

### 3. signals.json 解析失败
**行为**: Agent 不会崩溃，会在 `state.json` 的 `last_error` 字段记录错误
**解决**: 检查 `signals.json` 是否是合法 JSON
```bash
python3 -m json.tool agent_py/signals.json
```

---

## state.json 格式说明

```json
{
  "status": "running",
  "last_update": "2026-02-04T11:45:27.123456Z",
  "loop_count": 12,
  "total_trades": 2,

  "agent": {
    "address": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    "ensName": "agent.safe.eth",
    "strategy": "sniper"
  },

  "decision": {
    "action": "HOLD|SWAP|ERROR",
    "reason": "sniper:snipe_at_0.9990"
  },

  "intent": {
    "action": "SWAP",
    "reason": "sniper:snipe_at_0.9990",
    "zeroForOne": true,
    "amountIn": "100000000000000000000",
    "minOut": "99500000000000000000",
    "meta": {}
  },

  "snapshot": {
    "agent_sub_balance": "150000000000000000000",
    "agent_spent": "50000000000000000000",
    "vault_balance": "950000000000000000000"
  },

  "last_trade": {
    "tx_hash": null,
    "block_number": null,
    "gas_used": null,
    "timestamp": "2026-02-04T11:45:27.123456Z",
    "event": {
      "amountIn": "100000000000000000000",
      "amountOut": "99500000000000000000"
    }
  },

  "last_error": {
    "message": "signals.json parse error: ...",
    "timestamp": "2026-02-04T11:45:27.123456Z"
  }
}
```

**字段说明**:
- `intent`: 仅当策略返回 SWAP 时存在
- `last_trade`: 仅当有交易执行时存在
- `last_error`: 仅当有错误时存在 (如 signals.json 解析失败)

---

## 策略配置

编辑 `deployments/agents.local.json`:

```json
{
  "agents": [
    {
      "address": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      "ensName": "agent.safe.eth",
      "strategy": "sniper",
      "strategyParams": {
        "target_price": 1.0,
        "size": 100.0
      },
      "config": {
        "slippageTolerance": 0.5,
        "maxNotionalPerTrade": "100"
      }
    }
  ]
}
```

**可用策略**:
- `hold`: 永远不交易
- `sniper`: 当 `best_ask < target_price` 时买入
- `arb` / `arbitrage`: 当 `spread > threshold` 时套利
- `momentum`: 旧策略 (已废弃)

---

## 完整启动流程

```bash
# 1. 启动 Hardhat (终端 A)
cd ~/Desktop/safe-agent-v4
npx hardhat node

# 2. 部署合约 (一次性，新终端)
cd ~/Desktop/safe-agent-v4
npx hardhat run scripts/deploy-local.js --network localhost

# 3. 启动 HTTP 服务器 (终端 B)
cd ~/Desktop/safe-agent-v4
python3 server.py

# 4. 启动 Agent (终端 C)
cd ~/Desktop/safe-agent-v4/agent_py
source .venv/bin/activate
DRY_RUN=1 POLL_INTERVAL=5 python loop_agent.py

# 5. 启动前端 (终端 D)
cd ~/Desktop/safe-agent-v4/frontend
npm run dev

# 6. 打开浏览器
open http://localhost:5173
```
