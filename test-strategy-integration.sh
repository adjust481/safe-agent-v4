#!/bin/bash
# Test strategy integration with loop_agent.py

set -e

cd "$(dirname "$0")/agent_py"
source .venv/bin/activate

echo "=== Strategy Integration Test ==="
echo ""

# Test 1: Import test
echo "Test 1: Verifying imports..."
python3 -c "
from strategies import build_policy, SwapIntent, list_strategies
from external_strats import SniperStrategy, OUArbStrategy
print('  ✓ All imports successful')
"

# Test 2: List strategies
echo ""
echo "Test 2: Listing available strategies..."
python3 -c "
from strategies import list_strategies
strategies = list_strategies()
print(f'  ✓ Available strategies: {strategies}')
"

# Test 3: Build policies
echo ""
echo "Test 3: Building policies..."
python3 -c "
from strategies import build_policy
sniper = build_policy('sniper', {'target_price': 1.0})
arb = build_policy('arb', {'threshold': 0.01})
arbitrage = build_policy('arbitrage', {'threshold': 0.01})
print(f'  ✓ Sniper policy: {sniper.name}')
print(f'  ✓ Arb policy: {arb.name}')
print(f'  ✓ Arbitrage policy: {arbitrage.name}')
"

# Test 4: Test with actual signals.json
echo ""
echo "Test 4: Testing with signals.json..."
python3 -c "
import json
from pathlib import Path
from strategies import build_policy

# Load signals
signals_path = Path('signals.json')
if signals_path.exists():
    with open(signals_path) as f:
        signal = json.load(f)
    print(f'  ✓ Loaded signal: best_bid={signal.get(\"best_bid\")}, best_ask={signal.get(\"best_ask\")}')

    # Test sniper
    policy = build_policy('sniper', {'target_price': 1.0, 'size': 10.0})
    ctx = {
        'signal': signal,
        'sub_balance_wei': 1000000000000000000000,
        'max_per_trade_wei': 100000000000000000000,
        'default_amount_in_wei': 100000000000000000000,
        'slippage_bps': 50,
        'agent_address': '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        'user_address': '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        'strategy_state': {}
    }
    intent = policy.decide(ctx)
    print(f'  ✓ Sniper decision: {intent.action} ({intent.reason})')

    # Test arb
    arb_policy = build_policy('arb', {'threshold': 0.01, 'size': 10.0})
    intent = arb_policy.decide(ctx)
    print(f'  ✓ Arb decision: {intent.action} ({intent.reason})')
else:
    print('  ⚠ signals.json not found, skipping')
"

# Test 5: Verify loop_agent.py can import
echo ""
echo "Test 5: Verifying loop_agent.py imports..."
python3 -c "
import sys
from pathlib import Path
sys.path.insert(0, str(Path.cwd()))

# Import loop_agent modules
from strategies import build_policy, SwapIntent
from snapshot import get_vault_snapshot
from utils import create_web3_instance, load_deployment_info

print('  ✓ loop_agent.py imports successful')
"

# Test 6: Check agents.local.json configuration
echo ""
echo "Test 6: Checking agents.local.json configuration..."
python3 -c "
import json
from pathlib import Path

config_path = Path('../deployments/agents.local.json')
if config_path.exists():
    with open(config_path) as f:
        config = json.load(f)

    agents = config.get('agents', [])
    if agents:
        agent = agents[0]
        strategy = agent.get('strategy', 'unknown')
        params = agent.get('strategyParams', {})
        print(f'  ✓ Agent strategy: {strategy}')
        print(f'  ✓ Strategy params: {params}')
    else:
        print('  ⚠ No agents configured')
else:
    print('  ⚠ agents.local.json not found')
"

echo ""
echo "✅ All integration tests passed!"
echo ""
echo "To run the agent with strategy:"
echo "  DRY_RUN=1 POLL_INTERVAL=5 python loop_agent.py"
