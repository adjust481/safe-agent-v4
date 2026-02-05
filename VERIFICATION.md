# SafeAgentVault 修复验证清单

## ✅ 已完成的修复

### 1. Python Agent 后端 (`agent_py/loop_agent.py`)
- ✅ 每轮循环更新 `runtime.lastHeartbeat`
- ✅ 模拟 PnL 数据更新（DRY_RUN 模式）
- ✅ 日志系统（限制80条）
- ✅ PnL 历史记录（限制200条）
- ✅ 使用绝对路径写入 `state.json`

### 2. 前端组件修复

#### AgentLogsPanel (`frontend/src/components/AgentLogsPanel.jsx`)
- ✅ 默认收起状态，仅显示最新 1 条日志
- ✅ 展开后显示最新 30 条日志
- ✅ 按 level 渲染颜色：INFO (绿)、WARN (黄)、ERROR (红)
- ✅ 时间格式：HH:mm:ss
- ✅ 添加收起状态的预览面板

#### AgentPnLChart (`frontend/src/components/AgentPnLChart.jsx`)
- ✅ X轴时间格式改为 HH:mm:ss
- ✅ 无数据时显示 "No PnL data"
- ✅ 使用 Recharts AreaChart

#### AgentHeartbeat (`frontend/src/components/AgentHeartbeat.jsx`)
- ✅ 超过 60 秒显示灰色 Offline
- ✅ 60 秒内显示绿色 Online + 脉冲动画
- ✅ 显示 iteration 和 mode

#### useAgentRuntime Hook (`frontend/src/hooks/useAgentRuntime.js`)
- ✅ 每 3 秒轮询 state.json
- ✅ 自动检测离线状态（>60秒或fetch失败）
- ✅ 返回 { data, offline, error }

### 3. 配置文件修复 (`frontend/public/deployments/agents.local.json`)
- ✅ 所有 3 个 agents 都包含 `flags.showPnL` 和 `flags.showLogs`
- ✅ 包含 `runtime.lastHeartbeat` 字段

### 4. 布局优化 (`frontend/src/App.css`)
- ✅ 两栏布局：`grid-template-columns: 320px 1fr`
- ✅ 左侧：Agent 列表（320px）
- ✅ 右侧：Agent 详情 + 运行时组件（自适应）

---

## 🧪 验证步骤

### Step 1: 启动 Hardhat 节点
```bash
cd ~/Desktop/safe-agent-v4
npx hardhat node
```

### Step 2: 部署合约并同步
```bash
# 新终端
cd ~/Desktop/safe-agent-v4
TMPDIR=~/hh-tmp npx hardhat run scripts/demoAgent.js --network localhost
./sync-frontend.sh
```

### Step 3: 启动 Python Agent
```bash
# 新终端
cd ~/Desktop/safe-agent-v4/agent_py
source .venv/bin/activate
DRY_RUN=1 POLL_INTERVAL=5 python loop_agent.py
```

### Step 4: 启动 HTTP 服务器
```bash
# 新终端
cd ~/Desktop/safe-agent-v4
python3 -m http.server 8888
```

### Step 5: 启动前端
```bash
# 新终端
cd ~/Desktop/safe-agent-v4/frontend
npm run dev
```

### Step 6: 验证 state.json 更新
```bash
# 新终端
watch -n 2 "curl -s http://localhost:8888/agent_py/state.json | jq '.runtime.lastHeartbeat'"
```

---

## ✅ 前端验证清单

打开浏览器访问 http://localhost:5173，检查以下功能：

### 心跳灯 (AgentHeartbeat)
- [ ] 显示绿色圆点 + "Online" 标签
- [ ] 显示 "Last update: X seconds ago"
- [ ] 显示 Iteration 数字
- [ ] 显示 Mode: DRY_RUN

### PnL 图表 (AgentPnLChart)
- [ ] 显示折线图（如果有数据）
- [ ] X轴时间格式为 HH:mm:ss
- [ ] 显示 "Total: +0.0000" 或实际值
- [ ] 无数据时显示 "No PnL data"

### 日志面板 (AgentLogsPanel)
- [ ] 默认收起，显示最新 1 条日志预览
- [ ] 点击展开后显示最新 30 条日志
- [ ] INFO 日志显示绿色边框
- [ ] WARN 日志显示黄色边框
- [ ] ERROR 日志显示红色边框
- [ ] 时间格式为 HH:mm:ss

