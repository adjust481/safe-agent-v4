# 前端更新说明 - Strategy & Signal 显示

## 修改文件列表

### 1. `/frontend/src/hooks/useAgentRuntime.js`
**修改内容**:
- 增强 fetch 错误处理，避免 HTML 被当作 JSON 解析
- 检查 `response.ok` 和 `content-type`
- 失败时读取 `response.text()` 而不是 `response.json()`
- 使用 `last_update` 替代 `runtime.lastHeartbeat` 检查心跳

**关键代码**:
```javascript
if (!response.ok) {
  const text = await response.text();
  throw new Error(`HTTP ${response.status}: ${text.substring(0, 100)}`);
}

const contentType = response.headers.get('content-type');
if (!contentType || !contentType.includes('application/json')) {
  const text = await response.text();
  throw new Error(`Expected JSON but got ${contentType}: ${text.substring(0, 100)}`);
}
```

### 2. `/frontend/src/PythonAgentStatusCard.jsx`
**修改内容**:
- 增强 fetch 错误处理（同上）
- 在 Agent 信息区域显示 **Strategy Badge**（sniper/arb/hold）
- 修改 "Current Decision" 为 "Last Decision"
- 添加 **Signal 折叠区域**，显示 `intent.meta.signal` 的 JSON 数据
- 添加 SWAP 和 ERROR 的 decision badge 样式

**新增 UI 元素**:
```jsx
// Strategy Badge
<div className="agent-strategy">
  <span className="strategy-label">Strategy:</span>
  <span className={`strategy-badge ${agent?.strategy || 'unknown'}`}>
    {agent?.strategy || 'unknown'}
  </span>
</div>

// Signal Section (可折叠)
{agentState.intent?.meta?.signal && (
  <div className="signal-section">
    <div className="section-title clickable" onClick={() => setSignalExpanded(!signalExpanded)}>
      📊 Market Signal {signalExpanded ? '▼' : '▶'}
    </div>
    {signalExpanded && (
      <div className="signal-content">
        <pre className="signal-json">
          {JSON.stringify(agentState.intent.meta.signal, null, 2)}
        </pre>
      </div>
    )}
  </div>
)}
```

### 3. `/frontend/src/PythonAgentStatusCard.css`
**修改内容**:
- 添加 Strategy Badge 样式（sniper/arb/hold/momentum/unknown）
- 添加 SWAP 和 ERROR 的 decision badge 样式
- 添加 Signal Section 样式（折叠动画、JSON 代码高亮）
- 添加自定义滚动条样式

**新增样式**:
```css
/* Strategy Badge 颜色 */
.strategy-badge.sniper { /* 粉色霓虹 */ }
.strategy-badge.arb { /* 绿色霓虹 */ }
.strategy-badge.hold { /* 灰色 */ }
.strategy-badge.momentum { /* 橙色霓虹 */ }

/* Decision Badge */
.decision-badge.swap { /* 绿色霓虹 + 呼吸动画 */ }
.decision-badge.error { /* 红色霓虹 */ }

/* Signal Section */
.signal-section { /* 折叠区域 */ }
.signal-json { /* JSON 代码样式 */ }
```

### 4. `/frontend/src/AgentDetailView.jsx`
**无需修改** - 已经在 header-strategy 和 config-row 中显示 strategy

### 5. `/frontend/src/AgentSidebar.jsx`
**无需修改** - 已经在第 109 行显示 strategy badge

---

## 如何运行（5 终端设置）

### 终端 A: Hardhat 本地链
```bash
cd ~/Desktop/safe-agent-v4
npx hardhat node
```
**作用**: 运行本地 Ethereum 测试网络
**端口**: 8545

---

### 终端 B: 部署合约（一次性）
```bash
cd ~/Desktop/safe-agent-v4
npx hardhat run scripts/deploy-local.js --network localhost
```
**作用**: 部署 SafeAgentVault 合约和 demo agent
**运行一次**: 是（除非重启 Hardhat）

---

### 终端 C: Python Agent Loop
```bash
cd ~/Desktop/safe-agent-v4/agent_py
source .venv/bin/activate

# DRY_RUN 模式（推荐测试）
DRY_RUN=1 POLL_INTERVAL=5 python loop_agent.py

# 或限制交易次数
DRY_RUN=1 POLL_INTERVAL=5 STOP_AFTER_N_TRADES=10 python loop_agent.py
```
**作用**: 运行 agent 主循环，每 5 秒写入 state.json
**端口**: 无
**输出**: state.json

