#!/bin/bash
# SafeAgentVault 完整启动脚本
# 用法: ./start-all.sh

set -e

PROJECT_ROOT="$HOME/Desktop/safe-agent-v4"
cd "$PROJECT_ROOT"

echo "🚀 SafeAgentVault 启动脚本"
echo "================================"
echo ""

# 检查依赖
echo "📦 检查前端依赖..."
cd frontend
if ! npm list date-fns recharts &>/dev/null; then
    echo "⚠️  缺少依赖，正在安装..."
    npm install date-fns recharts
else
    echo "✅ 依赖已安装"
fi
cd ..

echo ""
echo "📋 启动说明："
echo "================================"
echo ""
echo "请在 5 个独立终端中依次运行以下命令："
echo ""
echo "Terminal 1 - Hardhat 节点:"
echo "  cd $PROJECT_ROOT"
echo "  npx hardhat node"
echo ""
echo "Terminal 2 - 部署合约:"
echo "  cd $PROJECT_ROOT"
echo "  TMPDIR=~/hh-tmp npx hardhat run scripts/demoAgent.js --network localhost"
echo "  ./sync-frontend.sh"
echo ""
echo "Terminal 3 - Python Agent:"
echo "  cd $PROJECT_ROOT/agent_py"
echo "  source .venv/bin/activate"
echo "  DRY_RUN=1 POLL_INTERVAL=5 python loop_agent.py"
echo ""
echo "Terminal 4 - HTTP 服务器:"
echo "  cd $PROJECT_ROOT"
echo "  python3 -m http.server 8888"
echo ""
echo "Terminal 5 - 前端开发服务器:"
echo "  cd $PROJECT_ROOT/frontend"
echo "  npm run dev"
echo ""
echo "================================"
echo ""
echo "🔍 验证命令（在新终端运行）："
echo "  watch -n 2 \"curl -s http://localhost:8888/agent_py/state.json | grep lastHeartbeat\""
echo ""
echo "🌐 浏览器访问："
echo "  http://localhost:5173"
echo ""
echo "✅ 预期效果："
echo "  💚 心跳灯显示绿色 + 脉冲动画"
echo "  📈 PnL 图表渲染（X轴显示 HH:mm:ss）"
echo "  🪵 日志面板可展开（默认显示1条，展开显示30条）"
echo "  🎨 两栏布局，无空白区域"
echo ""
