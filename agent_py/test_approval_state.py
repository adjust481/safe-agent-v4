#!/usr/bin/env python3
"""
Test script to verify state.json structure for approval workflow.

This script simulates the approval request state and verifies that
the generated state.json matches the expected structure.
"""

import json
import os
from datetime import datetime

# Mock classes for testing
class SwapIntent:
    def __init__(self, action, reason, zero_for_one=True, amount_in=100000000000000000000, min_amount_out=99000000000000000000, meta=None):
        self.action = action
        self.reason = reason
        self.zero_for_one = zero_for_one
        self.amount_in = amount_in
        self.min_amount_out = min_amount_out
        self.meta = meta or {}

def format_token_amount(wei_amount):
    """Convert wei to token amount (18 decimals)."""
    return float(wei_amount) / 1e18

def test_approval_state():
    """Test the approval state structure."""

    # Mock data
    BALANCE_HISTORY = [
        {"time": "14:30:15", "balance": 950.0},
        {"time": "14:30:25", "balance": 951.2},
    ]

    snapshot = {
        'agent_sub_balance': 100000000000000000000,  # 100 tokens
        'agent_spent': 50000000000000000000,  # 50 tokens
        'vault_balance': 1000000000000000000000  # 1000 tokens
    }

    agent_config = {
        "address": "0x1234567890123456789012345678901234567890",
        "ensName": "test-agent.safe.eth",
        "strategy": "Arbitrage Hunter",
        "enabled": True,
        "config": {"cap": "100"}
    }

    # Create approval intent
    approval_intent = SwapIntent(
        action="SWAP",
        reason="检测到 Uniswap V4 价格偏离 2.5%，建议执行套利策略。该操作已通过 ENS 身份验证及白名单路由校验。",
        zero_for_one=True,
        amount_in=100000000000000000000,  # 100 tokens
        min_amount_out=99500000000000000000,  # 99.5 tokens (0.5% slippage)
        meta={
            "signal": {
                "best_bid": "1.0025",
                "best_ask": "0.9975",
                "spread": 0.005
            },
            "simulation": True
        }
    )

    # Build state structure (matching write_state logic)
    now = datetime.utcnow().isoformat() + "Z"

    state = {
        "status": "AWAITING_APPROVAL",
        "last_update": now,
        "loop_count": 5,
        "total_trades": 0,

        "agent": {
            "address": agent_config.get("address", "unknown"),
            "ensName": agent_config.get("ensName", "agent.safe.eth"),
            "strategy": agent_config.get("strategy", "unknown"),
            "enabled": agent_config.get("enabled", True),
            "cap": agent_config.get("config", {}).get("cap", "100")
        },

        "decision": {
            "action": "REQUEST_PENDING",
            "reason": approval_intent.reason
        },

        "snapshot": {
            "agent_sub_balance": str(snapshot['agent_sub_balance']),
            "agent_spent": str(snapshot['agent_spent']),
            "vault_balance": str(snapshot['vault_balance'])
        },

        "pnl_history": BALANCE_HISTORY
    }

    # Add intent
    intent_data = {
        "action": approval_intent.action,
        "reason": approval_intent.reason,
        "zeroForOne": approval_intent.zero_for_one,
        "amountIn": str(approval_intent.amount_in),
        "minOut": str(approval_intent.min_amount_out),
        "meta": approval_intent.meta
    }

    # Add human-readable fields
    intent_data["amount"] = f"{format_token_amount(approval_intent.amount_in):.2f}"
    intent_data["token"] = "USDC"
    intent_data["strategy"] = agent_config.get("strategy", "unknown")
    intent_data["target"] = "Uniswap V4 Pool (0x90F7...)"

    # Calculate slippage
    slippage = ((approval_intent.amount_in - approval_intent.min_amount_out) / approval_intent.amount_in * 100)
    intent_data["slippage"] = f"{slippage:.2f}%"

    state["intent"] = intent_data

    # Print the state
    print("="*60)
    print("Generated state.json structure:")
    print("="*60)
    print(json.dumps(state, indent=2))
    print()

    # Verify required fields
    print("="*60)
    print("Verification:")
    print("="*60)

    checks = [
        ("status field exists", "status" in state),
        ("status is AWAITING_APPROVAL", state.get("status") == "AWAITING_APPROVAL"),
        ("decision object exists", "decision" in state),
        ("decision.action exists", "action" in state.get("decision", {})),
        ("decision.action is REQUEST_PENDING", state.get("decision", {}).get("action") == "REQUEST_PENDING"),
        ("decision.reason exists", "reason" in state.get("decision", {})),
        ("intent object exists", "intent" in state),
        ("intent has required fields", all(k in state.get("intent", {}) for k in ["action", "reason", "amount", "token", "strategy", "target", "slippage"])),
        ("pnl_history exists", "pnl_history" in state),
    ]

    all_passed = True
    for check_name, result in checks:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {check_name}")
        if not result:
            all_passed = False

    print()
    if all_passed:
        print("🎉 All checks passed! The state structure is correct.")
    else:
        print("⚠️  Some checks failed. Please review the structure.")

    return state

if __name__ == "__main__":
    test_approval_state()
