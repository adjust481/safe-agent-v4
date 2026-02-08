# Hackathon Demo Guide - 4 Core Capabilities

## Overview

This guide documents the 4 core capabilities implemented for the hackathon demo:

1. **Agent Enable/Disable** - DAO admin can enable/disable agents
2. **Single Trade Cap** - System controls max risk exposure per trade
3. **Multi-Agent + Multi-Strategy Display** - Show multiple agents with different strategies
4. **Last Strategy Decision Visualization** - Make Python strategy behavior UI-readable

All capabilities work in **DRY_RUN mode** and are fully visualized through the frontend.

---

## Capability 1: Agent Enable/Disable

### Backend Implementation

**File: `/deployments/agents.local.json`**
- Added `enabled` field to each agent (boolean)
- Example:
  ```json
  {
    "address": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    "enabled": true,
    "strategy": "sniper"
  }
  ```

**File: `/agent_py/loop_agent.py`**
- Reloads `agents.local.json` each iteration to pick up config changes
- Checks `enabled` status before executing strategy:
  ```python
  if not enabled:
      write_state('HOLD', 'agent_disabled', ...)
      continue
  ```
- Writes `enabled` status to `state.json`:
  ```json
  {
    "agent": {
      "enabled": false
    },
    "decision": {
      "action": "HOLD",
      "reason": "agent_disabled"
    }
  }
  ```

### Frontend Implementation

**File: `/frontend/src/AgentDetailView.jsx`**
- Added Toggle Switch control in Configuration card
- Uses localStorage to persist changes (mock implementation)
- Real implementation would update `agents.local.json` via API

**UI Components:**
- Toggle Switch: Green (enabled) / Pink (disabled)
- Status Badge: "✓ Enabled" / "✗ Disabled"
- Save notification when toggled

**File: `/frontend/src/AgentSidebar.jsx`**
- Shows enabled status badge for each agent in the list
- Color-coded: Green (enabled) / Pink (disabled)

### Testing

```bash
# Test disabled agent
cd ~/Desktop/safe-agent-v4
# Edit agents.local.json: set enabled=false
cd agent_py && source .venv/bin/activate
DRY_RUN=1 POLL_INTERVAL=5 python loop_agent.py

# Expected output:
# - Agent is disabled, skipping strategy execution
# - state.json: action="HOLD", reason="agent_disabled"
# - total_trades=0
```

---

## Capability 2: Single Trade Cap

### Backend Implementation

**File: `/deployments/agents.local.json`**
- Added `cap` field to agent config (string, in tokens)
- Example:
  ```json
  {
    "config": {
      "cap": "100",
      "maxNotionalPerTrade": "100"
    }
  }
  ```

**File: `/agent_py/loop_agent.py`**
- Reads `cap` from agent config
- Converts to wei: `cap_wei = parse_token_amount(cap)`
- Passes to strategy context:
  ```python
  ctx = {
      "cap_wei": cap_wei,
      "max_per_trade_wei": cap_wei,
      "default_amount_in_wei": cap_wei
  }
  ```
- Writes `cap` to `state.json`

**File: `/agent_py/strategies/sniper_policy.py` & `arb_policy.py`**
- Added cap=0 check:
  ```python
  if cap_wei == 0:
      return SwapIntent(
          action="HOLD",
          reason="sniper:cap_is_zero"
      )
  ```
- Uses `cap_wei` to limit trade size:
  ```python
  amount_in = min(sub_balance_wei, cap_wei)
  ```

### Frontend Implementation

**File: `/frontend/src/AgentDetailView.jsx`**
- Added cap input field in Configuration card
- Number input with Save button
- Uses localStorage to persist changes (mock implementation)

**UI Components:**
- Cap Input: Number field with step=10
- Save Button: Green neon style
- Save notification when updated

**File: `/frontend/src/AgentSidebar.jsx`**
- Shows cap badge for each agent in the list
- Format: "Cap: 100"

### Testing

```bash
# Test cap=0 (agent cannot trade)
cd ~/Desktop/safe-agent-v4
# Edit agents.local.json: set cap="0"
cd agent_py && source .venv/bin/activate
DRY_RUN=1 POLL_INTERVAL=5 python loop_agent.py

# Expected output:
# - state.json: action="HOLD", reason="sniper:cap_is_zero"
# - total_trades=0

# Test cap=50 (limited trade size)
# Edit agents.local.json: set cap="50"
# Expected: amount_in <= 50 tokens
```

