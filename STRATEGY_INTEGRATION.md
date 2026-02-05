# Strategy Module Integration - Complete Guide

## 📁 Directory Structure

```
agent_py/
├── strategies/              # Strategy adapters (OrderInstruction -> SwapIntent)
│   ├── __init__.py
│   ├── types.py            # SwapIntent data structure
│   ├── base.py             # BasePolicy abstract class
│   ├── registry.py         # Strategy factory (build_policy)
│   ├── sniper_policy.py    # Sniper adapter
│   └── arb_policy.py       # Arbitrage adapter
│
├── external_strats/         # Original strategy implementations
│   ├── __init__.py
│   ├── base.py             # BaseStrategy, MarketData, OrderInstruction
│   ├── sniper.py           # SniperStrategy
│   └── ou_arb.py           # OUArbStrategy
│
├── loop_agent.py           # Main agent loop (modified)
├── snapshot.py             # Vault state snapshot
├── utils.py                # Web3 utilities
├── policy.py               # Old policy (deprecated)
├── state.json              # Runtime state (auto-generated)
└── signals.json            # Market signals (optional)
```

---

## 🎯 Architecture Overview

### 1. External Strategies (external_strats/)
- **Purpose**: Original strategy logic (sniper, ou_arb)
- **Input**: `MarketData` (best_bid, best_ask, extra)
- **Output**: `List[OrderInstruction]` (side, size, price, meta)
- **Units**: Token units (float), not wei

### 2. Strategy Adapters (strategies/)
- **Purpose**: Convert OrderInstruction -> SwapIntent
- **Input**: Context dict (signal, balances, slippage, etc.)
- **Output**: `SwapIntent` (action, reason, zero_for_one, amount_in, min_amount_out)
- **Units**: Wei (int) for on-chain execution

### 3. Main Loop (loop_agent.py)
- **Purpose**: Orchestrate strategy execution
- **Flow**:
  1. Load agents.local.json → get strategy name
  2. Build policy from strategy name
  3. Get vault snapshot (on-chain state)
  4. Load signals (optional market data)
  5. Build context dict
  6. Call policy.decide(ctx) → SwapIntent
  7. Execute swap (if SWAP) or hold (if HOLD)
  8. Write state.json (always, even for HOLD)

---

## 📝 Modified/New Files

### New Files Created:
1. `agent_py/strategies/__init__.py`
2. `agent_py/strategies/types.py`
3. `agent_py/strategies/base.py`
4. `agent_py/strategies/registry.py`
5. `agent_py/strategies/sniper_policy.py`
6. `agent_py/strategies/arb_policy.py`
7. `agent_py/external_strats/__init__.py`
8. `agent_py/external_strats/base.py`
9. `agent_py/external_strats/sniper.py`
10. `agent_py/external_strats/ou_arb.py`
11. `agent_py/signals.json` (example)

### Modified Files:
1. `agent_py/loop_agent.py` - Integrated strategy module

---

## 🚀 Running the Agent

### Step 1: Start Hardhat Node
```bash
cd ~/Desktop/safe-agent-v4
npx hardhat node
```

### Step 2: Deploy Contracts
```bash
# In a new terminal
cd ~/Desktop/safe-agent-v4
TMPDIR=~/hh-tmp npx hardhat run scripts/demoAgent.js --network localhost
./sync-frontend.sh
```

### Step 3: Run Agent with Strategy
```bash
# In a new terminal
cd ~/Desktop/safe-agent-v4/agent_py
source .venv/bin/activate

# Run with sniper strategy (DRY_RUN mode)
DRY_RUN=1 POLL_INTERVAL=5 python loop_agent.py
```

---

## 📊 Expected Output

### Console Output:
```
=== Agent Loop Started ===

Connected to network (chainId: 31337)
Agent address: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
User address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Strategy: momentum
Mode: DRY_RUN
Poll interval: 5s
State file: /Users/adjust/Desktop/safe-agent-v4/agent_py/state.json
Slippage: 50 bps

--- Iteration 1 (trades executed: 0) ---
Agent sub-balance: 1000.0000 tokens
Agent spent: 0.0000 tokens
Decision: HOLD
Reason: momentum:no_signal

Holding position.
  [State written to /Users/adjust/Desktop/safe-agent-v4/agent_py/state.json]

Sleeping for 5s...
```

