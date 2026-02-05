# SafeAgentVault 完整测试指南

## 🎯 快速启动（5个终端）

### Terminal 1: Hardhat 节点
```bash
cd ~/Desktop/safe-agent-v4
npx hardhat node
```

### Terminal 2: 部署合约
```bash
cd ~/Desktop/safe-agent-v4
TMPDIR=~/hh-tmp npx hardhat run scripts/demoAgent.js --network localhost
./sync-frontend.sh
```

### Terminal 3: Python Agent
```bash
cd ~/Desktop/safe-agent-v4/agent_py
source .venv/bin/activate
DRY_RUN=1 POLL_INTERVAL=5 python loop_agent.py
```

### Terminal 4: HTTP 服务器
```bash
cd ~/Desktop/safe-agent-v4
python3 -m http.server 8888
```

### Terminal 5: 前端
```bash
cd ~/Desktop/safe-agent-v4/frontend
npm run dev
```

---

## ✅ 验证清单

### 1. 检查服务状态
```bash
# 运行状态检查脚本
cd ~/Desktop/safe-agent-v4
bash check-status.sh
```

### 2. 实时监控心跳
```bash
watch -n 2 "curl -s http://localhost:8888/agent_py/state.json | grep lastHeartbeat"
```

### 3. 查看完整状态
```bash
curl -s http://localhost:8888/agent_py/state.json | jq '.'
```

### 4. 检查日志数量
```bash
curl -s http://localhost:8888/agent_py/state.json | jq '.logs | length'
```

### 5. 检查 PnL 历史
```bash
curl -s http://localhost:8888/agent_py/state.json | jq '.pnlHistory | length'
```

---

## 🌐 浏览器验证

打开 http://localhost:5173

### 预期效果：

#### 💚 心跳灯 (AgentHeartbeat)
- ✅ 显示绿色圆点
- ✅ 有脉冲动画（pulse-ring）
- ✅ 显示 "Online" 标签
- ✅ 显示 "Last update: X seconds ago"
- ✅ 显示 Iteration 数字
- ✅ 显示 Mode: DRY_RUN

#### 📈 PnL 图表 (AgentPnLChart)
- ✅ 显示折线图（如果有数据）
- ✅ X轴时间格式为 `HH:mm:ss`
- ✅ Y轴显示 PnL 数值
- ✅ 鼠标悬停显示详细信息
- ✅ 无数据时显示 "No PnL data"

