import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import './AgentHeartbeat.css';

/**
 * AgentHeartbeat
 *
 * Props:
 *   state  — the full state.json object (has last_update, loop_count, status, etc.)
 *
 * "Online" = state is non-null (we successfully fetched state.json).
 * No offline prop, no timestamp-based offline detection.
 */
function AgentHeartbeat({ state }) {
  const [timeSinceUpdate, setTimeSinceUpdate] = useState('');
  const [status, setStatus] = useState('unknown');

  useEffect(() => {
    const updateStatus = () => {
      // If state.json was fetched successfully, treat as online — no other checks
      if (state) {
        setStatus('online');
      } else {
        setStatus('offline');
      }

      // Parse last_update from state.json
      const lastUpdate = state?.last_update ? new Date(state.last_update) : null;

      if (lastUpdate && !isNaN(lastUpdate.getTime())) {
        setTimeSinceUpdate(formatDistanceToNow(lastUpdate, { addSuffix: true }));
      } else if (state) {
        setTimeSinceUpdate('just now');
      } else {
        setTimeSinceUpdate('Never');
      }
    };

    updateStatus();
    const interval = setInterval(updateStatus, 1000);

    return () => clearInterval(interval);
  }, [state]);

  const statusConfig = {
    online: { color: '#00ff99', label: 'Online', icon: '🟢' },
    offline: { color: '#666', label: 'Offline', icon: '⚪' },
    unknown: { color: '#666', label: 'Unknown', icon: '⚪' }
  };

  const config = statusConfig[status];

  return (
    <div className="heartbeat-container">
      <div className="heartbeat-header">
        <h4>Agent Heartbeat</h4>
      </div>

      <div className="heartbeat-status">
        <div
          className={`heartbeat-indicator ${status}`}
          style={{ backgroundColor: config.color }}
        >
          <div className="heartbeat-pulse" />
        </div>

        <div className="heartbeat-info">
          <div className="heartbeat-label" style={{ color: config.color }}>
            {config.icon} {config.label}
          </div>
          <div className="heartbeat-time">
            Last update: {timeSinceUpdate}
          </div>
        </div>
      </div>

      {state && (
        <div className="heartbeat-details">
          <div className="detail-row">
            <span className="detail-label">Iteration:</span>
            <span className="detail-value">{state.loop_count || 0}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Status:</span>
            <span className="detail-value">{state.status || 'N/A'}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Trades:</span>
            <span className="detail-value">{state.total_trades || 0}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default AgentHeartbeat;
