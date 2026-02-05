"""
Main agent loop with modular strategy support.

Polls vault state periodically and executes swaps based on strategy decisions.
Supports DRY_RUN mode, STOP_AFTER_N_TRADES limit, and dynamic strategy loading.
"""
import os
import sys
import time
import json
from pathlib import Path
from datetime import datetime
from utils import (
    create_web3_instance,
    load_deployment_info,
    get_vault_contract,
    get_agent_account,
    parse_token_amount,
    format_token_amount
)
from snapshot import get_vault_snapshot
from strategies import build_policy, SwapIntent

# ========== 全局状态 ==========
PNL = 0.0
PNL_HISTORY = []
LOGS = []

# Project root directory (independent of cwd)
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Absolute path to state file (anchored to project root)
STATE_FILE = PROJECT_ROOT / "agent_py" / "state.json"

# Path to agents configuration
AGENTS_CONFIG_PATH = PROJECT_ROOT / "deployments" / "agents.local.json"

# Path to signals file (optional, for future use)
SIGNALS_PATH = PROJECT_ROOT / "agent_py" / "signals.json"

# Limits
MAX_LOGS = 80
MAX_PNL_HISTORY = 200


def add_log(level, msg):
    """Add log entry and maintain size limit."""
    global LOGS
    now = datetime.utcnow().isoformat() + "Z"
    LOGS.append({
        "ts": now,
        "level": level,
        "msg": msg
    })
    # Keep only last MAX_LOGS entries
    if len(LOGS) > MAX_LOGS:
        LOGS = LOGS[-MAX_LOGS:]


def update_pnl(delta):
    """Update PnL and history."""
    global PNL, PNL_HISTORY
    PNL += delta
    now = datetime.utcnow().isoformat() + "Z"
    PNL_HISTORY.append({
        "timestamp": now,
        "pnl": round(PNL, 4)
    })
    # Keep only last MAX_PNL_HISTORY entries
    if len(PNL_HISTORY) > MAX_PNL_HISTORY:
        PNL_HISTORY = PNL_HISTORY[-MAX_PNL_HISTORY:]


def load_agents_config():
    """
    Load agents configuration from deployments/agents.local.json.

    Returns:
        dict: Agents configuration with 'agents' list
    """
    if not AGENTS_CONFIG_PATH.exists():
        print(f"  [Warning: Agents config not found at {AGENTS_CONFIG_PATH}]")
        return {"agents": []}

    try:
        with open(AGENTS_CONFIG_PATH, 'r') as f:
            config = json.load(f)
        return config
    except Exception as e:
        print(f"  [Warning: Failed to load agents config: {e}]")
        return {"agents": []}


def load_signals():
    """
    Load market signals from signals.json (optional).

    Returns:
        tuple: (signal_dict, error_message or None)
    """
    if not SIGNALS_PATH.exists():
        return {}, None

    try:
        with open(SIGNALS_PATH, 'r') as f:
            signals = json.load(f)
        return signals, None
    except json.JSONDecodeError as e:
        error_msg = f"signals.json parse error: {str(e)}"
        print(f"  [Warning: {error_msg}]")
        return {}, error_msg
    except Exception as e:
        error_msg = f"Failed to load signals: {str(e)}"
        print(f"  [Warning: {error_msg}]")
        return {}, error_msg


def find_agent_config(agents_config, agent_address):
    """
    Find agent configuration by address.

    Args:
        agents_config: Agents configuration dict
        agent_address: Agent address to find

    Returns:
        dict: Agent configuration or default config
    """
    agents = agents_config.get("agents", [])

    # Try to find matching agent
    for agent in agents:
        if agent.get("address", "").lower() == agent_address.lower():
            return agent

    # Return default config if not found
    print(f"  [Warning: Agent {agent_address} not found in config, using defaults]")
    return {
        "address": agent_address,
        "strategy": "hold",
        "ensName": "agent.safe.eth",
        "config": {
            "slippageTolerance": 0.5,
            "maxNotionalPerTrade": "100"
        }
    }


