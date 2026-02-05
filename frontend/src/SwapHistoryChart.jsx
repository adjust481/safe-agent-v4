/**
 * SwapHistoryChart.jsx
 *
 * Chart component for visualizing swap history
 * - Uses recharts library
 * - X-axis: Time (by minute or hour)
 * - Y-axis: Sum of amountIn and trade count (dual axis)
 * - Cyberpunk/Neon styling
 */

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { aggregateSwapsForChart } from './hooks/useSwapHistory';
import './SwapHistoryChart.css';

function SwapHistoryChart({ swaps, intervalMinutes = 60 }) {
  // Aggregate data for chart
  const chartData = aggregateSwapsForChart(swaps, intervalMinutes);

  if (chartData.length === 0) {
    return (
      <div className="swap-chart-empty">
        <div className="empty-icon">📊</div>
        <div className="empty-text">No swap data to display</div>
      </div>
    );
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="chart-tooltip">
          <div className="tooltip-time">{payload[0].payload.time}</div>
          <div className="tooltip-row">
            <span className="tooltip-label">Amount In:</span>
            <span className="tooltip-value green">{payload[0].value.toFixed(4)}</span>
          </div>
          <div className="tooltip-row">
            <span className="tooltip-label">Trades:</span>
            <span className="tooltip-value pink">{payload[1].value}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="swap-history-chart">
      <div className="chart-header">
        <h3>📊 Trading Volume</h3>
        <div className="chart-interval">
          Interval: {intervalMinutes} min
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 78, 201, 0.1)" />

          <XAxis
            dataKey="time"
            stroke="#888"
            style={{ fontSize: '12px', fontFamily: 'Fira Code, monospace' }}
          />

          <YAxis
            yAxisId="left"
            stroke="#00ff99"
            style={{ fontSize: '12px', fontFamily: 'Fira Code, monospace' }}
            label={{ value: 'Amount In', angle: -90, position: 'insideLeft', fill: '#00ff99' }}
          />

          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#ff4ec9"
            style={{ fontSize: '12px', fontFamily: 'Fira Code, monospace' }}
            label={{ value: 'Trade Count', angle: 90, position: 'insideRight', fill: '#ff4ec9' }}
          />

          <Tooltip content={<CustomTooltip />} />

          <Legend
            wrapperStyle={{
              fontSize: '12px',
              fontFamily: 'Fira Code, monospace',
              color: '#888',
            }}
          />

          <Line
            yAxisId="left"
            type="monotone"
            dataKey="sumAmountIn"
            stroke="#00ff99"
            strokeWidth={2}
            dot={{ fill: '#00ff99', r: 4 }}
            activeDot={{ r: 6, fill: '#00ff99', stroke: '#0d0d0d', strokeWidth: 2 }}
            name="Amount In"
          />

          <Line
            yAxisId="right"
            type="monotone"
            dataKey="countTrades"
            stroke="#ff4ec9"
            strokeWidth={2}
            dot={{ fill: '#ff4ec9', r: 4 }}
            activeDot={{ r: 6, fill: '#ff4ec9', stroke: '#0d0d0d', strokeWidth: 2 }}
            name="Trade Count"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default SwapHistoryChart;