### state.json Output:
```json
{
  "status": "running",
  "last_update": "2026-02-03T22:00:00Z",
  "runtime": {
    "lastHeartbeat": "2026-02-03T22:00:00Z",
    "iteration": 1,
    "mode": "DRY_RUN"
  },
  "decision": {
    "action": "HOLD",
    "reason": "momentum:no_signal"
  },
  "agent": {
    "address": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    "ensName": "momentum.safe.eth",
    "strategy": "momentum"
  },
  "intent": {
    "action": "HOLD",
    "reason": "momentum:no_signal",
    "zero_for_one": null,
    "amount_in": null,
    "min_amount_out": null,
    "meta": {"signal": {}}
  },
  "pnlHistory": [],
  "logs": [
    {
      "ts": "2026-02-03T22:00:00Z",
      "level": "INFO",
      "msg": "Agent started in DRY_RUN mode with strategy=momentum"
    },
    {
      "ts": "2026-02-03T22:00:05Z",
      "level": "INFO",
      "msg": "Iteration 1 HOLD (momentum:no_signal)"
    }
  ]
}
```

---

## 🔧 Configuration

### agents.local.json Structure:
```json
{
  "agents": [
    {
      "address": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      "name": "Momentum Agent",
      "ensName": "momentum.safe.eth",
      "strategy": "momentum",
      "strategyParams": {
        "lookbackPeriod": 60,
        "signalThreshold": 0.05
      },
      "config": {
        "maxNotionalPerTrade": "100",
        "slippageTolerance": 0.5
      }
    }
  ]
}
```

### Changing Strategy:
To use sniper strategy, modify `agents.local.json`:
```json
{
  "strategy": "sniper",
  "strategyParams": {
    "target_price": 0.999,
    "size": 10.0
  }
}
```

To use arbitrage strategy:
```json
{
  "strategy": "arb",
  "strategyParams": {
    "threshold": 0.01,
    "size": 10.0
  }
}
```

---

## 🧪 Testing Different Strategies

### Test 1: Sniper Strategy
```bash
# Edit deployments/agents.local.json, set strategy="sniper"
# Run agent
DRY_RUN=1 POLL_INTERVAL=5 python agent_py/loop_agent.py
```

**Expected**: HOLD (no signal by default)

### Test 2: Sniper with Signal
```bash
# Edit agent_py/signals.json:
{
  "best_bid": 0.998,
  "best_ask": 0.999,
  "timestamp": "2026-02-03T22:00:00Z"
}

# Run agent with target_price=1.0
DRY_RUN=1 POLL_INTERVAL=5 python agent_py/loop_agent.py
```

**Expected**: SWAP (best_ask <= target_price)

### Test 3: Arbitrage Strategy
```bash
# Edit deployments/agents.local.json, set strategy="arb"
# Edit agent_py/signals.json:
{
  "best_bid": 0.990,
  "best_ask": 1.010,
  "spread": 0.020
}

# Run agent with threshold=0.01
DRY_RUN=1 POLL_INTERVAL=5 python agent_py/loop_agent.py
```

**Expected**: SWAP (spread > threshold)

---

## 🔍 Verification Checklist

### ✅ File Structure
- [ ] `agent_py/strategies/` directory exists
- [ ] `agent_py/external_strats/` directory exists
- [ ] All 11 new files created
- [ ] `loop_agent.py` modified

### ✅ Functionality
- [ ] Agent starts without errors
- [ ] Strategy loaded from agents.local.json
- [ ] state.json written every iteration
- [ ] state.json contains `decision`, `intent`, `agent.strategy`
- [ ] DRY_RUN=1 does not execute transactions
- [ ] HOLD decision works
- [ ] SWAP decision works (with appropriate signal)

### ✅ Integration
- [ ] No import errors
- [ ] Strategies can be swapped by editing config
- [ ] signals.json optional (defaults to empty dict)
- [ ] Frontend can read state.json

