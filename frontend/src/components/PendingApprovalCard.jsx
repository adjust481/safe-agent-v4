import { ethers } from 'ethers';
import './PendingApprovalCard.css';

export default function PendingApprovalCard({ pendingRequest, agent, onApprove, loading }) {
  if (!pendingRequest) return null;

  const { agent: reqAgent, amount, zeroForOne, approved, executed } = pendingRequest;

  // Check if there's a pending request
  const hasPending =
    reqAgent !== ethers.ZeroAddress &&
    !approved &&
    !executed;

  if (!hasPending) return null;

  // Format amount (assuming 6 decimals for USDC)
  const formatAmount = (amt) => {
    if (!amt) return '0';
    return (Number(amt) / 1e6).toFixed(2);
  };

  return (
    <div className="pending-approval-card">
      <div className="pending-header">
        <div className="pending-icon">⚠️</div>
        <h2>Execution Request Pending</h2>
      </div>

      <div className="pending-content">
        <div className="pending-row">
          <span className="pending-label">Agent:</span>
          <span className="pending-value agent-address">
            {agent?.ensName || `${reqAgent.slice(0, 10)}...${reqAgent.slice(-8)}`}
          </span>
        </div>

        <div className="pending-row">
          <span className="pending-label">Strategy:</span>
          <span className="pending-value strategy-name">
            {agent?.strategy || 'Unknown'}
          </span>
        </div>

        <div className="pending-row">
          <span className="pending-label">Amount:</span>
          <span className="pending-value amount-value">
            {formatAmount(amount)} USDC
          </span>
        </div>

        <div className="pending-row">
          <span className="pending-label">Direction:</span>
          <span className="pending-value direction-value">
            {zeroForOne ? 'Token0 → Token1' : 'Token1 → Token0'}
          </span>
        </div>
      </div>

      <button
        className="approve-button"
        onClick={onApprove}
        disabled={loading}
      >
        {loading ? 'Processing...' : 'Approve & Execute'}
      </button>

      <div className="pending-warning">
        ⚠️ Agent will be automatically disabled after execution
      </div>
    </div>
  );
}
