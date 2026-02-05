/**
 * AgentDetailView.jsx
 *
 * Detail view component for selected agent
 * - Shows agent balances, config, and route info
 * - Displays ENS name and address at top
 * - Cyberpunk/Neon styling with cards
 */

import { useState, useEffect } from 'react';
import { fmt18, short } from './lib/format';
import { ethers } from 'ethers';
import { getEnsName } from './AgentConfigForm';
import { useAgentRuntime } from './hooks/useAgentRuntime';
import AgentHeartbeat from './components/AgentHeartbeat';
import AgentPnLChart from './components/AgentPnLChart';
import AgentLogsPanel from './components/AgentLogsPanel';
import PendingApprovalCard from './components/PendingApprovalCard';
import './AgentDetailView.css';

// Safe namehash helper
function safeNamehash(name) {
  try {
    return ethers.namehash(name);
  } catch {
    return null;
  }
}

function AgentDetailView({ agent, agentData, loading, error, deployment, vault }) {
  // Fetch Python agent runtime state (2-second polling)
  const { data: runtimeState, offline } = useAgentRuntime(2000);

  // Local state for agent controls
  const [localEnabled, setLocalEnabled] = useState(agent?.enabled ?? true);
  const [localCap, setLocalCap] = useState(agent?.config?.cap || '100');
  const [capInput, setCapInput] = useState(localCap);
  const [saveStatus, setSaveStatus] = useState(null);
  const [approveLoading, setApproveLoading] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    if (agent?.address) {
      const stored = localStorage.getItem(`agent_config_${agent.address}`);
      if (stored) {
        try {
          const config = JSON.parse(stored);
          setLocalEnabled(config.enabled ?? agent.enabled);
          setLocalCap(config.cap || agent.config?.cap || '100');
          setCapInput(config.cap || agent.config?.cap || '100');
        } catch (e) {
          console.error('Failed to parse stored config:', e);
        }
      } else {
        setLocalEnabled(agent.enabled ?? true);
        setLocalCap(agent.config?.cap || '100');
        setCapInput(agent.config?.cap || '100');
      }
    }
  }, [agent]);

  // Toggle enabled state
  const handleToggleEnabled = () => {
    const newEnabled = !localEnabled;
    setLocalEnabled(newEnabled);

    // Save to localStorage
    const config = { enabled: newEnabled, cap: localCap };
    localStorage.setItem(`agent_config_${agent.address}`, JSON.stringify(config));

    // Show save status
    setSaveStatus('Saved to localStorage (edit agents.local.json to persist)');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  // Save cap
  const handleSaveCap = () => {
    setLocalCap(capInput);

    // Save to localStorage
    const config = { enabled: localEnabled, cap: capInput };
    localStorage.setItem(`agent_config_${agent.address}`, JSON.stringify(config));

    // Show save status
    setSaveStatus('Saved to localStorage (edit agents.local.json to persist)');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  // Approve and execute pending request
  const handleApproveAndExecute = async () => {
    if (!vault) {
      alert('Vault contract not available');
      return;
    }

    setApproveLoading(true);
    try {
      const tx = await vault.approveAndExecute();
      console.log('Transaction sent:', tx.hash);

      // Wait for confirmation
      await tx.wait();
      console.log('Transaction confirmed');

      alert('Execution approved! Agent has been automatically disabled.');
    } catch (err) {
      console.error('Failed to approve execution:', err);
      alert(`Failed to approve: ${err.message || err}`);
    } finally {
      setApproveLoading(false);
    }
  };

  if (!agent) {
    return (
      <div className="agent-detail-view">
        <div className="detail-empty">
          <div className="empty-icon">🤖</div>
          <div className="empty-title">No Agent Selected</div>
          <div className="empty-hint">Select an agent from the sidebar to view details</div>
        </div>
      </div>
    );
  }

  if (loading && !agentData) {
    return (
      <div className="agent-detail-view">
        <div className="detail-loading">
          <div className="loading-spinner"></div>
          <div>Loading agent data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="agent-detail-view">
        <div className="detail-error">
          <div className="error-icon">⚠️</div>
          <div className="error-title">Failed to Load Agent Data</div>
          <div className="error-message">{error}</div>
        </div>
      </div>
    );
  }

  // ENS verification
  const cachedEnsName = getEnsName(agent.address);
  const ensName = cachedEnsName || agent.ensName || null;
  const ensNodeFromChain = agentData?.agentConfig?.ensNode;
  const expectedNode = ensName ? safeNamehash(ensName) : null;
  const ensOk = expectedNode &&
                ensNodeFromChain &&
                expectedNode.toLowerCase() === ensNodeFromChain.toLowerCase();

  return (
    <div className="agent-detail-view">
      {/* Runtime Identity Card - Python Agent State */}
      {runtimeState && runtimeState.agent && (
        <div className="runtime-identity-card">
          <div className="identity-header">
            <div className="identity-icon">🔐</div>
            <div className="identity-title">Agent Identity</div>
          </div>
          <div className="identity-content">
            <div className="identity-row">
              <span className="identity-label">ENS Name:</span>
              <span className="identity-value ens-name">
                {runtimeState.agent.ensName || "Not Set"}
              </span>
            </div>
            <div className="identity-row">
              <span className="identity-label">Address:</span>
              <span className="identity-value address-value">
                {runtimeState.agent.address || agent.address}
              </span>
            </div>
            <div className="identity-row">
              <span className="identity-label">Verification:</span>
              <span className={`identity-value verification-badge ${runtimeState.ensVerified ? 'verified' : 'unverified'}`}>
                {runtimeState.ensVerified ? '✅ ENS Verified' : '⚠️ Not Verified'}
              </span>
            </div>
            {runtimeState.last_update && (
              <div className="identity-row">
                <span className="identity-label">Last Update:</span>
                <span className="identity-value timestamp">
                  {new Date(runtimeState.last_update).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pending Approval Card */}
      <PendingApprovalCard
        pendingRequest={agentData?.pendingRequest}
        agent={agent}
        onApprove={handleApproveAndExecute}
        loading={approveLoading}
      />

      {/* Agent Header - On-Chain Data */}
      <div className="detail-header">
        <div className="header-content">
          <div className="header-ens">
            {ensOk ? ensName : (ensName || "Unknown ENS")}
          </div>
          <div className="header-address">{agent.address}</div>
          <div className="header-meta">
            <div className={`header-status ${agent.enabled ? 'enabled' : 'disabled'}`}>
              <span className="status-dot"></span>
              {agent.enabled ? 'Enabled' : 'Disabled'}
            </div>
            <div className="header-strategy">{agent.strategy}</div>
            {ensOk && (
              <div className="header-ens-verified">
                ✅ ENS Verified
              </div>
            )}
            {!ensOk && ensName && (
              <div className="header-ens-warning">
                ⚠️ ENS Mismatch
              </div>
            )}
          </div>
          {agent.label && (
            <div className="header-label">{agent.label}</div>
          )}
        </div>
        {agentData?.lastUpdate && (
          <div className="header-update">
            Last updated: {agentData.lastUpdate.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Detail Cards Grid */}
      <div className="detail-grid">
        {/* Balances Card */}
        <div className="detail-card">
          <h3>💰 Balances</h3>
          <div className="card-content">
            <div className="balance-row">
              <span className="balance-label">User Main:</span>
              <span className="balance-value">{fmt18(agentData?.userBalance)}</span>
            </div>
            <div className="balance-row">
              <span className="balance-label">Agent Sub:</span>
              <span className="balance-value highlight">{fmt18(agentData?.agentSubBalance)}</span>
            </div>
            <div className="balance-row">
              <span className="balance-label">Agent Spent:</span>
              <span className="balance-value spent">{fmt18(agentData?.agentSpentAmount)}</span>
            </div>
            <div className="balance-row">
              <span className="balance-label">Available:</span>
              <span className="balance-value available">
                {fmt18((agentData?.agentSubBalance || 0n) - (agentData?.agentSpentAmount || 0n))}
              </span>
            </div>
          </div>
        </div>

        {/* Agent Config Card */}
        <div className="detail-card">
          <h3>⚙️ Configuration</h3>
          <div className="card-content">
            {/* Control Panel */}
            <div className="control-panel">
              <div className="control-row">
                <span className="control-label">Enable Agent:</span>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={localEnabled}
                    onChange={handleToggleEnabled}
                  />
                  <span className="toggle-slider"></span>
                </label>
                <span className={`control-status ${localEnabled ? 'enabled' : 'disabled'}`}>
                  {localEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="control-row">
                <span className="control-label">Trade Cap:</span>
                <input
                  type="number"
                  className="cap-input"
                  value={capInput}
                  onChange={(e) => setCapInput(e.target.value)}
                  min="0"
                  step="10"
                />
                <button className="save-button" onClick={handleSaveCap}>
                  Save
                </button>
              </div>
              {saveStatus && (
                <div className="save-status">{saveStatus}</div>
              )}
            </div>

            <div className="config-divider"></div>

            <div className="config-row">
              <span className="config-label">Enabled:</span>
              <span className={`config-value ${agentData?.agentConfig?.enabled ? 'enabled' : 'disabled'}`}>
                {agentData?.agentConfig?.enabled ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="config-row">
              <span className="config-label">ENS Node:</span>
              <span className="config-value code">
                {short(agentData?.agentConfig?.ensNode)}
              </span>
            </div>
            <div className="config-row">
              <span className="config-label">Max Per Trade:</span>
              <span className="config-value highlight">
                {fmt18(agentData?.agentConfig?.maxNotionalPerTrade)}
              </span>
            </div>
            <div className="config-row">
              <span className="config-label">Strategy:</span>
              <span className="config-value strategy">{agent.strategy}</span>
            </div>
          </div>
        </div>

        {/* Default Route Card */}
        <div className="detail-card">
          <h3>🔀 Default Route</h3>
          <div className="card-content">
            <div className="route-row">
              <span className="route-label">Token0:</span>
              <span className="route-value code">{short(agentData?.defaultRoute?.token0)}</span>
            </div>
            <div className="route-row">
              <span className="route-label">Token1:</span>
              <span className="route-value code">{short(agentData?.defaultRoute?.token1)}</span>
            </div>
            <div className="route-row">
              <span className="route-label">Fee:</span>
              <span className="route-value">{agentData?.defaultRoute?.fee}</span>
            </div>
            <div className="route-row">
              <span className="route-label">Pool:</span>
              <span className="route-value code">{short(agentData?.defaultRoute?.pool)}</span>
            </div>
            <div className="route-row">
              <span className="route-label">Enabled:</span>
              <span className={`route-value ${agentData?.defaultRoute?.enabled ? 'enabled' : 'disabled'}`}>
                {agentData?.defaultRoute?.enabled ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        </div>

        {/* Pool Helper Card */}
        <div className="detail-card">
          <h3>🔧 Pool Helper</h3>
          <div className="card-content">
            <div className="helper-row">
              <span className="helper-label">Helper Address:</span>
              <span className="helper-value code">{short(agentData?.poolSwapHelperAddr)}</span>
            </div>
            <div className="helper-row">
              <span className="helper-label">Route ID:</span>
              <span className="helper-value code">{short(agentData?.defaultRouteId)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Python Agent Runtime Section */}
      <div className="runtime-section">
        {/* Show loading state when no runtime data yet */}
        {!runtimeState && (
          <div className="runtime-loading">
            <div className="loading-spinner">⏳</div>
            <div className="loading-text">Loading agent runtime...</div>
          </div>
        )}

        {/* Show offline warning prominently */}
        {offline && runtimeState && (
          <div className="runtime-offline-warning">
            <div className="offline-icon">⚠️</div>
            <div className="offline-text">
              <strong>Python agent offline</strong>
              <p>The agent has not sent a heartbeat in over 60 seconds</p>
            </div>
          </div>
        )}

        {/* Heartbeat */}
        <AgentHeartbeat runtime={runtimeState?.runtime} offline={offline} />

        {/* PnL Chart */}
        <AgentPnLChart pnlHistory={runtimeState?.pnlHistory} agent={agent} />

        {/* Logs Panel */}
        <AgentLogsPanel logs={runtimeState?.logs} />
      </div>

      {/* Loading Indicator */}
      {loading && agentData && (
        <div className="detail-refreshing">
          <div className="refresh-spinner"></div>
          Refreshing...
        </div>
      )}
    </div>
  );
}

export default AgentDetailView;
