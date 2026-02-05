#!/bin/bash
# 一键自检脚本：检查 state.json 是否正确且可被前端访问

set -e

cd "$(dirname "$0")"

echo "=== State.json 自检 ==="
echo ""

# 1. 检查文件是否存在
echo "1. 检查 agent_py/state.json 是否存在..."
if [ -f "agent_py/state.json" ]; then
    echo "   ✓ 文件存在"
else
    echo "   ✗ 文件不存在"
    exit 1
fi

# 2. 检查是否是合法 JSON
echo ""
echo "2. 检查 JSON 格式是否合法..."
if python3 -m json.tool agent_py/state.json > /dev/null 2>&1; then
    echo "   ✓ JSON 格式合法"
else
    echo "   ✗ JSON 格式错误"
    echo "   错误详情："
    python3 -m json.tool agent_py/state.json 2>&1 | head -5
    exit 1
fi

# 3. 显示关键字段
echo ""
echo "3. 显示关键字段..."
python3 -c "
import json
with open('agent_py/state.json') as f:
    state = json.load(f)
print(f\"   status: {state.get('status')}\")
print(f\"   loop_count: {state.get('loop_count')}\")
print(f\"   total_trades: {state.get('total_trades')}\")
print(f\"   strategy: {state.get('agent', {}).get('strategy')}\")
print(f\"   decision: {state.get('decision', {}).get('action')} - {state.get('decision', {}).get('reason')}\")
if 'last_error' in state:
    print(f\"   ⚠ last_error: {state['last_error'].get('message', '')[:80]}\")
"

# 4. 检查 HTTP 服务器
echo ""
echo "4. 检查 HTTP 服务器 (localhost:8888)..."
if lsof -i :8888 > /dev/null 2>&1; then
    echo "   ✓ 端口 8888 有进程监听"

    # 尝试 curl
    echo ""
    echo "5. 测试 HTTP 访问..."
    if curl -s -f http://localhost:8888/agent_py/state.json > /dev/null 2>&1; then
        echo "   ✓ HTTP 访问成功"

        # 检查返回的是否是 JSON
        CONTENT_TYPE=$(curl -s -I http://localhost:8888/agent_py/state.json | grep -i "content-type" | tr -d '\r')
        echo "   Content-Type: $CONTENT_TYPE"

        if echo "$CONTENT_TYPE" | grep -q "application/json"; then
            echo "   ✓ Content-Type 正确"
        else
            echo "   ⚠ Content-Type 不是 application/json (可能导致前端解析问题)"
        fi

        # 验证返回的内容是合法 JSON
        if curl -s http://localhost:8888/agent_py/state.json | python3 -m json.tool > /dev/null 2>&1; then
            echo "   ✓ HTTP 返回的内容是合法 JSON"
        else
            echo "   ✗ HTTP 返回的内容不是合法 JSON"
            echo "   返回内容前 200 字符："
            curl -s http://localhost:8888/agent_py/state.json | head -c 200
            exit 1
        fi
    else
        echo "   ✗ HTTP 访问失败 (404?)"
        echo "   请确保 HTTP 服务器在项目根目录启动："
        echo "   cd ~/Desktop/safe-agent-v4 && python3 server.py"
        exit 1
    fi
else
    echo "   ⚠ 端口 8888 没有进程监听"
    echo "   请启动 HTTP 服务器："
    echo "   cd ~/Desktop/safe-agent-v4 && python3 server.py"
fi

echo ""
echo "✅ 所有检查通过！"
echo ""
echo "前端可以通过以下 URL 访问："
echo "  http://localhost:8888/agent_py/state.json"