def write_state(action, reason, snapshot, trade_count, iteration, agent_config, mode, intent=None, last_trade=None, error=None):
    """
    Write current agent state to state.json (frontend-compatible format).
    Uses atomic write (tmp file + rename) to prevent partial reads.

    Args:
        action: 'HOLD', 'SWAP', or 'ERROR'
        reason: Decision reason string
        snapshot: Vault snapshot dict
        trade_count: Total trades executed
        iteration: Current iteration number
        agent_config: Agent configuration dict (from agents.local.json)
        mode: 'DRY_RUN' or 'LIVE'
        intent: Optional SwapIntent object
        last_trade: Optional dict with trade details
        error: Optional error message
    """
    now = datetime.utcnow().isoformat() + "Z"

    # Build minimal state structure for frontend
    state = {
        "status": "running",
        "last_update": now,
        "loop_count": iteration,
        "total_trades": trade_count,

        "agent": {
            "address": agent_config.get("address", "unknown"),
            "ensName": agent_config.get("ensName", "agent.safe.eth"),
            "strategy": agent_config.get("strategy", "unknown"),
            "enabled": agent_config.get("enabled", True),
            "cap": agent_config.get("config", {}).get("cap", "100")
        },

        "decision": {
            "action": action,
            "reason": reason
        },

        "snapshot": {
            "agent_sub_balance": str(snapshot['agent_sub_balance']),
            "agent_spent": str(snapshot['agent_spent']),
            "vault_balance": str(snapshot['vault_balance'])
        }
    }

    # Add optional fields only if present
    if intent:
        state["intent"] = {
            "action": intent.action,
            "reason": intent.reason,
            "zeroForOne": intent.zero_for_one,
            "amountIn": str(intent.amount_in) if intent.amount_in is not None else None,
            "minOut": str(intent.min_amount_out) if intent.min_amount_out is not None else None,
            "meta": intent.meta or {}
        }

    if last_trade:
        state["last_trade"] = {
            "tx_hash": last_trade.get("tx_hash"),
            "block_number": last_trade.get("block"),
            "gas_used": last_trade.get("gas_used"),
            "timestamp": now,
            "event": {
                "amountIn": str(int(last_trade.get("amount_in", 0) * 1e18)),
                "amountOut": str(int(last_trade.get("amount_out", 0) * 1e18))
            }
        }

    if error:
        state["last_error"] = {
            "message": str(error)[:500],  # Truncate long errors
            "timestamp": now
        }

    # Atomic write: write to .tmp then rename
    try:
        STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = STATE_FILE.with_suffix('.json.tmp')

        with open(tmp_path, 'w') as f:
            json.dump(state, f, indent=2, ensure_ascii=False)

        # Atomic rename (overwrites existing file)
        tmp_path.replace(STATE_FILE)

        print(f"  [State written to {STATE_FILE}]")
    except Exception as e:
        print(f"  [Warning: Failed to write state file: {e}]")
        # Try to clean up tmp file
        try:
            if tmp_path.exists():
                tmp_path.unlink()
        except:
            pass


def execute_swap_tx(w3, vault, agent_account, user_address, route_id, zero_for_one, amount_in, min_amount_out, dry_run=False):
    """
    Execute swap transaction (or simulate if dry_run=True).

    Returns:
        Transaction receipt or None if dry_run
    """
    if dry_run:
        print("  [DRY RUN] Would execute swap transaction")
        # Simulate PnL for demo purposes
        simulated_out = amount_in * 0.995  # 0.5% slippage
        delta = (simulated_out - amount_in) / 1e18
        update_pnl(delta)
        add_log("INFO", f"DRY_RUN swap: {delta:.4f} PnL")
        return None

    # Build transaction
    nonce = w3.eth.get_transaction_count(agent_account.address)
    gas_price = w3.eth.gas_price

    tx = vault.functions.executeSwap(
        user_address,
        route_id,
        zero_for_one,
        amount_in,
        min_amount_out
    ).build_transaction({
        'from': agent_account.address,
        'nonce': nonce,
        'gas': 500000,
        'gasPrice': gas_price
    })

    # Sign and send
    signed_tx = agent_account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)

    print(f"  Transaction sent: {tx_hash.hex()}")
    print("  Waiting for confirmation...")

    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    print(f"  Confirmed in block: {receipt['blockNumber']}")

    # Calculate PnL (simplified)
    # In real scenario, parse event logs for actual amounts
    delta = 0.0  # Placeholder
    update_pnl(delta)
    add_log("INFO", f"LIVE swap executed: tx={tx_hash.hex()[:10]}...")

    return receipt


