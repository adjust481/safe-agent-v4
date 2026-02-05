/**
 * PythonAgentStatusCard.jsx
 *
 * Python Agent 运行状态卡片
 * - 每 3 秒轮询 agent/state.json
 * - 显示决策、最近交易、运行统计
 * - Cyberpunk 风格
 */

import { useState, useEffect } from 'react';
import { fmt18, short } from './lib/format';
import './PythonAgentStatusCard.css';

function PythonAgentStatusCard() {
  const [agentState, setAgentState] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);
  const [signalExpanded, setSignalExpanded] = useState(false);

  // 获取 agent 状态
  const fetchAgentState = async () => {
    try {
      // 从环境变量读取 URL，如果没有则使用默认值
      const stateUrl = import.meta.env.VITE_AGENT_STATE_URL || 'http://localhost:8888/agent_py/state.json';
      const response = await fetch(stateUrl);

      if (!response.ok) {
        // Read response as text to avoid JSON parse errors on HTML error pages
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text.substring(0, 100)}`);
      }

      // Verify content-type is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Expected JSON but got ${contentType}: ${text.substring(0, 100)}`);
      }

      const data = await response.json();
      setAgentState(data);
      setIsOnline(data.status === 'running');
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      console.error('Failed to fetch agent state:', err);
      setIsOnline(false);
      setError(err.message);
    }
  };

  // 轮询
  useEffect(() => {
    fetchAgentState(); // 立即执行一次

    const interval = setInterval(fetchAgentState, 3000); // 每 3 秒

    return () => clearInterval(interval);
  }, []);

  // 格式化时间
  const formatTime = (isoString) => {
    if (!isoString) return 'N/A';
    try {
      return new Date(isoString).toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return 'Invalid';
    }
  };

  // 格式化相对时间
  const formatRelativeTime = (isoString) => {
    if (!isoString) return null;
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now - date;
      const diffSec = Math.floor(diffMs / 1000);

      if (diffSec < 60) return `${diffSec}s ago`;
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      return `${Math.floor(diffSec / 3600)}h ago`;
    } catch {
      return null;
    }
  };

  // Offline 状态
  if (!isOnline || !agentState) {
    return (
      <div className="python-agent-card offline">
        <h2>🤖 Python Agent</h2>
        <div className="status-badge offline">
          <span className="status-dot"></span>
          Agent Offline
        </div>
        {error && (
          <div className="error-message">
            Error: {error}
          </div>
        )}
        <div className="hint">
          Start agent: <code>python agent/loop.py</code>
        </div>
      </div>
    );
  }

  const { agent, decision, last_trade, snapshot, loop_count, total_trades, last_error } = agentState;

  return (
    <div className="python-agent-card online">
      <div className="card-header">
        <h2>🤖 Python Agent</h2>
        <div className="status-badge online">
          <span className="status-dot pulse"></span>
          Running
        </div>
      </div>

      {/* Agent 信息 */}
      <div className="agent-info">
        <div className="agent-name">{agent?.ensName || 'Unknown Agent'}</div>
        <div className="agent-address">{short(agent?.address)}</div>
        <div className="agent-strategy">
          <span className="strategy-label">Strategy:</span>
          <span className={`strategy-badge ${agent?.strategy || 'unknown'}`}>
            {agent?.strategy || 'unknown'}
          </span>
        </div>
      </div>

      {/* 运行统计 */}
      <div className="stats-row">
        <div className="stat-item">
          <div className="stat-label">Loops</div>
          <div className="stat-value">{loop_count || 0}</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Trades</div>
          <div className="stat-value">{total_trades || 0}</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Updated</div>
          <div className="stat-value">{formatTime(agentState.last_update)}</div>
        </div>
      </div>

      {/* 当前决策 */}
      <div className="decision-section">
        <div className="section-title">Last Decision</div>
        <div className={`decision-badge ${decision?.action?.toLowerCase()}`}>
          {decision?.action || 'UNKNOWN'}
        </div>
        <div className="decision-reason">{decision?.reason || 'No reason'}</div>

        {decision?.action === 'TRADE' && decision?.amount_in && (
          <div className="trade-params">
            <div className="param">
              <span className="param-label">Amount In:</span>
              <span className="param-value">{fmt18(decision.amount_in)}</span>
            </div>
            <div className="param">
              <span className="param-label">Min Out:</span>
              <span className="param-value">{fmt18(decision.min_amount_out)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Signal 数据 */}
      {agentState.intent?.meta?.signal && (
        <div className="signal-section">
          <div
            className="section-title clickable"
            onClick={() => setSignalExpanded(!signalExpanded)}
            style={{ cursor: 'pointer', userSelect: 'none' }}
          >
            📊 Market Signal {signalExpanded ? '▼' : '▶'}
          </div>
          {signalExpanded && (
            <div className="signal-content">
              <pre className="signal-json">
                {JSON.stringify(agentState.intent.meta.signal, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* 最近交易 */}
      {last_trade && (
        <div className="last-trade-section">
          <div className="section-title">Last Trade</div>
          <div className="trade-info">
            <div className="trade-row">
              <span className="trade-label">TX Hash:</span>
              <code className="trade-value">{short(last_trade.tx_hash)}</code>
            </div>
            <div className="trade-row">
              <span className="trade-label">Block:</span>
              <span className="trade-value">#{last_trade.block_number}</span>
            </div>
            <div className="trade-row">
              <span className="trade-label">Gas Used:</span>
              <span className="trade-value">{last_trade.gas_used?.toLocaleString()}</span>
            </div>
            {last_trade.event && (
              <>
                <div className="trade-row">
                  <span className="trade-label">Amount In:</span>
                  <span className="trade-value highlight">{fmt18(last_trade.event.amountIn)}</span>
                </div>
                <div className="trade-row">
                  <span className="trade-label">Amount Out:</span>
                  <span className="trade-value highlight">{fmt18(last_trade.event.amountOut)}</span>
                </div>
              </>
            )}
            <div className="trade-time">
              {formatRelativeTime(last_trade.timestamp)}
            </div>
          </div>
        </div>
      )}

      {/* 余额快照 */}
      {snapshot && (
        <div className="balance-section">
          <div className="section-title">Balance Snapshot</div>
          <div className="balance-grid">
            <div className="balance-item">
              <div className="balance-label">Sub-balance</div>
              <div className="balance-value">{fmt18(snapshot.agent_sub_balance)}</div>
            </div>
            <div className="balance-item">
              <div className="balance-label">Spent</div>
              <div className="balance-value">{fmt18(snapshot.agent_spent)}</div>
            </div>
          </div>
        </div>
      )}

      {/* 错误信息 */}
      {last_error && (
        <div className="error-section">
          <div className="section-title">Last Error</div>
          <div className="error-content">
            {last_error.message}
          </div>
          <div className="error-time">
            {formatRelativeTime(last_error.timestamp)}
          </div>
        </div>
      )}

      {/* 更新时间指示器 */}
      {lastUpdate && (
        <div className="update-indicator">
          Last fetched: {lastUpdate.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

export default PythonAgentStatusCard;