### 布局
- [ ] 左侧显示 3 个 agents
- [ ] 右侧显示选中 agent 的详情
- [ ] 右侧包含：Balances、Configuration、Default Route、Pool Helper 卡片
- [ ] 右侧底部显示：Heartbeat + PnL Chart + Logs Panel

---

## 🔍 调试命令

### 检查 state.json 结构
```bash
curl -s http://localhost:8888/agent_py/state.json | jq '.'
```

### 检查心跳时间
```bash
curl -s http://localhost:8888/agent_py/state.json | jq '.runtime.lastHeartbeat'
```

### 检查 PnL 历史
```bash
curl -s http://localhost:8888/agent_py/state.json | jq '.pnlHistory | length'
```

### 检查日志数量
```bash
curl -s http://localhost:8888/agent_py/state.json | jq '.logs | length'
```

### 检查最新日志
```bash
curl -s http://localhost:8888/agent_py/state.json | jq '.logs[-1]'
```

---

## 📊 预期结果

### state.json 结构示例
```json
{
  "status": "running",
  "last_update": "2026-02-03T18:49:00Z",
  "runtime": {
    "lastHeartbeat": "2026-02-03T18:49:00Z",
    "iteration": 42,
    "mode": "DRY_RUN"
  },
  "pnlHistory": [
    { "timestamp": "2026-02-03T18:20:00Z", "pnl": 0.0 },
    { "timestamp": "2026-02-03T18:25:00Z", "pnl": 1.2 }
  ],
  "logs": [
    { "ts": "2026-02-03T18:28:18Z", "level": "INFO", "msg": "Iteration 42 HOLD ..." }
  ]
}
```

### 前端显示效果
- 心跳灯：🟢 Online (绿色脉冲)
- PnL 图表：显示累计收益曲线
- 日志面板：收起时显示 1 条，展开显示 30 条

---

## ⚠️ 常见问题

### 问题 1: 心跳灯显示灰色
**原因**: state.json 超过 60 秒未更新
**解决**: 检查 Python agent 是否正在运行

### 问题 2: PnL 图表不显示
**原因**: pnlHistory 数组为空
**解决**: 等待 agent 执行 swap 操作（DRY_RUN 模式会模拟）

### 问题 3: 日志面板为空
**原因**: logs 数组为空
**解决**: 检查 Python agent 是否正常启动并写入日志

### 问题 4: 404 错误
**原因**: HTTP 服务器未从正确目录启动
**解决**: 确保在 `~/Desktop/safe-agent-v4` 目录启动 http.server

---

## 🎉 成功标志

当所有以下条件满足时，系统运行正常：

1. ✅ Python agent 每 5 秒输出一次 "Iteration X"
2. ✅ state.json 文件每 5 秒更新一次
3. ✅ 前端心跳灯显示绿色
4. ✅ 前端 PnL 图表显示数据（如果有 swap）
5. ✅ 前端日志面板显示最新日志
6. ✅ 布局为两栏，无空白区域

---

## 📝 修改文件清单

### 已修改文件
1. `frontend/src/components/AgentLogsPanel.jsx` - 修复日志显示逻辑
2. `frontend/src/components/AgentLogsPanel.css` - 添加收起状态样式
3. `frontend/src/components/AgentPnLChart.jsx` - 修复时间格式
4. `frontend/public/deployments/agents.local.json` - 补全 flags 字段

### 已验证正确的文件
1. `agent_py/loop_agent.py` - 后端逻辑正确
2. `frontend/src/hooks/useAgentRuntime.js` - Hook 逻辑正确
3. `frontend/src/components/AgentHeartbeat.jsx` - 心跳组件正确
4. `frontend/src/AgentDetailView.jsx` - 集成所有组件
5. `frontend/src/App.css` - 布局正确

---

## 🚀 下一步（可选）

### 钱包集成
如需添加钱包连接功能，可安装：
```bash
cd frontend
npm install wagmi viem @tanstack/react-query
npm install @web3modal/wagmi @web3modal/react
```

### 实时更新优化
考虑使用 WebSocket 替代轮询：
- 后端：使用 FastAPI + WebSocket
- 前端：使用 useWebSocket hook

### 性能监控
添加性能指标：
- Gas 消耗统计
- 交易成功率
- 平均执行时间