def main():
    """Main agent loop with modular strategy support."""
    # Configuration from environment
    dry_run = os.getenv('DRY_RUN', '0') == '1'
    stop_after_n = os.getenv('STOP_AFTER_N_TRADES')
    poll_interval = int(os.getenv('POLL_INTERVAL', '10'))  # seconds

    mode = "DRY_RUN" if dry_run else "LIVE"

    if stop_after_n:
        stop_after_n = int(stop_after_n)

    try:
        # Setup
        w3 = create_web3_instance()
        deployment = load_deployment_info()
        vault = get_vault_contract(w3)
        agent_account = get_agent_account(w3)

        user_address = deployment['actors']['user']
        agent_address = deployment['actors']['agent']

        # Load agents configuration
        agents_config = load_agents_config()
        agent_config = find_agent_config(agents_config, agent_address)

        # Extract strategy configuration
        strategy_name = agent_config.get("strategy", "hold")
        strategy_params = agent_config.get("strategyParams", {})
        slippage_bps = int(agent_config.get("config", {}).get("slippageTolerance", 0.5) * 100)

        # Get cap (single source of truth for max trade size)
        cap = agent_config.get("config", {}).get("cap", "100")
        max_notional = cap  # Use cap as max_notional for backward compatibility

        # Get enabled status
        enabled = agent_config.get("enabled", True)

        print("=== Agent Loop Started ===\n")
        print(f"Connected to network (chainId: {w3.eth.chain_id})")
        print(f"Agent address: {agent_address}")
        print(f"User address: {user_address}")
        print(f"Strategy: {strategy_name}")
        print(f"Enabled: {enabled}")
        print(f"Cap: {cap} tokens")
        print(f"Mode: {mode}")
        if stop_after_n:
            print(f"Stop after: {stop_after_n} trades")
        print(f"Poll interval: {poll_interval}s")
        print(f"State file: {STATE_FILE}")
        print(f"Slippage: {slippage_bps} bps")
        print()

        add_log("INFO", f"Agent started in {mode} mode with strategy={strategy_name}")

        # Build policy from strategy name
        policy = build_policy(strategy_name, strategy_params)
        if policy is None:
            print(f"  [Warning: Unknown strategy '{strategy_name}', will HOLD]")
            add_log("WARN", f"Unknown strategy '{strategy_name}', defaulting to HOLD")

        # Get default route
        default_route_id = vault.functions.defaultRouteId().call()

        # Main loop
        trade_count = 0
        iteration = 0
        strategy_state = {}  # Persistent state for strategy

        while True:
            iteration += 1
            print(f"--- Iteration {iteration} (trades executed: {trade_count}) ---")

            # Reload agent config to get latest enabled/cap values
            agents_config = load_agents_config()
            agent_config = find_agent_config(agents_config, agent_address)
            enabled = agent_config.get("enabled", True)
            cap = agent_config.get("config", {}).get("cap", "100")

            # Get current state
            snapshot = get_vault_snapshot(w3, vault, deployment)

            agent_balance = format_token_amount(snapshot['agent_sub_balance'])
            agent_spent = format_token_amount(snapshot['agent_spent'])

            print(f"Agent sub-balance: {agent_balance:.4f} tokens")
            print(f"Agent spent: {agent_spent:.4f} tokens")
            print(f"Enabled: {enabled}")
            print(f"Cap: {cap} tokens")

            # Check if agent is enabled
            if not enabled:
                print("Agent is disabled, skipping strategy execution")
                add_log("INFO", f"Iteration {iteration} HOLD (agent disabled)")
                write_state('HOLD', 'agent_disabled', snapshot, trade_count, iteration, agent_config, mode, error=None)
                print()
                print(f"Sleeping for {poll_interval}s...")
                time.sleep(poll_interval)
                continue

            # Load signals (optional)
            signals, signal_error = load_signals()

            # Build context for strategy
            cap_wei = parse_token_amount(cap)
            ctx = {
                "signal": signals,
                "sub_balance_wei": snapshot['agent_sub_balance'],
                "max_per_trade_wei": cap_wei,  # Use cap as max trade size
                "default_amount_in_wei": cap_wei,  # Use cap as default amount
                "cap_wei": cap_wei,  # Explicit cap field
                "slippage_bps": slippage_bps,
                "agent_address": agent_address,
                "user_address": user_address,
                "strategy_state": strategy_state
            }

            # Make decision using strategy
            current_error = signal_error  # Track any errors for state.json
            if policy:
                try:
                    intent = policy.decide(ctx)
                except Exception as e:
                    print(f"  [Error in strategy: {e}]")
                    add_log("ERROR", f"Strategy error: {str(e)[:100]}")
                    intent = SwapIntent(action="HOLD", reason=f"strategy_error:{str(e)[:50]}")
                    current_error = f"Strategy error: {str(e)}"
            else:
                intent = SwapIntent(action="HOLD", reason="no_policy")

            print(f"Decision: {intent.action}")
            print(f"Reason: {intent.reason}")

            add_log("INFO", f"Iteration {iteration} {intent.action} ({intent.reason})")

            if intent.action == 'SWAP':
                # Request execution (agent no longer executes directly)
                amount_in = intent.amount_in
                zero_for_one = intent.zero_for_one

                amount_in_tokens = format_token_amount(amount_in)

                print(f"[Agent] Strategy triggered")
                print(f"[Agent] Requesting execution: {amount_in_tokens:.4f} tokens ({amount_in} wei)")
                print(f"  Direction: {'token0 -> token1' if zero_for_one else 'token1 -> token0'}")

                try:
                    if not dry_run:
                        # Send requestExecution transaction
                        tx = vault.functions.requestExecution(
                            amount_in,
                            zero_for_one
                        ).build_transaction({
                            'from': agent_address,
                            'nonce': w3.eth.get_transaction_count(agent_address),
                            'gas': 200000,
                            'gasPrice': w3.eth.gas_price
                        })

                        signed_tx = agent_account.sign_transaction(tx)
                        tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
                        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

                        print(f"  Request sent: {tx_hash.hex()}")
                        print(f"  Gas used: {receipt['gasUsed']}")
                    else:
                        print(f"  [DRY_RUN] Would request execution")
                        receipt = None

                    print("[Agent] Waiting for owner approval...")

                    # Write state showing request pending
                    write_state('REQUEST_PENDING', intent.reason, snapshot, trade_count, iteration, agent_config, mode, intent=intent, error=current_error)

                    # Stop after sending request (wait for approval)
                    break

                except Exception as e:
                    print(f"  Error requesting execution: {e}")
                    add_log("ERROR", f"Request failed: {str(e)[:100]}")
                    write_state('ERROR', intent.reason, snapshot, trade_count, iteration, agent_config, mode, intent=intent, error=str(e))

            else:
                print("Holding position.")
                # Write HOLD state (must write even for HOLD)
                write_state('HOLD', intent.reason, snapshot, trade_count, iteration, agent_config, mode, intent=intent, error=current_error)

            print()

            # Wait before next iteration
            if stop_after_n and trade_count >= stop_after_n:
                break

            print(f"Sleeping for {poll_interval}s...")
            time.sleep(poll_interval)

    except KeyboardInterrupt:
        print("\n\nAgent loop stopped by user.")
        add_log("WARN", "Agent stopped by user")
        return 0

    except Exception as e:
        print(f"Error: {e}")
        add_log("ERROR", f"Fatal error: {str(e)[:100]}")
        import traceback
        traceback.print_exc()
        return 1

    return 0


if __name__ == "__main__":
    exit(main())
