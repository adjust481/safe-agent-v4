/**
 * AgentSidebar.jsx
 *
 * Sidebar component displaying list of agents
 * - Shows ENS name and address for each agent
 * - Highlights selected agent
 * - Cyberpunk/Neon styling
 */

import { short } from './lib/format';
import './AgentSidebar.css';

function AgentSidebar({ agents, selectedAgent, onSelectAgent, loading }) {
  if (loading) {
    return (
      <div className="agent-sidebar">
        <div className="sidebar-header">
          <h2>🤖 Agents</h2>
        </div>
        <div className="sidebar-loading">
          <div className="loading-spinner"></div>
          <div>Loading agents...</div>
        </div>
      </div>
    );
  }

  if (!agents || agents.length === 0) {
    return (
      <div className="agent-sidebar">
        <div className="sidebar-header">
          <h2>🤖 Agents</h2>
        </div>
        <div className="sidebar-empty">
          <div>No agents configured</div>
          <div className="hint">Add agents to deployments/agents.local.json</div>
        </div>
      </div>
    );
  }

  return (
    <div className="agent-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title-section">
          <h2>🔐 Agent Vault</h2>
          <div className="sidebar-subtitle">Permission Console</div>
        </div>
        <div className="agent-count">{agents.length}</div>
      </div>

      <div className="agent-list">
        {agents.map((agent) => {
          const isSelected = selectedAgent?.address?.toLowerCase() === agent.address?.toLowerCase();
          const isActive = agent.active;
          const runtimeStatus = agent.runtime?.status || 'unknown';

          // 状态颜色映射
          const statusColors = {
            online: '#10b981',
            offline: '#6b7280',
            error: '#ef4444',
            warning: '#f59e0b',
            unknown: '#6b7280'
          };

          return (
            <div
              key={agent.address}
              className={`agent-item ${isSelected ? 'selected' : ''} ${isActive ? 'active' : 'inactive'}`}
              onClick={() => onSelectAgent(agent)}
              style={{ borderLeftColor: isActive ? agent.ui?.color || '#8b5cf6' : '#4b5563' }}
            >
              {/* Runtime 状态指示灯 */}
              <div
                className={`runtime-status-indicator ${runtimeStatus}`}
                style={{ backgroundColor: statusColors[runtimeStatus] }}
                title={`Runtime: ${runtimeStatus}`}
              />

              {/* 风险等级指示器 */}
              <div
                className={`risk-indicator ${agent.riskLevel}`}
                title={`Risk: ${agent.riskLevel}`}
              />

              <div className="agent-item-header">
                <div className="agent-icon">{agent.ui?.icon || '🤖'}</div>
                <div className="agent-info">
                  <div className="agent-name">{agent.name}</div>
                  <a
                    href={`https://app.ens.domains/${agent.ensName}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="agent-ens"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {agent.ensName} ↗
                  </a>
                </div>
              </div>

              <div className="agent-meta">
                <span
                  className="strategy-badge"
                  style={{
                    backgroundColor: `${agent.ui?.color || '#8b5cf6'}20`,
                    color: agent.ui?.color || '#8b5cf6',
                    borderColor: agent.ui?.color || '#8b5cf6'
                  }}
                >
                  {agent.strategy}
                </span>
                <span className="version-badge">v{agent.version}</span>
              </div>

              {/* Enabled Status and Cap */}
              <div className="agent-config-row">
                <span className={`enabled-badge ${agent.enabled ? 'enabled' : 'disabled'}`}>
                  {agent.enabled ? '✓ Enabled' : '✗ Disabled'}
                </span>
                <span className="cap-badge">
                  Cap: {agent.config?.cap || '100'}
                </span>
              </div>

              <div className="agent-address">{short(agent.address)}</div>

              {/* Tags */}
              {agent.tags && agent.tags.length > 0 && (
                <div className="agent-tags">
                  {agent.tags.slice(0, 2).map((tag, idx) => (
                    <span key={idx} className="tag">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="sidebar-footer">
        <div className="footer-hint">
          Click an agent to view details
        </div>
      </div>
    </div>
  );
}

export default AgentSidebar;
