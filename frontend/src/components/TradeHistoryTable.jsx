import { useState } from 'react';
import { format } from 'date-fns';
import './TradeHistoryTable.css';

function TradeHistoryTable({ trades }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState('desc');
  const tradesPerPage = 10;

  if (!trades || trades.length === 0) {
    return (
      <div className="trade-history-empty">
        <div className="empty-icon">📜</div>
        <div className="empty-text">No trades yet</div>
        <div className="empty-hint">Trade history will appear here after first execution</div>
      </div>
    );
  }

  // 排序逻辑
  const sortedTrades = [...trades].sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];

    if (sortBy === 'timestamp') {
      aVal = new Date(aVal).getTime();
      bVal = new Date(bVal).getTime();
    }

    if (sortOrder === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  // 分页逻辑
  const indexOfLastTrade = currentPage * tradesPerPage;
  const indexOfFirstTrade = indexOfLastTrade - tradesPerPage;
  const currentTrades = sortedTrades.slice(indexOfFirstTrade, indexOfLastTrade);
  const totalPages = Math.ceil(sortedTrades.length / tradesPerPage);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  return (
    <div className="trade-history-container">
      <div className="table-header">
        <h3>Trade History</h3>
        <div className="trade-count">{trades.length} trades</div>
      </div>

      <div className="table-wrapper">
        <table className="trade-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('timestamp')} className="sortable">
                Time {sortBy === 'timestamp' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th>Pair</th>
              <th>Direction</th>
              <th onClick={() => handleSort('amountIn')} className="sortable">
                Amount In {sortBy === 'amountIn' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('amountOut')} className="sortable">
                Amount Out {sortBy === 'amountOut' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('pnl')} className="sortable">
                PnL {sortBy === 'pnl' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th>Gas</th>
              <th>Tx</th>
            </tr>
          </thead>
          <tbody>
            {currentTrades.map((trade, idx) => (
              <tr key={idx}>
                <td className="time-cell">
                  {format(new Date(trade.timestamp), 'MMM dd HH:mm:ss')}
                </td>
                <td className="pair-cell">
                  <span className="token-pair">
                    {trade.token0Symbol || 'T0'}/{trade.token1Symbol || 'T1'}
                  </span>
                </td>
                <td className="direction-cell">
                  <span className={`direction-badge ${trade.zeroForOne ? 'sell' : 'buy'}`}>
                    {trade.zeroForOne ? '→' : '←'}
                  </span>
                </td>
                <td className="amount-cell">
                  {parseFloat(trade.amountIn).toFixed(2)}
                </td>
                <td className="amount-cell">
                  {parseFloat(trade.amountOut).toFixed(2)}
                </td>
                <td className={`pnl-cell ${trade.pnl >= 0 ? 'positive' : 'negative'}`}>
                  {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}
                </td>
                <td className="gas-cell">
                  {trade.gasUsed ? trade.gasUsed.toLocaleString() : 'N/A'}
                </td>
                <td className="tx-cell">
                  <a
                    href={`https://etherscan.io/tx/${trade.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tx-link"
                    title={trade.txHash}
                  >
                    {trade.txHash.slice(0, 6)}...
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="page-btn"
          >
            ← Prev
          </button>
          <span className="page-info">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="page-btn"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

export default TradeHistoryTable;