---

## 📚 API Reference

### SwapIntent
```python
@dataclass
class SwapIntent:
    action: str              # "HOLD" or "SWAP"
    reason: str              # Human-readable explanation
    zero_for_one: bool       # True = token0->token1 (only for SWAP)
    amount_in: int           # Amount in wei (only for SWAP)
    min_amount_out: int      # Min output in wei (only for SWAP)
    meta: Dict[str, Any]     # Additional metadata
```

### BasePolicy
```python
class BasePolicy(ABC):
    @abstractmethod
    def decide(self, ctx: Dict[str, Any]) -> SwapIntent:
        """
        Make trading decision.

        Args:
            ctx: {
                "signal": dict,
                "sub_balance_wei": int,
                "max_per_trade_wei": int,
                "default_amount_in_wei": int,
                "slippage_bps": int,
                "agent_address": str,
                "user_address": str,
                "strategy_state": dict
            }

        Returns:
            SwapIntent
        """
        pass
```

### build_policy()
```python
def build_policy(name: str, params: Dict[str, Any] = None) -> Optional[BasePolicy]:
    """
    Build policy by name.

    Args:
        name: "sniper", "arb", "momentum", etc.
        params: Strategy parameters

    Returns:
        BasePolicy instance or None
    """
```

---

## 🎓 Adding New Strategies

### Step 1: Create External Strategy
```python
# agent_py/external_strats/my_strategy.py
from .base import BaseStrategy, MarketData, OrderInstruction

class MyStrategy(BaseStrategy):
    def evaluate(self, market: MarketData, state: dict) -> list:
        # Your logic here
        if market.best_ask < 1.0:
            return [OrderInstruction("BUY", 10.0, market.best_ask, {})]
        return []
```

### Step 2: Create Adapter
```python
# agent_py/strategies/my_policy.py
from .base import BasePolicy
from .types import SwapIntent
from external_strats.my_strategy import MyStrategy

class MyPolicy(BasePolicy):
    def __init__(self, params=None):
        super().__init__(name="my_strategy", params=params)
        self.strategy = MyStrategy(params)

    def decide(self, ctx):
        # Adapt OrderInstruction -> SwapIntent
        # (similar to sniper_policy.py)
        pass
```

### Step 3: Register Strategy
```python
# agent_py/strategies/registry.py
from .my_policy import MyPolicy

STRATEGY_REGISTRY = {
    "sniper": SniperPolicy,
    "arb": ArbPolicy,
    "my_strategy": MyPolicy,  # Add here
}
```

### Step 4: Configure Agent
```json
{
  "strategy": "my_strategy",
  "strategyParams": {
    "param1": "value1"
  }
}
```

---

## 🐛 Troubleshooting

### Error: ModuleNotFoundError: No module named 'strategies'
**Solution**: Ensure you're running from `agent_py/` directory or add to PYTHONPATH:
```bash
cd ~/Desktop/safe-agent-v4/agent_py
python loop_agent.py
```

### Error: Unknown strategy 'xxx'
**Solution**: Check `agents.local.json` strategy name matches registry:
- Valid: "sniper", "arb", "arbitrage"
- Invalid: "Sniper", "SNIPER", "momentum" (not implemented yet)

### Warning: Agents config not found
**Solution**: Ensure `deployments/agents.local.json` exists and has correct structure

### state.json not updating
**Solution**: Check STATE_PATH is writable and agent has permissions

---

## 🎉 Summary

✅ **Modular architecture**: Strategies are hot-pluggable
✅ **Unified interface**: All strategies output SwapIntent
✅ **Adapter pattern**: Original strategies preserved
✅ **DRY_RUN support**: Always writes state.json
✅ **Dynamic loading**: Strategy selected from config
✅ **Minimal changes**: Existing contracts/tests unchanged

**Next Steps**:
1. Replace placeholder strategies with actual sniper.py/ou_arb.py
2. Add more strategies (momentum, mean-reversion, etc.)
3. Implement signal generation (Prompt 2)
4. Add strategy backtesting framework
