import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import './AgentHeartbeat.css';

function AgentHeartbeat({ runtime, offline }) {
  const [timeSinceUpdate, setTimeSinceUpdate] = useState('');
  const [status, setStatus] = useState('unknown');

  useEffect(() => {
    const updateStatus = () => {
      if (offline || !runtime?.lastHeartbeat) {
        setStatus('offline');
        setTimeSinceUpdate('Never');
        return;
      }

      const lastHeartbeat = new Date(runtime.lastHeartbeat);
      const now = new Date();
      const secondsSince = (now - lastHeartbeat) / 1000;

      if (secondsSince <= 60) {
        setStatus('online');
      } else {
        setStatus('offline');
      }

      setTimeSinceUpdate(formatDistanceToNow(lastHeartbeat, { addSuffix: true }));
    };

    updateStatus();
    const interval = setInterval(updateStatus, 1000);

    return () => clearInterval(interval);
  }, [runtime, offline]);

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

      {runtime && (
        <div className="heartbeat-details">
          <div className="detail-row">
            <span className="detail-label">Iteration:</span>
            <span className="detail-value">{runtime.iteration || 0}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Mode:</span>
            <span className="detail-value">{runtime.mode || 'N/A'}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default AgentHeartbeat;