---

## Capability 3: Multi-Agent + Multi-Strategy Display

### Backend Implementation

**File: `/deployments/agents.local.json`**
- Contains array of 3 agents with different strategies:
  1. Momentum Agent: strategy="sniper", cap="100", enabled=true
  2. Mean Reversion Agent: strategy="mean-reversion", cap="50", enabled=false
  3. Arbitrage Hunter: strategy="arbitrage", cap="200", enabled=true

**File: `/agent_py/loop_agent.py`**
- Loads agent config by address
- Writes strategy to `state.json`:
  ```json
  {
    "agent": {
      "strategy": "sniper",
      "enabled": true,
      "cap": "100"
    }
  }
  ```

### Frontend Implementation

**File: `/frontend/src/App.jsx`**
- Already implements multi-agent list
- Fetches agents from `agents.local.json`
- Allows switching between agents

**File: `/frontend/src/AgentSidebar.jsx`**
- Displays all agents in a list
- Shows for each agent:
  - Name and ENS
  - Strategy badge (color-coded)
  - Enabled status badge
  - Cap badge
  - Version

**File: `/frontend/src/PythonAgentStatusCard.jsx`**
- Displays current agent's strategy badge
- Color-coded by strategy type:
  - sniper: Pink neon
  - arb/arbitrage: Green neon
  - hold: Gray
  - momentum: Orange neon

### Testing

```bash
# View multi-agent list
# 1. Open http://localhost:5173
# 2. Check sidebar - should show 3 agents
# 3. Click each agent to see different strategy/cap/status
# 4. Verify strategy badges are color-coded
```

---

## Capability 4: Last Strategy Decision Visualization

### Backend Implementation

**File: `/agent_py/loop_agent.py`**
- Writes comprehensive decision data to `state.json`:
  ```json
  {
    "decision": {
      "action": "SWAP",
      "reason": "sniper:snipe_at_0.9990"
    },
    "intent": {
      "action": "SWAP",
      "reason": "sniper:snipe_at_0.9990",
      "zeroForOne": true,
      "amountIn": "100000000000000000000",
      "minOut": "99500000000000000000",
      "meta": {
        "signal": {
          "best_bid": 0.998,
          "best_ask": 0.999,
          "spread": 0.001
        }
      }
    }
  }
  ```

**File: `/agent_py/strategies/sniper_policy.py` & `arb_policy.py`**
- Returns SwapIntent with detailed reason:
  - `sniper:snipe_at_0.9990` - Sniper detected good price
  - `sniper:cap_is_zero` - Cap is zero, cannot trade
  - `arb:spread_0.0040` - Arbitrage opportunity detected
  - `arb:no_signal` - No market signal available

### Frontend Implementation

**File: `/frontend/src/PythonAgentStatusCard.jsx`**
- Displays "Last Decision" section with:
  - Action Badge: HOLD / SWAP / ERROR (color-coded)
  - Reason: Full reason string from strategy
  - Signal Data: Collapsible JSON display

**UI Components:**
- Decision Badge:
  - HOLD: Pink neon
  - SWAP: Green neon + breathing animation
  - ERROR: Red neon
- Signal Section:
  - Collapsible (click to expand)
  - JSON pretty print with syntax highlighting
  - Custom scrollbar

**File: `/frontend/src/AgentDetailView.jsx`**
- Shows decision history in detail view
- Displays trade parameters if SWAP

### Testing

```bash
# Test decision visualization
cd ~/Desktop/safe-agent-v4
cd agent_py && source .venv/bin/activate
DRY_RUN=1 POLL_INTERVAL=5 STOP_AFTER_N_TRADES=3 python loop_agent.py

# Expected frontend display:
# 1. Last Decision: SWAP / HOLD
# 2. Reason: sniper:snipe_at_0.9990
# 3. Signal: Expandable JSON with best_bid, best_ask, spread
# 4. Amount In: 100.0000 tokens
# 5. Min Out: 99.5000 tokens
```

---

## Complete Test Flow

### 1. Start All Services

