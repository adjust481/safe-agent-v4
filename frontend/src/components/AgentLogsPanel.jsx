import { useState } from 'react';
import { format } from 'date-fns';
import './AgentLogsPanel.css';

function AgentLogsPanel({ logs }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // 根据展开状态显示不同数量的日志
  // 收起时显示最新1条，展开时显示最新30条
  const displayCount = isExpanded ? 30 : 1;
  const visibleLogs = (logs || []).slice(-displayCount).reverse();

  const handleClear = () => {
    setDisplayLogs([]);
  };

  const getLevelColor = (level) => {
    switch (level) {
      case 'INFO':
        return '#00ff99';
      case 'WARN':
        return '#ffaa00';
      case 'ERROR':
        return '#ff4ec9';
      default:
        return '#666';
    }
  };

  const getLevelIcon = (level) => {
    switch (level) {
      case 'INFO':
        return 'ℹ️';
      case 'WARN':
        return '⚠️';
      case 'ERROR':
        return '❌';
      default:
        return '•';
    }
  };

  return (
    <div className="logs-panel-container">
      <div className="logs-header" onClick={() => setIsExpanded(!isExpanded)}>
        <h4>Agent Logs</h4>
        <div className="logs-controls">
          <span className="log-count">{(logs || []).length} entries</span>
          <button
            className="expand-btn"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="logs-content">
          <div className="logs-toolbar">
            <span className="logs-hint">
              {isExpanded ? 'Showing last 30 entries' : 'Showing last 1 entry'}
            </span>
          </div>

          <div className="logs-list">
            {visibleLogs.length === 0 ? (
              <div className="logs-empty">
                <div className="empty-icon">📝</div>
                <div className="empty-text">No logs yet</div>
              </div>
            ) : (
              visibleLogs.map((log, idx) => (
                <div
                  key={idx}
                  className={`log-entry ${log.level.toLowerCase()}`}
                  style={{ borderLeftColor: getLevelColor(log.level) }}
                >
                  <div className="log-header">
                    <span className="log-icon">{getLevelIcon(log.level)}</span>
                    <span
                      className="log-level"
                      style={{ color: getLevelColor(log.level) }}
                    >
                      {log.level}
                    </span>
                    <span className="log-time">
                      {log.ts ? format(new Date(log.ts), 'HH:mm:ss') : 'N/A'}
                    </span>
                  </div>
                  <div className="log-message">{log.msg}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 收起时显示最新1条预览 */}
      {!isExpanded && visibleLogs.length > 0 && (
        <div className="logs-preview">
          {visibleLogs.map((log, idx) => (
            <div
              key={idx}
              className={`log-entry-compact ${log.level.toLowerCase()}`}
              style={{ borderLeftColor: getLevelColor(log.level) }}
            >
              <span className="log-icon">{getLevelIcon(log.level)}</span>
              <span className="log-time-compact">
                {log.ts ? format(new Date(log.ts), 'HH:mm:ss') : 'N/A'}
              </span>
              <span className="log-message-compact">{log.msg}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AgentLogsPanel;
