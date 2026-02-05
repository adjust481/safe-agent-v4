/**
 * useSwapHistory.js
 *
 * Custom hook for fetching and managing swap history with pagination
 * - Fetches AgentSwapExecuted events by block range
 * - Supports pagination (2000 blocks per page)
 * - Filters by agent, user, pool
 * - Sorts by blockNumber or timestamp
 */

import { useState, useEffect, useCallback } from 'react';

const BLOCKS_PER_PAGE = 2000;

export function useSwapHistory(vault, initialFromBlock = 'latest') {
  const [swaps, setSwaps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentFromBlock, setCurrentFromBlock] = useState(null);
  const [currentToBlock, setCurrentToBlock] = useState(null);

  // Filters
  const [filters, setFilters] = useState({
    agent: null,
    user: null,
    pool: null,
  });

  // Sorting
  const [sortBy, setSortBy] = useState('blockNumber'); // 'blockNumber' or 'timestamp'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc'

  // Fetch initial swaps
  const fetchInitialSwaps = useCallback(async () => {
    if (!vault) return;

    setLoading(true);
    setError(null);

    try {
      const provider = vault.provider;
      const latestBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, latestBlock - BLOCKS_PER_PAGE);
      const toBlock = latestBlock;

      console.log(`Fetching swaps from block ${fromBlock} to ${toBlock}`);

      const filter = vault.filters.AgentSwapExecuted();
      const events = await vault.queryFilter(filter, fromBlock, toBlock);

      // Parse events with block timestamps
      const parsedSwaps = await Promise.all(
        events.map(async (e) => {
          const block = await provider.getBlock(e.blockNumber);
          return {
            blockNumber: e.blockNumber,
            timestamp: block.timestamp,
            txHash: e.transactionHash,
            agent: e.args.agent,
            user: e.args.user,
            ensNode: e.args.ensNode,
            routeId: e.args.routeId,
            pool: e.args.pool,
            zeroForOne: e.args.zeroForOne,
            amountIn: e.args.amountIn,
            amountOut: e.args.amountOut,
          };
        })
      );

      setSwaps(parsedSwaps);
      setCurrentFromBlock(fromBlock);
      setCurrentToBlock(toBlock);
      setHasMore(fromBlock > 0);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch swap history:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [vault]);

  // Load more (earlier) swaps
  const loadMore = useCallback(async () => {
    if (!vault || !hasMore || loading || currentFromBlock === null) return;

    setLoading(true);
    setError(null);

    try {
      const provider = vault.provider;
      const newToBlock = currentFromBlock - 1;
      const newFromBlock = Math.max(0, newToBlock - BLOCKS_PER_PAGE);

      console.log(`Loading more swaps from block ${newFromBlock} to ${newToBlock}`);

      const filter = vault.filters.AgentSwapExecuted();
      const events = await vault.queryFilter(filter, newFromBlock, newToBlock);

      // Parse events with block timestamps
      const parsedSwaps = await Promise.all(
        events.map(async (e) => {
          const block = await provider.getBlock(e.blockNumber);
          return {
            blockNumber: e.blockNumber,
            timestamp: block.timestamp,
            txHash: e.transactionHash,
            agent: e.args.agent,
            user: e.args.user,
            ensNode: e.args.ensNode,
            routeId: e.args.routeId,
            pool: e.args.pool,
            zeroForOne: e.args.zeroForOne,
            amountIn: e.args.amountIn,
            amountOut: e.args.amountOut,
          };
        })
      );

      setSwaps((prev) => [...prev, ...parsedSwaps]);
      setCurrentFromBlock(newFromBlock);
      setHasMore(newFromBlock > 0);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load more swaps:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [vault, hasMore, loading, currentFromBlock]);

  // Apply filters
  const filteredSwaps = swaps.filter((swap) => {
    if (filters.agent && swap.agent.toLowerCase() !== filters.agent.toLowerCase()) {
      return false;
    }
    if (filters.user && swap.user.toLowerCase() !== filters.user.toLowerCase()) {
      return false;
    }
    if (filters.pool && swap.pool.toLowerCase() !== filters.pool.toLowerCase()) {
      return false;
    }
    return true;
  });

  // Apply sorting
  const sortedSwaps = [...filteredSwaps].sort((a, b) => {
    let compareValue = 0;

    if (sortBy === 'blockNumber') {
      compareValue = a.blockNumber - b.blockNumber;
    } else if (sortBy === 'timestamp') {
      compareValue = a.timestamp - b.timestamp;
    }

    return sortOrder === 'asc' ? compareValue : -compareValue;
  });

  // Get unique agents, users, pools for filter dropdowns
  const uniqueAgents = [...new Set(swaps.map((s) => s.agent))];
  const uniqueUsers = [...new Set(swaps.map((s) => s.user))];
  const uniquePools = [...new Set(swaps.map((s) => s.pool))];

  // Initial fetch
  useEffect(() => {
    fetchInitialSwaps();
  }, [fetchInitialSwaps]);

  return {
    swaps: sortedSwaps,
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
    refetch: fetchInitialSwaps,
  };
}

/**
 * Aggregate swaps data for charting
 * Groups by time interval (minute or hour)
 */
export function aggregateSwapsForChart(swaps, intervalMinutes = 60) {
  if (swaps.length === 0) return [];

  // Group by time interval
  const groups = {};

  swaps.forEach((swap) => {
    const timestamp = swap.timestamp * 1000; // Convert to milliseconds
    const intervalMs = intervalMinutes * 60 * 1000;
    const intervalKey = Math.floor(timestamp / intervalMs) * intervalMs;

    if (!groups[intervalKey]) {
      groups[intervalKey] = {
        timestamp: intervalKey,
        sumAmountIn: 0n,
        sumAmountOut: 0n,
        countTrades: 0,
      };
    }

    groups[intervalKey].sumAmountIn += swap.amountIn;
    groups[intervalKey].sumAmountOut += swap.amountOut;
    groups[intervalKey].countTrades += 1;
  });

  // Convert to array and sort by timestamp
  return Object.values(groups)
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((group) => ({
      timestamp: group.timestamp,
      time: new Date(group.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      sumAmountIn: Number(group.sumAmountIn) / 1e18, // Convert to float
      sumAmountOut: Number(group.sumAmountOut) / 1e18,
      countTrades: group.countTrades,
    }));
}
