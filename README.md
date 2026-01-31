# Safe Agent Vault for Uniswap v4 (working title)

## What is this?

A risk-first "safety exoskeleton" for Uniswap v4 agents:
- Funds sit in a SafeAgentVault smart contract.
- Each agent address has a risk profile (limits, allowed pools, modes).
- Off-chain rule-based agents send trade intents.
- The vault enforces on-chain guardrails before interacting with Uniswap v4.

## Status

- Phase 0: Dev environment setup ✅ / 🔄
- Phase 1+: Vault + risk config + Uniswap v4 integration (coming next)
