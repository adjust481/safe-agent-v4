import { useState } from 'react';
import './AgentControlPanel.css';

function AgentControlPanel({ agent, runtime, flags }) {
  const [isPaused, setIsPaused] = useState(false);

  const handlePause = () => {
    if (!flags?.canPause) return;
    setIsPaused(!isPaused);
    console.log(`Agent ${agent.name}: ${isPaused ? 'Resumed' : 'Paused'}`);
  };

  const handleRebalance = () => {
    if (!flags?.canAutoRebalance) return;
    console.log(`Agent ${agent.name}: Rebalance triggered`);
  };

  const handleEmergencyStop = () => {
    if (window.confirm('⚠️ Emergency Stop will halt all agent operations. Continue?')) {
      console.log(`Agent ${agent.name}: EMERGENCY STOP activated`);
    }
  };

  const isOnline = runtime?.status === 'online';

  return (
    <div className="control-panel-container">
      <div className="control-panel-header">
        <h4>Agent Controls</h4>
        <div className={`status-badge ${runtime?.status || 'unknown'}`}>
          {runtime?.status || 'unknown'}
        </div>
      </div>

      <div className="control-buttons">
        {/* Pause/Resume Button */}
        <button
          className={`control-btn ${isPaused ? 'resume' : 'pause'}`}
          onClick={handlePause}
          disabled={!flags?.canPause || !isOnline}
          title={!flags?.canPause ? 'Pause not allowed for this agent' : ''}
        >
          <span className="btn-icon">{isPaused ? '▶️' : '⏸️'}</span>
          <span className="btn-label">{isPaused ? 'Resume' : 'Pause'}</span>
        </button>

        {/* Rebalance Button */}
        <button
          className="control-btn rebalance"
          onClick={handleRebalance}
          disabled={!flags?.canAutoRebalance || !isOnline}
          title={!flags?.canAutoRebalance ? 'Auto-rebalance disabled' : 'Trigger fund rebalancing'}
        >
          <span className="btn-icon">⚖️</span>
          <span className="btn-label">Rebalance</span>
        </button>

        {/* Emergency Stop Button */}
        <button
          className="control-btn emergency"
          onClick={handleEmergencyStop}
          disabled={flags?.emergencyStop}
          title="Emergency stop - halts all operations"
        >
          <span className="btn-icon">🛑</span>
          <span className="btn-label">Emergency Stop</span>
        </button>
      </div>

      {flags?.emergencyStop && (
        <div className="emergency-notice">
          ⚠️ Emergency stop is active. Agent operations are halted.
        </div>
      )}

      <div className="control-info">
        <div className="info-row">
          <span className="info-label">Can Pause:</span>
          <span className={`info-value ${flags?.canPause ? 'enabled' : 'disabled'}`}>
            {flags?.canPause ? '✓ Yes' : '✗ No'}
          </span>
        </div>
        <div className="info-row">
          <span className="info-label">Auto Rebalance:</span>
          <span className={`info-value ${flags?.canAutoRebalance ? 'enabled' : 'disabled'}`}>
            {flags?.canAutoRebalance ? '✓ Enabled' : '✗ Disabled'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default AgentControlPanel;
