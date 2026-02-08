#!/bin/bash
# 完整诊断报告 - SafeAgentVault

echo "🔍 SafeAgentVault 诊断报告"
echo "================================"
echo ""

# 1. 检查所有服务状态
echo "📊 服务状态检查"
echo "--------------------------------"

echo -n "1. Hardhat 节点 (8545): "
if curl -s http://localhost:8545 &>/dev/null; then
    echo "✅ 运行中"
else
    echo "❌ 未运行"
fi

echo -n "2. HTTP 服务器 (8888): "
if curl -s http://localhost:8888 &>/dev/null; then
    echo "✅ 运行中"
else
    echo "❌ 未运行"
fi

echo -n "3. 前端服务 (5173): "
if curl -s http://localhost:5173 &>/dev/null; then
    echo "✅ 运行中"
else
    echo "❌ 未运行"
fi

echo -n "4. Python Agent: "
if pgrep -f "loop_agent.py" &>/dev/null; then
    echo "✅ 运行中 (PID: $(pgrep -f loop_agent.py))"
else
    echo "❌ 未运行"
fi

echo ""
echo "📁 配置文件检查"
echo "--------------------------------"

# 2. 检查 agents.local.json
echo "agents.local.json:"
AGENTS_DATA=$(curl -s http://localhost:8888/deployments/agents.local.json)
AGENT_COUNT=$(echo "$AGENTS_DATA" | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data.get('agents', [])))" 2>/dev/null)
HAS_FLAGS=$(echo "$AGENTS_DATA" | python3 -c "import sys, json; data=json.load(sys.stdin); print('flags' in data['agents'][0] if data.get('agents') else False)" 2>/dev/null)

echo "  - Agents 数量: $AGENT_COUNT"
echo "  - 包含 flags 字段: $HAS_FLAGS"

if [ "$HAS_FLAGS" = "True" ]; then
    SHOW_PNL=$(echo "$AGENTS_DATA" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['agents'][0].get('flags', ).get('showPnL', False))" 2>/dev/null)
    SHOW_LOGS=$(echo "$AGENTS_DATA" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['agents'][0].get('flags', {}).get('showLogs', False))" 2>/dev/null)
    echo "  - showPnL: $SHOW_PNL"
    echo "  - showLogs: $SHOW_LOGS"
fi

echo ""
echo "💓 Agent 运行时状态"
echo "--------------------------------"

# 3. 检查 state.json
STATE_DATA=$(curl -s http://localhost:8888/agent_py/state.json)
if [ $? -eq 0 ]; then
    echo "state.json: ✅ 可访问"

    HEARTBEAT=$(echo "$STATE_DATA" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['runtime']['lastHeartbeat'])" 2>/dev/null)
    ITERATION=$(echo "$STATE_DATA" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['runtime']['iteration'])" 2>/dev/null)
    MODE=$(echo "$STATE_DATA" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['runtime']['mode'])" 2>/dev/null)

    echo "  - 最新心跳: $HEARTBEAT"
    echo "  - 迭代次数: $ITERATION"
    echo "  - 运行模式: $MODE"

    # 计算心跳时间差
    SECONDS_AGO=$(python3 -c "from datetime import datetime; import sys; hb='$HEARTBEAT'; now=datetime.utcnow(); hb_time=datetime.fromisoformat(hb.replace('Z','')); print(int((now-hb_time).total_seconds()))" 2>/dev/null)

    if [ -n "$SECONDS_AGO" ]; then
        echo "  - 距今时间: ${SECONDS_AGO}秒"
        if [ "$SECONDS_AGO" -lt 60 ]; then
            echo "  - 状态: 🟢 ONLINE"
        else
            echo "  - 状态: ⚪ OFFLINE (超过60秒)"
        fi
    fi

    # 检查数据完整性
    PNL_COUNT=$(echo "$STATE_DATA" | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data.get('pnlHistory', [])))" 2>/dev/null)
    LOGS_COUNT=$(echo "$STATE_DATA" | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data.get('logs', [])))" 2>/dev/null)

    echo "  - PnL 历史记录: $PNL_COUNT 条"
    echo "  - 日志记录: $LOGS_COUNT 条"
else
    echo "state.json: ❌ 无法访问"
fi

echo ""
echo "🎨 前端组件状态"
echo "--------------------------------"

if [ "$HAS_FLAGS" = "True" ] && [ "$SHOW_PNL" = "True" ] && [ "$SHOW_LOGS" = "True" ]; then
    echo "✅ 配置正确，组件应该显示"
    echo "  - AgentHeartbeat: 应显示"
    echo "  - AgentPnLChart: 应显示"
    echo "  - AgentLogsPanel: 应显示"
else
    echo "❌ 配置问题，组件可能不显示"
    echo "  - 请检查 agents.local.json 中的 flags 字段"
fi

echo ""
echo "🌐 访问地址"
echo "--------------------------------"
echo "前端: http://localhost:5173"
echo "State API: http://localhost:8888/agent_py/state.json"
echo "Agents 配置: http://localhost:8888/deployments/agents.local.json"

echo ""
echo "📋 下一步操作"
echo "--------------------------------"
echo "1. 打开浏览器访问: http://localhost:5173"
echo "2. 按 Ctrl+Shift+R 强制刷新（清除缓存）"
echo "3. 打开浏览器开发者工具（F12）检查控制台"
echo "4. 验证以下组件是否显示："
echo "   - 💚 心跳灯（绿色圆点 + 脉冲动画）"
echo "   - 📈 PnL 图表（折线图）"
echo "   - 🪵 日志面板（可展开）"
echo ""
echo "🔍 实时监控命令："
echo "watch -n 2 \"curl -s http://localhost:8888/agent_py/state.json | grep lastHeartbeat\""
echo ""
