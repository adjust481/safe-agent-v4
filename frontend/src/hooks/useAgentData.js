/**
 * useAgentData.js
 *
 * Custom hook for polling agent data from blockchain
 * - Fetches agent balances, config, and route info
 * - Polls every 2 seconds
 * - Returns loading state and error handling
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
      // Query balances
      const userBalance = await vault.balances(userAddress);
      const agentSubBalance = await vault.agentBalances(userAddress, agentAddress);
      const agentSpentAmount = await vault.agentSpent(userAddress, agentAddress);

      // Query agent config (defensive - only access first 3 fields)
      const cfg = await vault.agentConfigs(agentAddress);
      const agentConfig = {
        enabled: cfg?.[0] ?? false,
        ensNode: cfg?.[1] ? ethers.hexlify(cfg[1]) : '0x0000000000000000000000000000000000000000000000000000000000000000',
        maxNotionalPerTrade: cfg?.[2] ?? 0n,
      };

      // Query poolSwapHelper
      const poolSwapHelperAddr = await vault.poolSwapHelper();

      // Query default route (defensive - access by index)
      const defaultRouteId = await vault.defaultRouteId();
      const route = await vault.routes(defaultRouteId);
      const defaultRoute = {
        token0: route?.[0] ?? ethers.ZeroAddress,
        token1: route?.[1] ?? ethers.ZeroAddress,
        fee: route?.[2] ?? 0,
        pool: route?.[3] ?? ethers.ZeroAddress,
        enabled: route?.[4] ?? false,
      };

      // Query pending execution request
      const req = await vault.pendingRequest();
      const pendingRequest = {
        agent: req?.[0] ?? ethers.ZeroAddress,
        amount: req?.[1] ?? 0n,
        zeroForOne: req?.[2] ?? false,
        approved: req?.[3] ?? false,
        executed: req?.[4] ?? false,
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
      setError(err.message);
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