---

### 终端 D: HTTP 服务器
```bash
cd ~/Desktop/safe-agent-v4
python3 server.py
```
**作用**: 提供 HTTP 服务，让前端访问 state.json
**端口**: 8888
**关键**: 必须在项目根目录启动

**验证**:
```bash
curl http://localhost:8888/agent_py/state.json | python3 -m json.tool
```

---

### 终端 E: 前端开发服务器
```bash
cd ~/Desktop/safe-agent-v4/frontend
npm run dev
```
**作用**: 运行前端界面
**端口**: 5173
**访问**: http://localhost:5173

---

## 页面上应该看到的新增字段

### 1. Python Agent Status Card

#### **Strategy Badge**（Agent 信息区域）
- 位置: Agent 名称和地址下方
- 显示: `Strategy: sniper` / `Strategy: arb` / `Strategy: hold`
- 样式:
  - `sniper`: 粉色霓虹边框 + 发光效果
  - `arb`: 绿色霓虹边框 + 发光效果
  - `hold`: 灰色边框
  - `momentum`: 橙色霓虹边框 + 发光效果

#### **Last Decision**（决策区域）
- 位置: Strategy Badge 下方
- 显示:
  - Action Badge: `HOLD` / `SWAP` / `ERROR`
  - Reason: `sniper:snipe_at_0.9990` / `arb:spread_0.0040`
- 样式:
  - `HOLD`: 粉色霓虹
  - `SWAP`: 绿色霓虹 + 呼吸动画
  - `ERROR`: 红色霓虹

#### **Market Signal**（可折叠区域）
- 位置: Last Decision 下方
- 显示: 点击 "📊 Market Signal ▶" 展开
- 内容: JSON 格式显示 signal 数据
  ```json
  {
    "best_bid": 0.998,
    "best_ask": 0.999,
    "spread": 0.001,
    "timestamp": "2026-02-04T22:30:00Z",
    "source": "manual"
  }
  ```
- 样式: 黑色背景 + 绿色代码高亮 + 自定义滚动条

---

### 2. Agent Detail View

#### **Header Meta**（顶部区域）
- 位置: Agent 地址下方
- 显示: `Strategy: sniper` / `Strategy: arb`
- 样式: 与 sidebar 一致的 strategy badge

#### **Configuration Card**
- 位置: 配置卡片中
- 显示: `Strategy: sniper`
- 样式: 高亮显示

---

### 3. Agent Sidebar

#### **Strategy Badge**（列表项中）
- 位置: Agent 名称和 ENS 下方
- 显示: `sniper` / `arb` / `hold`
- 样式: 使用 agent.ui.color 作为主题色

---

## 数据流说明

```
loop_agent.py (Python)
  ↓ 每 N 秒
  ↓ 读取 signals.json
  ↓ 执行策略决策
  ↓ 写入 state.json (atomic write)

state.json
  ↓ HTTP 服务器 (port 8888)
  ↓ GET /agent_py/state.json

前端 (port 5173)
  ↓ fetch('http://localhost:8888/agent_py/state.json')
  ↓ 解析 JSON
  ↓ 显示 strategy / decision / signal
```

---

## state.json 格式示例

```json
{
  "status": "running",
  "last_update": "2026-02-04T11:42:27.159450Z",
  "loop_count": 1,
  "total_trades": 1,

  "agent": {
    "address": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    "ensName": "agent.safe.eth",
    "strategy": "sniper"
  },

  "decision": {
    "action": "SWAP",
    "reason": "sniper:snipe_at_0.9990"
  },

  "intent": {
    "action": "SWAP",
    "reason": "sniper:snipe_at_0.9990",
    "zeroForOne": true,
    "amountIn": "100000000000000000000",
    "minOut": "99500000000000000000",
    "meta": {
      "signal": {
        "best_bid": 0.998,
        "best_ask": 0.999,
        "spread": 0.001,
        "timestamp": "2026-02-04T22:30:00Z",
        "source": "manual"
      }
    }
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
    "timestamp": "2026-02-04T11:42:27.159450Z",
    "event": {
      "amountIn": "100000000000000000000",
      "amountOut": "99500000000000000000"
    }
  }
}
```

