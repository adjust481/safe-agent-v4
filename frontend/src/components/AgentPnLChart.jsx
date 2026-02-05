import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { format } from 'date-fns';
import './AgentPnLChart.css';

function AgentPnLChart({ pnlHistory, agent }) {
  // pnlHistory 格式：[{ timestamp: "...", pnl: 0.0 }, ...]

  if (!pnlHistory || pnlHistory.length === 0) {
    return (
      <div className="pnl-chart-empty">
        <div className="empty-icon">📊</div>
        <div className="empty-text">No PnL data</div>
        <div className="empty-hint">PnL will appear after first trade</div>
      </div>
    );
  }

  const chartColor = agent?.ui?.color || '#FF006E';
  const lastPnl = pnlHistory[pnlHistory.length - 1].pnl;

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="custom-tooltip">
          <div className="tooltip-time">
            {format(new Date(data.timestamp), 'MMM dd, HH:mm:ss')}
          </div>
          <div className="tooltip-value" style={{ color: chartColor }}>
            PnL: {data.pnl >= 0 ? '+' : ''}{data.pnl.toFixed(4)}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="pnl-chart-container">
      <div className="chart-header">
        <h3>Cumulative PnL</h3>
        <div className="chart-stats">
          <div className="stat">
            <span className="stat-label">Total:</span>
            <span className="stat-value" style={{ color: lastPnl >= 0 ? '#10b981' : '#ef4444' }}>
              {lastPnl >= 0 ? '+' : ''}
              {lastPnl.toFixed(4)}
            </span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={pnlHistory} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={chartColor} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={chartColor} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(ts) => format(new Date(ts), 'HH:mm:ss')}
            stroke="#6b7280"
            style={{ fontSize: 12 }}
          />
          <YAxis
            stroke="#6b7280"
            style={{ fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="pnl"
            stroke={chartColor}
            strokeWidth={2}
            fill="url(#colorPnl)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default AgentPnLChart;
