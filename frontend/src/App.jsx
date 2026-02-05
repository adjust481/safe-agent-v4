/**
 * App.jsx - Multi-Agent Dashboard
 *
 * Refactored to support multiple agents:
 * - Left sidebar: Agent list from agents.local.json
 * - Right panel: Selected agent details
 * - Top header: Current agent ENS name and address
 * - Polling: Every 2 seconds for current agent data
 * - Cyberpunk theme: Black background with pink/neon borders
 */

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';
import deployment from './deployments.localhost.json';
import VaultABI from './abi/SafeAgentVault.json';
import { getReadProvider } from './lib/provider';
import AgentSidebar from './AgentSidebar';
import AgentDetailView from './AgentDetailView';
import { useAgentsList, useAgentData } from './hooks/useAgentData';

function App() {
  // Load agents list
  const { agents, loading: agentsLoading, error: agentsError } = useAgentsList();

  // Selected agent state
  const [selectedAgent, setSelectedAgent] = useState(null);

  // Setup provider and vault contract
  const provider = getReadProvider(deployment);
  const vault = new ethers.Contract(deployment.addresses.vault, VaultABI.abi, provider);

  // Fetch selected agent data (polls every 2 seconds)
  const { agentData, loading: dataLoading, error: dataError } = useAgentData(
    vault,
    deployment,
    selectedAgent?.address,
    deployment.actors.user,
    2000 // Poll every 2 seconds
  );

  // Auto-select first agent when agents load
  useEffect(() => {
    if (agents.length > 0 && !selectedAgent) {
      setSelectedAgent(agents[0]);
    }
  }, [agents, selectedAgent]);

  // Handle agent selection
  const handleSelectAgent = (agent) => {
    setSelectedAgent(agent);
  };

  return (
    <div className="app multi-agent">
      {/* Header */}
      <header className="app-header">
        <h1>🤖 SafeAgentVault Dashboard</h1>
        <div className="header-info">
          <div className="header-item">
            <span className="label">Vault:</span>
            <code>{deployment.addresses.vault.slice(0, 10)}...{deployment.addresses.vault.slice(-8)}</code>
          </div>
          <div className="header-item">
            <span className="label">User:</span>
            <code>{deployment.actors.user.slice(0, 10)}...{deployment.actors.user.slice(-8)}</code>
          </div>
        </div>
      </header>

      {/* Main Layout: Sidebar + Detail View */}
      <div className="main-layout">
        {/* Left Sidebar */}
        <aside className="sidebar-container">
          <AgentSidebar
            agents={agents}
            selectedAgent={selectedAgent}
            onSelectAgent={handleSelectAgent}
            loading={agentsLoading}
          />
        </aside>

        {/* Right Detail View */}
        <main className="detail-container">
          <AgentDetailView
            agent={selectedAgent}
            agentData={agentData}
            loading={dataLoading}
            error={dataError}
            deployment={deployment}
            vault={vault}
          />
        </main>
      </div>

      {/* Error Display */}
      {agentsError && (
        <div className="global-error">
          <div className="error-icon">⚠️</div>
          <div className="error-title">Failed to Load Agents</div>
          <div className="error-message">{agentsError}</div>
        </div>
      )}
    </div>
  );
}

export default App;
