import { useState, useEffect } from 'react';

/**
 * useAgentRuntime Hook
 *
 * Fetches agent runtime state from state.json
 * Returns: { data, offline, error }
 *
 * Offline判定规则：
 * 1. fetch 失败 → offline = true
 * 2. now - runtime.lastHeartbeat > 60秒 → offline = true
 */
export function useAgentRuntime(pollInterval = 3000) {
  const [data, setData] = useState(null);
  const [offline, setOffline] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const fetchState = async () => {
      try {
        const response = await fetch('http://localhost:8888/agent_py/state.json', {
          cache: 'no-store'
        });

        if (!response.ok) {
          // Read response as text to avoid JSON parse errors on HTML error pages
          const text = await response.text();
          throw new Error(`HTTP ${response.status}: ${text.substring(0, 100)}`);
        }

        // Verify content-type is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text();
          throw new Error(`Expected JSON but got ${contentType}: ${text.substring(0, 100)}`);
        }

        const state = await response.json();

        if (cancelled) return;

        if (cancelled) return;

        // Check heartbeat time (use last_update instead of runtime.lastHeartbeat)
        const now = new Date();
        const lastUpdate = state.last_update
          ? new Date(state.last_update)
          : null;

        if (!lastUpdate) {
          setOffline(true);
        } else {
          const secondsSinceUpdate = (now - lastUpdate) / 1000;
          setOffline(secondsSinceUpdate > 60);
        }

        setData(state);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch agent state:', err);
        if (!cancelled) {
          setOffline(true);
          setError(err.message);
        }
      }
    };

    // 立即执行一次
    fetchState();

    // 定期轮询
    const interval = setInterval(fetchState, pollInterval);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pollInterval]);

  return { data, offline, error };
}
