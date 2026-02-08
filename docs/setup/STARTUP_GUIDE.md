# SafeAgentVault - 更新后的启动指南

## 🔧 重要变更：Terminal 4 启动方式已更新

### ❌ 旧方式（已弃用）
```bash
cd ~/Desktop/safe-agent-v4
python3 -m http.server 8888
```
**问题**：不支持 CORS，导致前端跨域错误

### ✅ 新方式（推荐）
```bash
cd ~/Desktop/safe-agent-v4
python3 server.py
```
**优势**：
- ✅ 支持 CORS（Access-Control-Allow-Origin: *）
- ✅ 解决前端跨域问题
- ✅ 提供健康检查端点
- ✅ 更好的错误处理

---

## 🚀 完整启动流程（5个终端）

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

### Terminal 4: HTTP 服务器（⚠️ 已更新）
```bash
cd ~/Desktop/safe-agent-v4
python3 server.py
```

**预期输出**：
```
📁 项目根目录: /Users/adjust/Desktop/safe-agent-v4
🌐 服务地址: http://localhost:8888
✅ CORS 已启用: Access-Control-Allow-Origin: *
------------------------------------------------------------

🚀 启动 SafeAgentVault HTTP Server...
📋 可用端点:
   - http://localhost:8888/
   - http://localhost:8888/agent_py/state.json
   - http://localhost:8888/deployments/agents.local.json
   - http://localhost:8888/health

⚠️  按 Ctrl+C 停止服务

 * Serving Flask app 'server'
 * Running on http://127.0.0.1:8888
```

### Terminal 5: 前端
```bash
cd ~/Desktop/safe-agent-v4/frontend
npm run dev
```

---

## ✅ 验证 CORS 是否生效

### 方法 1: 使用 curl 检查 headers
```bash
curl -i http://localhost:8888/agent_py/state.json
```

**预期输出**（包含 CORS header）：
```
HTTP/1.1 200 OK
Server: Werkzeug/3.1.5 Python/3.13.2
Date: Mon, 03 Feb 2026 14:00:00 GMT
Content-Type: application/json
Access-Control-Allow-Origin: *    ← 关键！
Content-Length: 1234

{"runtime": {...}, "pnlHistory": [...], "logs": [...]}
```

### 方法 2: 浏览器控制台测试
打开 http://localhost:5173，按 F12 打开控制台，运行：

```javascript
fetch('http://localhost:8888/agent_py/state.json')
  .then(r => r.json())
  .then(d => console.log('✅ CORS 正常:', d))
  .catch(e => console.error('❌ CORS 错误:', e))
```

**预期结果**：
- ✅ 控制台输出：`✅ CORS 正常: {runtime: {...}, ...}`
- ❌ 如果仍有错误，检查 Terminal 4 是否使用了新的 `server.py`

### 方法 3: 检查健康状态
```bash
curl http://localhost:8888/health
```

**预期输出**：
```json
{"status": "ok", "cors": "enabled"}
```

---

## 🔍 故障排查

### 问题 1: 仍然出现 CORS 错误
**原因**：Terminal 4 可能仍在使用旧的 `http.server`

**解决**：
1. 在 Terminal 4 按 `Ctrl+C` 停止旧服务
2. 确认进程已停止：`lsof -i :8888`
3. 如果有残留进程：`kill -9 <PID>`
4. 重新启动：`python3 server.py`

### 问题 2: ModuleNotFoundError: No module named 'flask'
**原因**：依赖未安装

**解决**：
```bash
pip3 install flask flask-cors
```

### 问题 3: Address already in use
**原因**：端口 8888 被占用

**解决**：
```bash
# 查找占用进程
lsof -i :8888

# 杀死进程
kill -9 <PID>

# 重新启动
python3 server.py
```

### 问题 4: 404 Not Found
**原因**：文件路径不正确

**解决**：
```bash
# 检查文件是否存在
ls -la ~/Desktop/safe-agent-v4/agent_py/state.json
ls -la ~/Desktop/safe-agent-v4/deployments/agents.local.json

# 检查 server.py 是否在正确目录
cd ~/Desktop/safe-agent-v4
pwd  # 应输出: /Users/adjust/Desktop/safe-agent-v4
```

---

## 📊 可用端点

| 端点 | 用途 | 示例 |
|------|------|------|
| `/` | 服务状态 | `curl http://localhost:8888/` |
| `/health` | 健康检查 | `curl http://localhost:8888/health` |
| `/agent_py/state.json` | Agent 运行时状态 | `curl http://localhost:8888/agent_py/state.json` |
| `/deployments/agents.local.json` | Agent 配置 | `curl http://localhost:8888/deployments/agents.local.json` |

---

## 🎉 成功标志

当所有服务正常运行时：

1. ✅ Terminal 4 显示 Flask 服务器启动信息
2. ✅ `curl -i http://localhost:8888/agent_py/state.json` 返回包含 `Access-Control-Allow-Origin: *` 的响应
3. ✅ 浏览器控制台没有 CORS 错误
4. ✅ 前端页面正常显示心跳灯、PnL 图表、日志面板

---

## 📝 依赖信息

**已安装的 Python 包**：
- flask==3.1.2
- flask-cors==6.0.2
- werkzeug==3.1.5
- itsdangerous==2.2.0

**安装命令**（如需重新安装）：
```bash
pip3 install flask flask-cors
```

---

## 🔄 从旧方式迁移

如果你之前使用 `python3 -m http.server 8888`：

1. **停止旧服务**：在 Terminal 4 按 `Ctrl+C`
2. **启动新服务**：`python3 server.py`
3. **刷新浏览器**：按 `Cmd+Shift+R`（Mac）或 `Ctrl+Shift+R`（Windows/Linux）
4. **验证 CORS**：检查浏览器控制台是否还有跨域错误

---

## 💡 提示

- `server.py` 会在每次请求时打印日志，方便调试
- 如需修改端口，编辑 `server.py` 最后一行的 `port=8888`
- 如需允许外部访问，将 `host='127.0.0.1'` 改为 `host='0.0.0.0'`
- 生产环境建议使用 gunicorn 或 uwsgi 部署

---

## 📚 相关文档

- Flask 官方文档: https://flask.palletsprojects.com/
- Flask-CORS 文档: https://flask-cors.readthedocs.io/
- CORS 详解: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
