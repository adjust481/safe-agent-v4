#!/bin/bash
# 快速验证脚本 - 检查所有服务是否正常运行

echo "🔍 SafeAgentVault 服务状态检查"
echo "================================"
echo ""

# 检查 Hardhat 节点
echo -n "1. Hardhat 节点 (8545): "
if curl -s http://localhost:8545 &>/dev/null; then
    echo "✅ 运行中"
else
    echo "❌ 未运行"
fi

# 检查 HTTP 服务器
echo -n "2. HTTP 服务器 (8888): "
if curl -s http://localhost:8888 &>/dev/null; then
    echo "✅ 运行中"
else
    echo "❌ 未运行"
fi

# 检查 state.json
echo -n "3. Agent state.json: "
if curl -s http://localhost:8888/agent_py/state.json &>/dev/null; then
    echo "✅ 可访问"

    # 检查心跳时间
    HEARTBEAT=$(curl -s http://localhost:8888/agent_py/state.json | grep -o '"lastHeartbeat":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$HEARTBEAT" ]; then
        echo "   └─ 最新心跳: $HEARTBEAT"
    fi

    # 检查日志数量
    LOG_COUNT=$(curl -s http://localhost:8888/agent_py/state.json | grep -o '"logs":\[' | wc -l)
    if [ "$LOG_COUNT" -gt 0 ]; then
        echo "   └─ 日志系统: ✅ 正常"
    fi

    # 检查 PnL 历史
    PNL_COUNT=$(curl -s http://localhost:8888/agent_py/state.json | grep -o '"pnlHistory":\[' | wc -l)
    if [ "$PNL_COUNT" -gt 0 ]; then
        echo "   └─ PnL 历史: ✅ 正常"
    fi
else
    echo "❌ 无法访问"
fi

# 检查前端
echo -n "4. 前端服务 (5173): "
if curl -s http://localhost:5173 &>/dev/null; then
    echo "✅ 运行中"
else
    echo "❌ 未运行"
fi

echo ""
echo "================================"
echo ""

# 检查 Python Agent 进程
echo "5. Python Agent 进程:"
if pgrep -f "loop_agent.py" &>/dev/null; then
    echo "   ✅ 运行中 (PID: $(pgrep -f loop_agent.py))"
else
    echo "   ❌ 未运行"
fi

echo ""
echo "🌐 访问地址:"
echo "   前端: http://localhost:5173"
echo "   State: http://localhost:8888/agent_py/state.json"
echo ""
echo "📊 实时监控命令:"
echo "   watch -n 2 \"curl -s http://localhost:8888/agent_py/state.json | jq '.runtime'\""
echo ""
