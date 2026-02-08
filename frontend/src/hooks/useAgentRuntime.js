import { useState, useEffect, useRef } from 'react';

/**
 * Shared base URL for the Python agent HTTP server.
 * All fetches to the Flask/http.server backend use this.
 */
export const AGENT_API_BASE = 'http://localhost:8888';

/**
 * useAgentRuntime Hook
 *
 * Polls state.json from the Python agent server.
 *
 * Returns:
 *   data           — the raw state.json object (null until first successful fetch)
 *   connected      — true after at least one successful fetch
 *   fetchError     — string error message when fetch fails (null when OK)
 *   needsApproval  — true when the agent is requesting user authorization
 *
 * Approval trigger rules (broadened):
 *   1. decision.action === 'REQUEST_PENDING'
 *   2. status contains 'APPROVAL' (e.g. 'AWAITING_APPROVAL')
 *   3. intent exists AND intent.action === 'SWAP'
 *   Any of the above → needsApproval = true
 *
 * There is NO offline gating. If data was fetched at least once, connected=true.
 * The approval modal is NEVER blocked by connection status.
 */
export function useAgentRuntime(pollInterval = 3000) {
  const [data, setData] = useState(null);
  const [connected, setConnected] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [needsApproval, setNeedsApproval] = useState(false);
  const failCount = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const fetchState = async () => {
      try {
        const response = await fetch(`${AGENT_API_BASE}/agent_py/state.json`, {
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const state = await response.json();
        if (cancelled) return;

        // Successfully fetched — mark connected, clear errors
        setData(state);
        setConnected(true);
        setFetchError(null);
        failCount.current = 0;

        // --- Approval detection (broadened) ---
        const actionIsPending = state.decision?.action === 'REQUEST_PENDING';
        const statusHasApproval =
          typeof state.status === 'string' &&
          state.status.toUpperCase().includes('APPROVAL');
        const intentIsSwap =
          state.intent != null && state.intent.action === 'SWAP';

        setNeedsApproval(actionIsPending || statusHasApproval || intentIsSwap);
      } catch (err) {
        if (cancelled) return;
        failCount.current += 1;
        // Only show error after 2 consecutive failures (avoids flicker)
        if (failCount.current >= 2) {
          setFetchError(
            `Cannot reach agent server at ${AGENT_API_BASE}. ` +
            `Make sure "python3 server.py" is running on port 8888.`
          );
        }
        // Do NOT clear data or connected — stale data is better than no data
      }
    };

    fetchState();
    const interval = setInterval(fetchState, pollInterval);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pollInterval]);

  return { data, connected, fetchError, needsApproval };
}
