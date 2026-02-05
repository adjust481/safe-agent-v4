/**
 * SwapHistory.jsx
 *
 * Enhanced swap history component with:
 * - Pagination (2000 blocks per page)
 * - Filters (agent, user, pool)
 * - Sorting (blockNumber, timestamp)
 * - Chart visualization
 * - Cyberpunk/Neon styling
 */

import { useState } from 'react';
import { ethers } from 'ethers';
import { useSwapHistory } from './hooks/useSwapHistory';
import SwapHistoryChart from './SwapHistoryChart';
import { fmt18, short } from './lib/format';
import './SwapHistory.css';

// Safe namehash helper
function safeNamehash(name) {
  try {
    return ethers.namehash(name);
  } catch {
    return null;
  }
}

function SwapHistory({ vault, ensName }) {
  const {
    swaps,
    loading,
    error,
    hasMore,
    loadMore,
    filters,
    setFilters,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    uniqueAgents,
    uniqueUsers,
    uniquePools,
  } = useSwapHistory(vault);

  const [showChart, setShowChart] = useState(true);
  const [chartInterval, setChartInterval] = useState(60); // minutes

  // Handle filter change
  const handleFilterChange = (filterType, value) => {
    setFilters((prev) => ({
      ...prev,
      [filterType]: value === 'all' ? null : value,
    }));
  };

  // Handle sort change
  const handleSortChange = (newSortBy) => {
    if (sortBy === newSortBy) {
      // Toggle order
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="swap-history-container">
      {/* Header */}
      <div className="history-header">
        <h2>📜 Swap History</h2>
        <div className="header-actions">
          <button
            className={`toggle-chart-btn ${showChart ? 'active' : ''}`}
            onClick={() => setShowChart(!showChart)}
          >
            {showChart ? '📊 Hide Chart' : '📊 Show Chart'}
          </button>
        </div>
      </div>

      {/* Chart */}
      {showChart && (
        <div className="chart-section">
          <SwapHistoryChart swaps={swaps} intervalMinutes={chartInterval} />
          <div className="chart-controls">
            <label>
              Interval:
              <select
                value={chartInterval}
                onChange={(e) => setChartInterval(Number(e.target.value))}
              >
                <option value={5}>5 min</option>
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={60}>1 hour</option>
                <option value={240}>4 hours</option>
              </select>
            </label>
          </div>
        </div>
      )}

      {/* Filters and Sorting */}
      <div className="history-controls">
        <div className="filters">
          <div className="filter-group">
            <label>Agent:</label>
            <select
              value={filters.agent || 'all'}
              onChange={(e) => handleFilterChange('agent', e.target.value)}
            >
              <option value="all">All Agents</option>
              {uniqueAgents.map((agent) => (
                <option key={agent} value={agent}>
                  {short(agent)}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>User:</label>
            <select
              value={filters.user || 'all'}
              onChange={(e) => handleFilterChange('user', e.target.value)}
            >
              <option value="all">All Users</option>
              {uniqueUsers.map((user) => (
                <option key={user} value={user}>
                  {short(user)}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Pool:</label>
            <select
              value={filters.pool || 'all'}
              onChange={(e) => handleFilterChange('pool', e.target.value)}
            >
              <option value="all">All Pools</option>
              {uniquePools.map((pool) => (
                <option key={pool} value={pool}>
                  {short(pool)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="sort-controls">
          <label>Sort by:</label>
          <button
            className={`sort-btn ${sortBy === 'blockNumber' ? 'active' : ''}`}
            onClick={() => handleSortChange('blockNumber')}
          >
            Block {sortBy === 'blockNumber' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <button
            className={`sort-btn ${sortBy === 'timestamp' ? 'active' : ''}`}
            onClick={() => handleSortChange('timestamp')}
          >
            Time {sortBy === 'timestamp' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="history-stats">
        <div className="stat-item">
          <span className="stat-label">Total Swaps:</span>
          <span className="stat-value">{swaps.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Filtered:</span>
          <span className="stat-value">{swaps.length}</span>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="history-error">
          <div className="error-icon">⚠️</div>
          <div className="error-message">{error}</div>
        </div>
      )}

      {/* Table */}
      <div className="history-table-container">
        <table className="history-table">
          <thead>
            <tr>
              <th onClick={() => handleSortChange('blockNumber')} className="sortable">
                Block {sortBy === 'blockNumber' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSortChange('timestamp')} className="sortable">
                Time {sortBy === 'timestamp' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th>TX Hash</th>
              <th>Agent</th>
              <th>ENS</th>
              <th>User</th>
              <th>Pool</th>
              <th>Direction</th>
              <th>Amount In</th>
              <th>Amount Out</th>
            </tr>
          </thead>
          <tbody>
            {loading && swaps.length === 0 ? (
              <tr>
                <td colSpan="10" className="loading-cell">
                  <div className="loading-spinner"></div>
                  Loading swaps...
                </td>
              </tr>
            ) : swaps.length === 0 ? (
              <tr>
                <td colSpan="10" className="empty-cell">
                  No swaps found
                </td>
              </tr>
            ) : (
              swaps.map((swap, i) => {
                const ensMatch = ensName && swap.ensNode && safeNamehash(ensName) === swap.ensNode;
                const ensDisplay = ensMatch ? ensName : short(swap.ensNode || '0x00...');

                return (
                  <tr key={`${swap.txHash}-${i}`}>
                    <td>{swap.blockNumber}</td>
                    <td className="timestamp-cell">{formatTimestamp(swap.timestamp)}</td>
                    <td>
                      <code className="tx-hash">{short(swap.txHash)}</code>
                    </td>
                    <td>
                      <code>{short(swap.agent)}</code>
                    </td>
                    <td>
                      <strong className={ensMatch ? 'ens-verified' : ''}>
                        {ensDisplay}
                      </strong>
                    </td>
                    <td>
                      <code>{short(swap.user)}</code>
                    </td>
                    <td>
                      <code>{short(swap.pool)}</code>
                    </td>
                    <td className="direction-cell">
                      {swap.zeroForOne ? '0→1' : '1→0'}
                    </td>
                    <td className="amount-cell">{fmt18(swap.amountIn)}</td>
                    <td className="amount-cell">{fmt18(swap.amountOut)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Load More Button */}
      {hasMore && (
        <div className="load-more-container">
          <button
            className="load-more-btn"
            onClick={loadMore}
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="btn-spinner"></div>
                Loading...
              </>
            ) : (
              '⬇️ Load More (Earlier Swaps)'
            )}
          </button>
          <div className="load-more-hint">
            Loads 2000 blocks at a time
          </div>
        </div>
      )}

      {!hasMore && swaps.length > 0 && (
        <div className="end-of-history">
          📍 Reached the beginning of swap history
        </div>
      )}
    </div>
  );
}

export default SwapHistory;
