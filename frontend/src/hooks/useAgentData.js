/**
 * useAgentData.js
 *
 * Custom hook for polling agent data from blockchain
 * - Fetches agent balances, config, and route info
 * - Polls every 2 seconds
 * - Returns loading state and error handling
 * - NO mock data — contract errors propagate to error state
 */

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

export function useAgentData(vault, deployment, agentAddress, userAddress, pollInterval = 2000) {
  const [agentData, setAgentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAgentData = useCallback(async () => {
    if (!vault || !agentAddress || !userAddress) {
      return;
    }

    try {
      // Query balances — no mock fallback, errors propagate
      const userBalance = await vault.balances(userAddress);
      const agentSubBalance = await vault.agentBalances(userAddress, agentAddress);
      const agentSpentAmount = await vault.agentSpent(userAddress, agentAddress);

      // Query agent config (defensive - only access first 3 fields)
      const cfgRaw = await vault.agentConfigs(agentAddress);
      const agentConfig = {
        enabled: cfgRaw?.[0] ?? false,
        ensNode: cfgRaw?.[1] ? ethers.hexlify(cfgRaw[1]) : '0x0000000000000000000000000000000000000000000000000000000000000000',
        maxNotionalPerTrade: cfgRaw?.[2] ?? 0n,
      };

      // Query poolSwapHelper
      const poolSwapHelperAddr = await vault.poolSwapHelper();

      // Query default route (defensive - access by index)
      const defaultRouteId = await vault.defaultRouteId();
      const routeRaw = await vault.routes(defaultRouteId);
      const defaultRoute = {
        token0: routeRaw?.[0] ?? ethers.ZeroAddress,
        token1: routeRaw?.[1] ?? ethers.ZeroAddress,
        fee: routeRaw?.[2] ?? 0,
        pool: routeRaw?.[3] ?? ethers.ZeroAddress,
        enabled: routeRaw?.[4] ?? false,
      };

      // Query pending execution request
      const reqRaw = await vault.pendingRequest();
      const pendingRequest = {
        agent: reqRaw?.[0] ?? ethers.ZeroAddress,
        amount: reqRaw?.[1] ?? 0n,
        zeroForOne: reqRaw?.[2] ?? false,
        approved: reqRaw?.[3] ?? false,
        executed: reqRaw?.[4] ?? false,
      };

      setAgentData({
        userBalance,
        agentSubBalance,
        agentSpentAmount,
        agentConfig,
        poolSwapHelperAddr,
        defaultRoute,
        defaultRouteId,
        pendingRequest,
        lastUpdate: new Date(),
      });

      setLoading(false);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch agent data:', err);
      const msg = err?.message || String(err);
      // Provide actionable error message for common contract issues
      if (msg.includes('BAD_DATA') || msg.includes('CALL_EXCEPTION') || msg.includes('could not decode')) {
        setError(
          `Contract call failed: ${msg.substring(0, 150)}. ` +
          `Check that VAULT_ADDRESS in constants.js matches your Hardhat deployment.`
        );
      } else {
        setError(msg);
      }
      setLoading(false);
    }
  }, [vault, agentAddress, userAddress]);

  // Initial fetch
  useEffect(() => {
    fetchAgentData();
  }, [fetchAgentData]);

  // Polling
  useEffect(() => {
    if (!agentAddress) return;

    const interval = setInterval(fetchAgentData, pollInterval);
    return () => clearInterval(interval);
  }, [fetchAgentData, pollInterval, agentAddress]);

  return { agentData, loading, error, refetch: fetchAgentData };
}

/**
 * useAgentsList hook
 * Loads agents list from agents.local.json
 */
export function useAgentsList() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadAgents = async () => {
      try {
        const response = await fetch('/deployments/agents.local.json');
        if (!response.ok) {
          throw new Error(`Failed to load agents: HTTP ${response.status}`);
        }
        const data = await response.json();
        setAgents(data.agents || []);
        setLoading(false);
      } catch (err) {
        console.error('Failed to load agents list:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    loadAgents();
  }, []);

  return { agents, loading, error };
}
