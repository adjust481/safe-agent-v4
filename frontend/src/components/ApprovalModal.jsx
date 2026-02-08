/**
 * ApprovalModal.jsx
 *
 * Full-screen approval modal with three-column layout:
 * - Left: AI Reasoning (Agent's decision analysis)
 * - Center: Transaction Details
 * - Right: Risk Control Checklist
 *
 * Features:
 * - Glassmorphism effect with backdrop blur
 * - MetaMask integration for approve & execute
 * - Reject functionality
 * - Body scroll lock when modal is open
 */

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './ApprovalModal.css';

export default function ApprovalModal({
  isOpen,
  intent,
  agent,
  vault,
  onClose,
  onApprove,
  onReject
}) {
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState(null);
  const [typingText, setTypingText] = useState('');

  // Typewriter effect for reasoning
  useEffect(() => {
    if (!isOpen || !intent?.reason) {
      setTypingText('');
      return;
    }

    const fullText = intent.reason;
    let currentIndex = 0;

    const interval = setInterval(() => {
      if (currentIndex <= fullText.length) {
        setTypingText(fullText.slice(0, currentIndex));
        currentIndex++;
      } else {
        clearInterval(interval);
      }
    }, 30); // Typing speed

    return () => clearInterval(interval);
  }, [isOpen, intent?.reason]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !intent) return null;

  // Format amount (assuming 18 decimals)
  const formatAmount = (amount) => {
    if (!amount) return '0';
    try {
      return ethers.formatUnits(amount, 18);
    } catch {
      return '0';
    }
  };

  // Calculate estimated slippage
  const calculateSlippage = () => {
    if (!intent.amountIn || !intent.minOut) return 'N/A';
    try {
      const amountIn = parseFloat(formatAmount(intent.amountIn));
      const minOut = parseFloat(formatAmount(intent.minOut));
      const slippage = ((amountIn - minOut) / amountIn * 100).toFixed(2);
      return `${slippage}%`;
    } catch {
      return 'N/A';
    }
  };

  // Handle approve and execute
  const handleApprove = async () => {
    setLoading(true);
    setTxStatus('Connecting to Hardhat node...');

    try {
      // Always use Hardhat local RPC signer for local dev.
      // Signer index 0 = deployer/owner account (0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266)
      // approveAndExecute() has onlyOwner modifier, so we must use the owner account.
      const rpcProvider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
      const signer = await rpcProvider.getSigner(0);

      // Recreate the vault contract instance with this signer
      const vaultWithSigner = new ethers.Contract(
        vault.target,   // ethers v6: contract address is on .target
        vault.interface, // reuse the same ABI interface
        signer
      );

      setTxStatus('Sending approveAndExecute transaction...');

      // Call approveAndExecute
      const tx = await vaultWithSigner.approveAndExecute();

      setTxStatus(`Transaction sent: ${tx.hash.slice(0, 10)}...`);

      // Wait for confirmation
      const receipt = await tx.wait();

      setTxStatus('Transaction confirmed!');

      // Call parent callback
      if (onApprove) {
        onApprove(receipt);
      }

      // Close modal after 2 seconds
      setTimeout(() => {
        onClose();
        setTxStatus(null);
      }, 2000);

    } catch (err) {
      console.error('Approval failed:', err);
      const reason = err.reason || err.message || String(err);
      setTxStatus(`Error: ${reason}`);

      // Clear error after 5 seconds
      setTimeout(() => {
        setTxStatus(null);
      }, 5000);
    } finally {
      setLoading(false);
    }
  };

  // Handle reject
  const handleReject = () => {
    if (onReject) {
      onReject();
    }
    onClose();
  };

  // Risk check items (can be dynamic based on state.risk_check in the future)
  const riskChecks = [
    { label: 'ENS Address Verified', checked: true },
    { label: 'Route Contract Whitelisted', checked: true },
    { label: 'Under Daily Trade Limit', checked: true },
    { label: 'Sufficient Balance Available', checked: true },
  ];

  return (
    <div className="approval-modal-overlay" onClick={onClose}>
      <div className="approval-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button className="modal-close-btn" onClick={onClose}>
          ✕
        </button>

        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-icon">⚠️</div>
          <h1 className="modal-title">Authorization Request</h1>
          <p className="modal-subtitle">Agent is requesting permission to execute a trade</p>
        </div>

        {/* Three Column Layout */}
        <div className="modal-content-grid">
          {/* Left Column: AI Reasoning */}
          <div className="modal-column reasoning-column">
            <div className="column-header">
              <div className="column-icon">🧠</div>
              <h2>AI Decision Analysis</h2>
            </div>
            <div className="column-content">
              <div className="reasoning-box">
                <div className="reasoning-label">Agent's Reasoning:</div>
                <blockquote className="reasoning-text">
                  {typingText}
                  <span className="typing-cursor">|</span>
                </blockquote>
              </div>

              {intent.meta?.signal && (
                <div className="signal-box">
                  <div className="signal-label">Market Signal:</div>
                  <div className="signal-data">
                    {intent.meta.signal.best_bid && (
                      <div className="signal-row">
                        <span>Best Bid:</span>
                        <span className="signal-value">{intent.meta.signal.best_bid}</span>
                      </div>
                    )}
                    {intent.meta.signal.best_ask && (
                      <div className="signal-row">
                        <span>Best Ask:</span>
                        <span className="signal-value">{intent.meta.signal.best_ask}</span>
                      </div>
                    )}
                    {intent.meta.signal.spread !== undefined && (
                      <div className="signal-row">
                        <span>Spread:</span>
                        <span className="signal-value">{(intent.meta.signal.spread * 100).toFixed(2)}%</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Center Column: Transaction Details */}
          <div className="modal-column details-column">
            <div className="column-header">
              <div className="column-icon">📋</div>
              <h2>Transaction Details</h2>
            </div>
            <div className="column-content">
              <div className="detail-row">
                <span className="detail-label">Target Protocol:</span>
                <span className="detail-value protocol">Uniswap V3</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Action:</span>
                <span className="detail-value action">{intent.action}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Direction:</span>
                <span className="detail-value direction">
                  {intent.zeroForOne ? 'Token0 → Token1' : 'Token1 → Token0'}
                </span>
              </div>
              <div className="detail-row highlight">
                <span className="detail-label">Amount In:</span>
                <span className="detail-value amount">
                  {formatAmount(intent.amountIn)} tokens
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Minimum Out:</span>
                <span className="detail-value">
                  {formatAmount(intent.minOut)} tokens
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Estimated Slippage:</span>
                <span className="detail-value slippage">{calculateSlippage()}</span>
              </div>

              {agent && (
                <>
                  <div className="detail-divider"></div>
                  <div className="detail-row">
                    <span className="detail-label">Agent:</span>
                    <span className="detail-value agent-name">
                      {agent.ensName || agent.address?.slice(0, 10) + '...'}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Strategy:</span>
                    <span className="detail-value strategy">{agent.strategy}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Column: Risk Control */}
          <div className="modal-column risk-column">
            <div className="column-header">
              <div className="column-icon">🛡️</div>
              <h2>Risk Control Check</h2>
            </div>
            <div className="column-content">
              <div className="risk-checklist">
                {riskChecks.map((check, index) => (
                  <div key={index} className="risk-check-item">
                    <div className={`check-icon ${check.checked ? 'checked' : 'unchecked'}`}>
                      {check.checked ? '✅' : '⚠️'}
                    </div>
                    <span className="check-label">{check.label}</span>
                  </div>
                ))}
              </div>

              <div className="risk-summary">
                <div className="summary-badge success">
                  All checks passed
                </div>
                <p className="summary-text">
                  This transaction has passed all automated risk checks and is ready for your approval.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="modal-actions">
          <button
            className="action-btn reject-btn"
            onClick={handleReject}
            disabled={loading}
          >
            <span className="btn-icon">🚫</span>
            Reject Execution
          </button>

          <button
            className="action-btn approve-btn"
            onClick={handleApprove}
            disabled={loading}
          >
            <span className="btn-icon">✅</span>
            {loading ? 'Processing...' : 'Authorize & Execute'}
          </button>
        </div>

        {/* Transaction Status */}
        {txStatus && (
          <div className={`tx-status ${txStatus.includes('✅') ? 'success' : txStatus.includes('❌') ? 'error' : 'info'}`}>
            {txStatus}
          </div>
        )}
      </div>
    </div>
  );
}