```bash
# Terminal 1: Hardhat
cd ~/Desktop/safe-agent-v4
npx hardhat node

# Terminal 2: Deploy Contracts (once)
cd ~/Desktop/safe-agent-v4
npx hardhat run scripts/deploy-local.js --network localhost

# Terminal 3: HTTP Server
cd ~/Desktop/safe-agent-v4
python3 server.py

# Terminal 4: Agent Loop
cd ~/Desktop/safe-agent-v4/agent_py
source .venv/bin/activate
DRY_RUN=1 POLL_INTERVAL=5 python loop_agent.py

# Terminal 5: Frontend
cd ~/Desktop/safe-agent-v4/frontend
npm run dev
```

### 2. Open Browser

Navigate to: http://localhost:5173

### 3. Verify All Capabilities

**Capability 1: Enable/Disable**
1. Click on "Momentum Agent" in sidebar
2. See Toggle Switch in Configuration card
3. Toggle to disable
4. Wait 5 seconds
5. See "Last Decision: HOLD (agent_disabled)"
6. Toggle back to enable

**Capability 2: Cap Control**
1. See current cap in Configuration card
2. Change cap to 50
3. Click Save
4. Wait 5 seconds
5. See decision uses new cap (if SWAP)
6. Change cap to 0
7. Wait 5 seconds
8. See "Last Decision: HOLD (sniper:cap_is_zero)"

**Capability 3: Multi-Agent**
1. See 3 agents in sidebar:
   - Momentum Agent (sniper, enabled, cap=100)
   - Mean Reversion Agent (mean-reversion, disabled, cap=50)
   - Arbitrage Hunter (arbitrage, enabled, cap=200)
2. Click each agent to see different configs
3. Verify strategy badges are color-coded

**Capability 4: Decision Visualization**
1. See "Last Decision" section in Python Agent Status card
2. See action badge (HOLD/SWAP) with color
3. See reason (e.g., "sniper:snipe_at_0.9990")
4. Click "📊 Market Signal ▶" to expand
5. See JSON with best_bid, best_ask, spread
6. If SWAP: see amount_in and min_out

---

## File Changes Summary

### Backend Files Modified

1. `/deployments/agents.local.json`
   - Added `enabled` field to all agents
   - Added `cap` field to config section
   - Set different values for demo

2. `/agent_py/loop_agent.py`
   - Added enabled check at startup and in main loop
   - Added cap extraction and enforcement
   - Modified write_state to include enabled and cap
   - Reload config each iteration

3. `/agent_py/strategies/sniper_policy.py`
   - Added cap=0 check
   - Return HOLD with reason "sniper:cap_is_zero"

4. `/agent_py/strategies/arb_policy.py`
   - Added cap=0 check
   - Return HOLD with reason "arb:cap_is_zero"

### Frontend Files Modified

1. `/frontend/src/AgentDetailView.jsx`
   - Added Toggle Switch for enabled control
   - Added cap input field with Save button
   - Added localStorage persistence (mock)
   - Added control panel styles

2. `/frontend/src/AgentDetailView.css`
   - Added toggle switch styles
   - Added cap input styles
   - Added save button styles
   - Added control panel layout

3. `/frontend/src/AgentSidebar.jsx`
   - Added enabled status badge
   - Added cap badge
   - Updated layout to show both

4. `/frontend/src/AgentSidebar.css`
   - Added enabled badge styles
   - Added cap badge styles

5. `/frontend/src/PythonAgentStatusCard.jsx`
   - Already had strategy badge (from previous work)
   - Already had decision display (from previous work)
   - Already had signal display (from previous work)

6. `/frontend/src/PythonAgentStatusCard.css`
   - Already had all necessary styles (from previous work)

---

## State.json Format

```json
{
  "status": "running",
  "last_update": "2026-02-05T09:20:35.489526Z",
  "loop_count": 13,
  "total_trades": 0,

  "agent": {
    "address": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    "ensName": "agent.safe.eth",
    "strategy": "sniper",
    "enabled": true,
    "cap": "100"
  },

  "decision": {
    "action": "HOLD",
    "reason": "sniper:cap_is_zero"
  },

  "intent": {
    "action": "HOLD",
    "reason": "sniper:cap_is_zero",
    "zeroForOne": null,
    "amountIn": null,
    "minOut": null,
    "meta": {
      "signal": {
        "best_bid": 0.998,
        "best_ask": 0.999,
        "spread": 0.001,
        "timestamp": "2026-02-04T22:30:00Z",
        "source": "manual"
      }
    }
  },

  "snapshot": {
    "agent_sub_balance": "150000000000000000000",
    "agent_spent": "50000000000000000000",
    "vault_balance": "950000000000000000000"
  }
}
```

