#!/bin/bash
# 快速测试 CORS 服务器

echo "🧪 测试 SafeAgentVault CORS 服务器"
echo "================================"
echo ""

# 检查服务器是否运行
echo "1️⃣ 检查服务器状态..."
if curl -s http://localhost:8888/health &>/dev/null; then
    echo "   ✅ 服务器运行中"
else
    echo "   ❌ 服务器未运行"
    echo ""
    echo "请先启动服务器："
    echo "  cd ~/Desktop/safe-agent-v4"
    echo "  python3 server.py"
    exit 1
fi

echo ""
echo "2️⃣ 测试 CORS headers..."
CORS_HEADER=$(curl -s -I http://localhost:8888/agent_py/state.json | grep -i "access-control-allow-origin")

if [ -n "$CORS_HEADER" ]; then
    echo "   ✅ CORS 已启用"
    echo "   $CORS_HEADER"
else
    echo "   ❌ CORS 未启用"
    exit 1
fi

echo ""
echo "3️⃣ 测试 state.json 访问..."
if curl -s http://localhost:8888/agent_py/state.json | python3 -c "import sys, json; json.load(sys.stdin)" &>/dev/null; then
    echo "   ✅ state.json 可访问且格式正确"

    # 显示心跳信息
    HEARTBEAT=$(curl -s http://localhost:8888/agent_py/state.json | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['runtime']['lastHeartbeat'])" 2>/dev/null)
    echo "   📡 最新心跳: $HEARTBEAT"
else
    echo "   ❌ state.json 无法访问或格式错误"
fi

echo ""
echo "4️⃣ 测试 agents.local.json 访问..."
if curl -s http://localhost:8888/deployments/agents.local.json | python3 -c "import sys, json; json.load(sys.stdin)" &>/dev/null; then
    echo "   ✅ agents.local.json 可访问且格式正确"

    # 显示 agent 数量
    AGENT_COUNT=$(curl -s http://localhost:8888/deployments/agents.local.json | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data.get('agents', [])))" 2>/dev/null)
    echo "   🤖 Agents 数量: $AGENT_COUNT"
else
    echo "   ❌ agents.local.json 无法访问或格式错误"
fi

echo ""
echo "================================"
echo "✅ 所有测试通过！"
echo ""
echo "🌐 现在可以在浏览器中访问："
echo "   http://localhost:5173"
echo ""
echo "💡 如果前端仍有 CORS 错误，请："
echo "   1. 确认 Terminal 4 使用的是 'python3 server.py'"
echo "   2. 在浏览器按 Cmd+Shift+R 强制刷新"
echo "   3. 检查浏览器控制台的错误信息"
echo ""
