#!/bin/bash
# 快速验证前端更新

set -e

cd "$(dirname "$0")"

echo "=== 前端更新验证 ==="
echo ""

# 1. 检查修改的文件是否存在
echo "1. 检查修改的文件..."
files=(
  "frontend/src/hooks/useAgentRuntime.js"
  "frontend/src/PythonAgentStatusCard.jsx"
  "frontend/src/PythonAgentStatusCard.css"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "   ✓ $file"
  else
    echo "   ✗ $file 不存在"
    exit 1
  fi
done

# 2. 检查 state.json 格式
echo ""
echo "2. 检查 state.json 格式..."
if [ -f "agent_py/state.json" ]; then
  echo "   ✓ state.json 存在"

  # 检查关键字段
  python3 -c "
import json
with open('agent_py/state.json') as f:
    state = json.load(f)

required_fields = ['status', 'last_update', 'agent', 'decision']
for field in required_fields:
    if field in state:
        print(f'   ✓ {field}: {state[field] if field != \"agent\" else state[field].get(\"strategy\")}')
    else:
        print(f'   ✗ {field} 缺失')
        exit(1)

# 检查 intent.meta.signal
if 'intent' in state and 'meta' in state['intent'] and 'signal' in state['intent']['meta']:
    print(f'   ✓ intent.meta.signal 存在')
else:
    print(f'   ⚠ intent.meta.signal 不存在 (可能是 HOLD 决策)')
"
else
  echo "   ✗ state.json 不存在"
  exit 1
fi

# 3. 检查 HTTP 服务器
echo ""
echo "3. 检查 HTTP 服务器..."
if lsof -i :8888 > /dev/null 2>&1; then
  echo "   ✓ HTTP 服务器运行中 (port 8888)"

  # 测试 HTTP 访问
  if curl -s -f http://localhost:8888/agent_py/state.json > /dev/null 2>&1; then
    echo "   ✓ state.json 可通过 HTTP 访问"

    # 检查 Content-Type
    CONTENT_TYPE=$(curl -s -I http://localhost:8888/agent_py/state.json | grep -i "content-type" | tr -d '\r')
    echo "   Content-Type: $CONTENT_TYPE"
  else
    echo "   ✗ HTTP 访问失败"
    exit 1
  fi
else
  echo "   ✗ HTTP 服务器未运行"
  echo "   启动命令: cd ~/Desktop/safe-agent-v4 && python3 server.py"
  exit 1
fi

# 4. 检查前端服务器
echo ""
echo "4. 检查前端服务器..."
if lsof -i :5173 > /dev/null 2>&1; then
  echo "   ✓ Vite 运行中 (port 5173)"
  echo "   访问: http://localhost:5173"
else
  echo "   ✗ Vite 未运行"
  echo "   启动命令: cd ~/Desktop/safe-agent-v4/frontend && npm run dev"
fi

# 5. 检查 agent 进程
echo ""
echo "5. 检查 agent 进程..."
if ps aux | grep "loop_agent.py" | grep -v grep > /dev/null 2>&1; then
  echo "   ✓ Agent 运行中"
  ps aux | grep "loop_agent.py" | grep -v grep | awk '{print "   PID:", $2, "CMD:", $11, $12, $13}'
else
  echo "   ⚠ Agent 未运行"
  echo "   启动命令: cd ~/Desktop/safe-agent-v4/agent_py && source .venv/bin/activate && DRY_RUN=1 POLL_INTERVAL=5 python loop_agent.py"
fi

echo ""
echo "✅ 验证完成！"
echo ""
echo "=== 页面上应该看到的新增字段 ==="
echo ""
echo "1. Python Agent Status Card:"
echo "   - Strategy Badge: [sniper] / [arb] / [hold] (霓虹边框)"
echo "   - Last Decision: HOLD / SWAP / ERROR + reason"
echo "   - Market Signal: 可折叠的 JSON 显示 (点击 📊 Market Signal ▶)"
echo ""
echo "2. Agent Detail View:"
echo "   - Header Meta: Strategy: sniper"
echo "   - Configuration Card: Strategy: sniper"
echo ""
echo "3. Agent Sidebar:"
echo "   - Strategy Badge: sniper / arb / hold"
echo ""
echo "打开浏览器访问: http://localhost:5173"