---

## 错误处理

### 1. "Unexpected token <" 错误
**原因**: fetch 到了 HTML (404 页面) 而不是 JSON

**解决**:
- 确保 HTTP 服务器在项目根目录启动: `cd ~/Desktop/safe-agent-v4 && python3 server.py`
- 前端会显示错误信息: `HTTP 404: <!DOCTYPE html>...`

### 2. Content-Type 不是 JSON
**原因**: HTTP 服务器返回了错误的 content-type

**解决**:
- 检查 server.py 是否正确设置 `Content-Type: application/json`
- 前端会显示错误信息: `Expected JSON but got text/html`

### 3. Signal 不显示
**原因**: `intent.meta.signal` 不存在

**可能原因**:
- Agent 决策是 HOLD（没有 intent）
- Strategy 没有在 meta 中包含 signal
- signals.json 为空或解析失败

**验证**:
```bash
# 检查 state.json 是否有 intent.meta.signal
curl -s http://localhost:8888/agent_py/state.json | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('intent', {}).get('meta', {}).get('signal'))"
```

---

## 快速自检

```bash
cd ~/Desktop/safe-agent-v4

# 1. 检查 state.json 格式
bash check-state-json.sh

# 2. 检查所有服务
lsof -i :8545  # Hardhat
lsof -i :8888  # HTTP Server
lsof -i :5173  # Vite

# 3. 检查 agent 进程
ps aux | grep loop_agent.py | grep -v grep

# 4. 测试 HTTP 访问
curl http://localhost:8888/agent_py/state.json | python3 -m json.tool | head -50
```

---

## 截图示例（预期效果）

### Python Agent Status Card
```
┌─────────────────────────────────────────┐
│ 🐍 Python Agent Status      [●] Online │
├─────────────────────────────────────────┤
│ agent.safe.eth                          │
│ 0x3C44...93BC                           │
│ Strategy: [sniper] ← 粉色霓虹边框       │
├─────────────────────────────────────────┤
│ Last Decision                           │
│ [SWAP] ← 绿色霓虹 + 呼吸动画            │
│ sniper:snipe_at_0.9990                  │
├─────────────────────────────────────────┤
│ 📊 Market Signal ▶ ← 点击展开           │
│   {                                     │
│     "best_bid": 0.998,                  │
│     "best_ask": 0.999,                  │
│     "spread": 0.001                     │
│   }                                     │
└─────────────────────────────────────────┘
```

---

## 注意事项

1. **HTTP 服务器必须在项目根目录启动**，否则 `/agent_py/state.json` 会 404
2. **前端使用绝对 URL**: `http://localhost:8888/agent_py/state.json`（不使用相对路径）
3. **Signal 数据来源**: `intent.meta.signal`（只有 SWAP 决策时才有 intent）
4. **Strategy 数据来源**: `agent.strategy`（来自 agents.local.json 或 state.json）
5. **错误处理**: 前端会显示详细错误信息，不会崩溃

---

## 完整启动流程

```bash
# 1. 启动 Hardhat (终端 A)
cd ~/Desktop/safe-agent-v4
npx hardhat node

# 2. 部署合约 (终端 B，一次性)
cd ~/Desktop/safe-agent-v4
npx hardhat run scripts/deploy-local.js --network localhost

# 3. 启动 HTTP 服务器 (终端 D)
cd ~/Desktop/safe-agent-v4
python3 server.py

# 4. 启动 Agent (终端 C)
cd ~/Desktop/safe-agent-v4/agent_py
source .venv/bin/activate
DRY_RUN=1 POLL_INTERVAL=5 python loop_agent.py

# 5. 启动前端 (终端 E)
cd ~/Desktop/safe-agent-v4/frontend
npm run dev

# 6. 打开浏览器
open http://localhost:5173
```

---

## 总结

✅ **Strategy 显示**: 在 Agent Status Card、Detail View、Sidebar 中显示
✅ **Last Decision 显示**: 显示 action (HOLD/SWAP/ERROR) + reason
✅ **Signal 显示**: 可折叠的 JSON 格式显示
✅ **错误处理**: 健壮的 fetch 错误处理，避免 HTML 被当作 JSON 解析
✅ **样式优化**: 霓虹风格的 strategy badge 和 decision badge
