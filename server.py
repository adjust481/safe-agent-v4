#!/usr/bin/env python3
"""
SafeAgentVault - CORS-enabled HTTP Server
==========================================

用途：
  替代 `python3 -m http.server 8888`，提供支持 CORS 的静态文件服务。
  解决前端 (localhost:5173) 访问后端文件 (localhost:8888) 的跨域问题。

依赖安装：
  pip install flask flask-cors

运行方式：
  cd ~/Desktop/safe-agent-v4
  python3 server.py

访问测试：
  curl -i http://localhost:8888/agent_py/state.json
  curl -i http://localhost:8888/deployments/agents.local.json

预期效果：
  - HTTP 200 响应
  - 包含 Access-Control-Allow-Origin: * header
  - 前端可正常 fetch 数据
"""

from flask import Flask, send_from_directory, jsonify
from flask_cors import CORS
import os
from pathlib import Path

# 初始化 Flask 应用
app = Flask(__name__)

# 启用 CORS，允许所有来源访问
CORS(app, resources={r"/*": {"origins": "*"}})

# 项目根目录
PROJECT_ROOT = Path(__file__).resolve().parent

# 日志：启动时打印项目路径
print(f"📁 项目根目录: {PROJECT_ROOT}")
print(f"🌐 服务地址: http://localhost:8888")
print(f"✅ CORS 已启用: Access-Control-Allow-Origin: *")
print("-" * 60)


@app.route('/agent_py/<path:filename>')
def serve_agent_py(filename):
    """
    提供 agent_py/ 目录下的文件
    例如: /agent_py/state.json
    """
    agent_py_dir = PROJECT_ROOT / 'agent_py'
    print(f"📄 请求文件: /agent_py/{filename}")
    return send_from_directory(agent_py_dir, filename)


@app.route('/deployments/<path:filename>')
def serve_deployments(filename):
    """
    提供 deployments/ 目录下的文件
    例如: /deployments/agents.local.json
    """
    deployments_dir = PROJECT_ROOT / 'deployments'
    print(f"📄 请求文件: /deployments/{filename}")
    return send_from_directory(deployments_dir, filename)


@app.route('/frontend/public/<path:filename>')
def serve_frontend_public(filename):
    """
    提供 frontend/public/ 目录下的文件（可选）
    例如: /frontend/public/deployments/agents.local.json
    """
    frontend_public_dir = PROJECT_ROOT / 'frontend' / 'public'
    print(f"📄 请求文件: /frontend/public/{filename}")
    return send_from_directory(frontend_public_dir, filename)


@app.route('/')
def index():
    """
    根路径：返回服务状态信息
    """
    return jsonify({
        "service": "SafeAgentVault HTTP Server",
        "status": "running",
        "cors": "enabled",
        "endpoints": {
            "agent_state": "http://localhost:8888/agent_py/state.json",
            "agents_config": "http://localhost:8888/deployments/agents.local.json",
            "frontend_public": "http://localhost:8888/frontend/public/..."
        }
    })


@app.route('/health')
def health():
    """
    健康检查端点
    """
    return jsonify({"status": "ok", "cors": "enabled"})


@app.errorhandler(404)
def not_found(error):
    """
    404 错误处理
    """
    return jsonify({
        "error": "File not found",
        "message": "请检查文件路径是否正确"
    }), 404


@app.errorhandler(500)
def internal_error(error):
    """
    500 错误处理
    """
    return jsonify({
        "error": "Internal server error",
        "message": str(error)
    }), 500


if __name__ == '__main__':
    print("\n🚀 启动 SafeAgentVault HTTP Server...")
    print("📋 可用端点:")
    print("   - http://localhost:8888/")
    print("   - http://localhost:8888/agent_py/state.json")
    print("   - http://localhost:8888/deployments/agents.local.json")
    print("   - http://localhost:8888/health")
    print("\n⚠️  按 Ctrl+C 停止服务\n")

    # 启动 Flask 服务
    # debug=False: 生产模式
    # host='0.0.0.0': 允许外部访问（可选，默认 127.0.0.1 仅本地）
    # port=8888: 监听端口
    app.run(host='127.0.0.1', port=8888, debug=False)