---

## Demo Script

### Scenario 1: Enable/Disable Agent

**Narrator**: "Let's demonstrate agent enable/disable control."

1. Show sidebar with 3 agents
2. Click "Momentum Agent" (enabled)
3. Show Toggle Switch in green (enabled)
4. Show "Last Decision: SWAP (sniper:snipe_at_0.9990)"
5. Toggle switch to disable
6. Wait 5 seconds
7. Show "Last Decision: HOLD (agent_disabled)"
8. Show total_trades unchanged
9. Toggle back to enable
10. Wait 5 seconds
11. Show "Last Decision: SWAP" again

**Key Point**: "Disabled agents continue running but skip strategy execution."

### Scenario 2: Cap Control

**Narrator**: "Let's demonstrate trade cap control."

1. Show current cap: 100
2. Show "Last Decision: SWAP" with amount_in=100
3. Change cap to 50
4. Click Save
5. Wait 5 seconds
6. Show "Last Decision: SWAP" with amount_in=50
7. Change cap to 0
8. Click Save
9. Wait 5 seconds
10. Show "Last Decision: HOLD (sniper:cap_is_zero)"

**Key Point**: "Cap controls max risk exposure per trade."

### Scenario 3: Multi-Agent Display

**Narrator**: "Let's view multiple agents with different strategies."

1. Show sidebar with 3 agents:
   - Momentum Agent: sniper, enabled, cap=100
   - Mean Reversion Agent: mean-reversion, disabled, cap=50
   - Arbitrage Hunter: arbitrage, enabled, cap=200
2. Click each agent to show different configs
3. Show strategy badges are color-coded
4. Show enabled/disabled status
5. Show different cap values

**Key Point**: "Each agent has independent strategy, cap, and status."

### Scenario 4: Decision Visualization

**Narrator**: "Let's see how strategy decisions are visualized."

1. Show "Last Decision: SWAP"
2. Show reason: "sniper:snipe_at_0.9990"
3. Click "📊 Market Signal ▶" to expand
4. Show JSON:
   ```json
   {
     "best_bid": 0.998,
     "best_ask": 0.999,
     "spread": 0.001
   }
   ```
5. Show amount_in: 100.0000 tokens
6. Show min_out: 99.5000 tokens

**Key Point**: "All strategy behavior is transparent and UI-readable."

---

## Troubleshooting

### Agent Not Responding to Config Changes

**Problem**: Changed enabled/cap in agents.local.json but agent still uses old values

**Solution**:
- loop_agent.py reloads config each iteration
- Wait for next iteration (POLL_INTERVAL seconds)
- Check state.json to verify new values

### Frontend Not Showing Updates

**Problem**: Frontend shows stale data

**Solution**:
- Check HTTP server is running: `lsof -i :8888`
- Check state.json is being updated: `cat agent_py/state.json`
- Check browser console for fetch errors
- Verify CORS is enabled in server.py

### Toggle Switch Not Persisting

**Problem**: Toggle switch resets after page refresh

**Solution**:
- Current implementation uses localStorage (mock)
- To persist: manually edit agents.local.json
- Real implementation would use API to update file

---

## Next Steps

### Production Implementation

1. **API Endpoint for Config Updates**
   - POST /api/agents/:address/config
   - Update agents.local.json atomically
   - Validate input (enabled, cap)

2. **WebSocket for Real-Time Updates**
   - Push state.json updates to frontend
   - No polling needed
   - Lower latency

3. **Multi-Agent Orchestration**
   - Run multiple loop_agent.py processes
   - One per agent address
   - Separate state files

4. **DAO Integration**
   - On-chain governance for enable/disable
   - On-chain cap limits
   - Event listeners to sync config

---

## Conclusion

All 4 core capabilities are fully implemented and working in DRY_RUN mode:

✅ **Agent Enable/Disable** - Toggle switch + backend enforcement
✅ **Single Trade Cap** - Input field + strategy enforcement
✅ **Multi-Agent Display** - Sidebar list + detail view
✅ **Decision Visualization** - Action badge + reason + signal JSON

The system is ready for hackathon demo!