#### 🪵 日志面板 (AgentLogsPanel)
- ✅ 默认收起，显示最新 1 条日志
- ✅ 点击展开后显示最新 30 条日志
- ✅ INFO 日志显示绿色边框 (#00ff99)
- ✅ WARN 日志显示黄色边框 (#ffaa00)
- ✅ ERROR 日志显示红色边框 (#ff4ec9)
- ✅ 时间格式为 `HH:mm:ss`
- ✅ 日志可滚动查看

#### 🎨 布局
- ✅ 左侧：Agent 列表（320px 宽）
- ✅ 右侧：Agent 详情（自适应宽度）
- ✅ 无空白区域
- ✅ 响应式设计

---

## 🔍 故障排查

### 问题 1: 心跳灯显示灰色
**症状**: 圆点为灰色，显示 "Offline"

**原因**:
- state.json 超过 60 秒未更新
- Python agent 未运行
- HTTP 服务器未启动

**解决**:
```bash
# 检查 Python agent 是否运行
pgrep -f loop_agent.py

# 检查 state.json 是否可访问
curl http://localhost:8888/agent_py/state.json

# 重启 Python agent
cd ~/Desktop/safe-agent-v4/agent_py
source .venv/bin/activate
DRY_RUN=1 POLL_INTERVAL=5 python loop_agent.py
```

### 问题 2: PnL 图表不显示
**症状**: 显示 "No PnL data"

**原因**:
- pnlHistory 数组为空
- Agent 尚未执行任何交易

**解决**:
- 等待 agent 执行 swap 操作（DRY_RUN 模式会模拟）
- 检查 state.json 中是否有 pnlHistory 数据

### 问题 3: 日志面板为空
**症状**: 显示 "No logs yet"

**原因**:
- logs 数组为空
- Python agent 未正常启动

**解决**:
```bash
# 检查 state.json 中的日志
curl -s http://localhost:8888/agent_py/state.json | jq '.logs'

# 查看 Python agent 输出
# 应该看到类似 "Iteration X" 的输出
```

### 问题 4: 404 错误
**症状**: 浏览器控制台显示 404 错误

**原因**:
- HTTP 服务器未从正确目录启动
- 路径配置错误

**解决**:
```bash
# 确保从项目根目录启动 HTTP 服务器
cd ~/Desktop/safe-agent-v4
python3 -m http.server 8888

# 验证路径
curl http://localhost:8888/agent_py/state.json
```

### 问题 5: 前端依赖错误
**症状**: 浏览器控制台显示 "Cannot find module 'date-fns'"

**原因**:
- 依赖未安装

**解决**:
```bash
cd ~/Desktop/safe-agent-v4/frontend
npm install date-fns recharts
npm run dev
```

---

## 📊 state.json 结构示例

```json
{
  "status": "running",
  "last_update": "2026-02-03T20:38:20Z",
  "runtime": {
    "lastHeartbeat": "2026-02-03T20:38:20Z",
    "iteration": 42,
    "mode": "DRY_RUN"
  },
  "decision": {
    "action": "HOLD",
    "reason": "cooldown"
  },
  "pnlHistory": [
    {
      "timestamp": "2026-02-03T20:20:00Z",
      "pnl": 0.0
    },
    {
      "timestamp": "2026-02-03T20:25:00Z",
      "pnl": 1.2345
    }
  ],
  "logs": [
    {
      "ts": "2026-02-03T20:38:18Z",
      "level": "INFO",
      "msg": "Iteration 42 HOLD - cooldown"
    },
    {
      "ts": "2026-02-03T20:38:23Z",
      "level": "INFO",
      "msg": "Iteration 43 HOLD - cooldown"
    }
  ]
}
```

---

## 🎉 成功标志

当所有以下条件满足时，系统运行正常：

1. ✅ Python agent 每 5 秒输出 "Iteration X"
2. ✅ state.json 每 5 秒更新 lastHeartbeat
3. ✅ 前端心跳灯显示绿色 + 脉冲动画
4. ✅ 前端 PnL 图表显示数据（如果有交易）
5. ✅ 前端日志面板显示最新日志
6. ✅ 布局为两栏，左侧 320px，右侧自适应
7. ✅ 无空白区域
8. ✅ 离线状态时显示灰色圆点，不崩溃

---

## 📝 已修复的文件清单

### 后端
- ✅ `agent_py/loop_agent.py` - 完整的状态管理系统

### 前端组件
- ✅ `frontend/src/hooks/useAgentRuntime.js` - 统一状态获取
- ✅ `frontend/src/components/AgentHeartbeat.jsx` - 心跳组件
- ✅ `frontend/src/components/AgentHeartbeat.css` - 心跳样式（含脉冲动画）
- ✅ `frontend/src/components/AgentPnLChart.jsx` - PnL 图表
- ✅ `frontend/src/components/AgentPnLChart.css` - 图表样式
- ✅ `frontend/src/components/AgentLogsPanel.jsx` - 日志面板
- ✅ `frontend/src/components/AgentLogsPanel.css` - 日志样式

### 前端集成
- ✅ `frontend/src/AgentDetailView.jsx` - 集成所有组件
- ✅ `frontend/src/AgentDetailView.css` - 详情页样式
- ✅ `frontend/src/App.css` - 两栏布局

### 配置
- ✅ `frontend/public/deployments/agents.local.json` - Agent 配置
- ✅ `frontend/.env` - 环境变量

### 脚本
- ✅ `start-all.sh` - 启动指南
- ✅ `check-status.sh` - 状态检查脚本
- ✅ `TESTING.md` - 本文档

---

## 🚀 下一步

系统已完全配置完成，可以立即开始测试：

1. 按照上方 "快速启动" 部分启动所有 5 个服务
2. 运行 `bash check-status.sh` 验证服务状态
3. 打开浏览器访问 http://localhost:5173
4. 验证所有组件正常显示

如有问题，参考 "故障排查" 部分。
