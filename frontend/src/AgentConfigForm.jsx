/**
 * AgentConfigForm.jsx
 *
 * ENS Configuration Form for Agent Settings
 * - Configure agent address, ensName, maxPerTrade, enabled status
 * - Compute namehash and write to chain via vault.setAgentConfig()
 * - Cache ensName in localStorage
 */

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './AgentConfigForm.css';

// localStorage key for ENS name mapping
const ENS_STORAGE_KEY = 'agent_ens_mapping';

// Helper: Get ENS mapping from localStorage
export function getEnsMapping() {
  try {
    const stored = localStorage.getItem(ENS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

// Helper: Set ENS name for address in localStorage
export function setEnsName(address, ensName) {
  const mapping = getEnsMapping();
  mapping[address.toLowerCase()] = ensName;
  localStorage.setItem(ENS_STORAGE_KEY, JSON.stringify(mapping));
}

// Helper: Get ENS name for address from localStorage
export function getEnsName(address) {
  const mapping = getEnsMapping();
  return mapping[address.toLowerCase()] || null;
}

function AgentConfigForm({ deployment, vaultContract, onConfigSaved }) {
  const [formData, setFormData] = useState({
    agentAddress: '',
    ensName: '',
    maxPerTrade: '100',
    enabled: true,
  });
  const [txStatus, setTxStatus] = useState({ loading: false, hash: null, error: null });
  const [signerMode, setSignerMode] = useState('env'); // 'metamask' or 'env'

  // Available agents from deployment
  const availableAgents = deployment?.actors ? [
    { address: deployment.actors.agent, label: 'Primary Agent' },
    { address: deployment.actors.user, label: 'User (for testing)' },
  ] : [];

  // Initialize form with first agent
  useEffect(() => {
    if (availableAgents.length > 0 && !formData.agentAddress) {
      const firstAgent = availableAgents[0].address;
      setFormData(prev => ({
        ...prev,
        agentAddress: firstAgent,
        ensName: getEnsName(firstAgent) || '',
      }));
    }
  }, [availableAgents.length]);

  // Update ensName when agent address changes
  const handleAgentChange = (address) => {
    const cachedEnsName = getEnsName(address);
    setFormData(prev => ({
      ...prev,
      agentAddress: address,
      ensName: cachedEnsName || '',
    }));
  };

  // Handle form submission
  const handleSave = async (e) => {
    e.preventDefault();
    setTxStatus({ loading: true, hash: null, error: null });

    try {
      // Validate inputs
      if (!formData.agentAddress) {
        throw new Error('Please select an agent address');
      }
      if (!formData.ensName) {
        throw new Error('Please enter an ENS name');
      }
      if (!formData.maxPerTrade || parseFloat(formData.maxPerTrade) <= 0) {
        throw new Error('Please enter a valid max per trade amount');
      }

      // Step 1: Compute namehash
      const ensNode = ethers.namehash(formData.ensName);
      console.log('Computed namehash:', ensNode);

      // Step 2: Prepare contract call parameters
      const maxPerTradeWei = ethers.parseUnits(formData.maxPerTrade, 18);

      // Step 3: Get signer
      let signer;
      if (signerMode === 'metamask') {
        if (!window.ethereum) {
          throw new Error('MetaMask not found');
        }
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        const provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
      } else {
        // Use ENV private key (for local demo)
        const keysData = await fetch('/deployments/keys.local.json').then(r => r.json());
        const privateKey = keysData.agentPrivateKeys?.[formData.agentAddress] || keysData.deployerPrivateKey;
        if (!privateKey) {
          throw new Error('No private key found for this agent');
        }
        const provider = new ethers.JsonRpcProvider(deployment.rpcUrl);
        signer = new ethers.Wallet(privateKey, provider);
      }

      console.log('Using signer:', await signer.getAddress());

      // Step 4: Call vault.setAgentConfig()
      const vaultWithSigner = vaultContract.connect(signer);
      const tx = await vaultWithSigner.setAgentConfig(
        formData.agentAddress,
        formData.enabled,
        ensNode,
        maxPerTradeWei
      );

      console.log('Transaction sent:', tx.hash);
      setTxStatus({ loading: true, hash: tx.hash, error: null });

      // Wait for confirmation
      const receipt = await tx.wait();
      console.log('Transaction confirmed:', receipt);

      // Step 5: Cache ensName in localStorage
      setEnsName(formData.agentAddress, formData.ensName);
      console.log('ENS name cached in localStorage');

      setTxStatus({ loading: false, hash: tx.hash, error: null });

      // Notify parent component
      if (onConfigSaved) {
        onConfigSaved({
          agentAddress: formData.agentAddress,
          ensName: formData.ensName,
          ensNode,
          maxPerTrade: formData.maxPerTrade,
          enabled: formData.enabled,
        });
      }

      alert('✅ Agent config saved successfully!');
    } catch (err) {
      console.error('Failed to save config:', err);
      setTxStatus({ loading: false, hash: null, error: err.message });
    }
  };

  return (
    <div className="agent-config-form">
      <div className="form-header">
        <h2>⚙️ Agent ENS Configuration</h2>
        <div className="form-description">
          Configure agent identity and trading limits
        </div>
      </div>

      <form onSubmit={handleSave}>
        {/* Agent Address Dropdown */}
        <div className="form-group">
          <label htmlFor="agentAddress">Agent Address</label>
          <select
            id="agentAddress"
            value={formData.agentAddress}
            onChange={(e) => handleAgentChange(e.target.value)}
            disabled={txStatus.loading}
          >
            <option value="">Select Agent...</option>
            {availableAgents.map((agent) => (
              <option key={agent.address} value={agent.address}>
                {agent.label} - {agent.address.slice(0, 10)}...{agent.address.slice(-8)}
              </option>
            ))}
          </select>
        </div>

        {/* ENS Name Input */}
        <div className="form-group">
          <label htmlFor="ensName">ENS Name</label>
          <input
            type="text"
            id="ensName"
            placeholder="agent.safe.eth"
            value={formData.ensName}
            onChange={(e) => setFormData({ ...formData, ensName: e.target.value })}
            disabled={txStatus.loading}
          />
          <div className="form-hint">
            The ENS name that identifies this agent (e.g., agent.safe.eth)
          </div>
        </div>

        {/* Max Per Trade Input */}
        <div className="form-group">
          <label htmlFor="maxPerTrade">Max Per Trade (tokens)</label>
          <input
            type="text"
            id="maxPerTrade"
            placeholder="100"
            value={formData.maxPerTrade}
            onChange={(e) => setFormData({ ...formData, maxPerTrade: e.target.value })}
            disabled={txStatus.loading}
          />
          <div className="form-hint">
            Maximum notional amount per trade (in token units)
          </div>
        </div>

        {/* Enabled Toggle */}
        <div className="form-group toggle-group">
          <label htmlFor="enabled">
            <span>Agent Enabled</span>
            <input
              type="checkbox"
              id="enabled"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              disabled={txStatus.loading}
            />
            <span className="toggle-slider"></span>
          </label>
          <div className="form-hint">
            Enable or disable this agent's trading permissions
          </div>
        </div>

        {/* Signer Mode Selection */}
        <div className="form-group">
          <label>Signer Mode</label>
          <div className="radio-group">
            <label className="radio-label">
              <input
                type="radio"
                value="env"
                checked={signerMode === 'env'}
                onChange={(e) => setSignerMode(e.target.value)}
                disabled={txStatus.loading}
              />
              <span>ENV Private Key (Local Demo)</span>
            </label>
            <label className="radio-label">
              <input
                type="radio"
                value="metamask"
                checked={signerMode === 'metamask'}
                onChange={(e) => setSignerMode(e.target.value)}
                disabled={txStatus.loading}
              />
              <span>MetaMask</span>
            </label>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="save-button"
          disabled={txStatus.loading || !formData.agentAddress}
        >
          {txStatus.loading ? '⏳ Saving...' : '💾 Save Configuration'}
        </button>

        {/* Transaction Status */}
        {txStatus.hash && (
          <div className="tx-result success">
            ✓ Transaction: <code>{txStatus.hash.slice(0, 10)}...{txStatus.hash.slice(-8)}</code>
          </div>
        )}
        {txStatus.error && (
          <div className="tx-result error">
            ✗ Error: {txStatus.error}
          </div>
        )}
      </form>
    </div>
  );
}

export default AgentConfigForm;
