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

## Quickstart: run the SafeAgentVault demo locally

This repository contains a minimal "safety exoskeleton" around Uniswap v4-style agents, built with Hardhat and a simple ERC20 vault.

You can run all tests and a full local demo with:

```bash
npm install
npx hardhat test

# run a full end-to-end demo on a local Hardhat network
TMPDIR=~/hh-tmp npx hardhat run scripts/demoAgent.js
```

This script will:

- Deploy a mock ERC20 token (MockERC20) and a SafeAgentVault.
- Mint 1000 mUSD to a user, approve and deposit all into the vault.
- Configure an agent with:
  - an ENS-like label (agent.safe.eth)
  - a whitelist of allowed pools
  - a per-trade notional limit (maxNotionalPerTrade)
- Allocate 200 mUSD from the user's main balance into the agent sub-account.
- Let the agent call executeSwap(...), which passes the on-chain risk checks and emits an AgentSwapPlanned event.

This demonstrates the full flow:

**User → Vault → Agent limits → Trade intent → Risk shell decision**

even before wiring the vault into a real Uniswap v4 PoolManager.

## Architecture: "safety exoskeleton" for Uniswap v4 agents

The core idea of this project is to separate **"risk shell"** from **"strategy brains"**:

- Users deposit ERC20 assets into `SafeAgentVault`.
- Each agent gets a **per-user sub-account** via:
  - `mapping(address => mapping(address => uint256)) agentBalances;  // user -> agent -> amount`
- The owner configures per-agent limits through:
  - `maxNotionalPerTrade` (per-trade notional cap)
  - a whitelist of allowed pools
  - (future) daily limits, leverage flags, etc.
- Off-chain agents only send **intents**, such as:
  - "swap X amount in pool P, direction D"
- The vault enforces **on-chain guardrails** before any execution:
  - the agent is enabled
  - the target pool is whitelisted
  - the trade amount ≤ `maxNotionalPerTrade`
  - the agent has enough allocated balance in `agentBalances[user][agent]`

In the current phase:

- `executeSwap(...)` acts as a **stub**:
  - it validates risk constraints
  - it emits `AgentSwapPlanned(agent, ensNode, pool, amountIn, minAmountOut)`
  - it does **not** yet call a real Uniswap v4 PoolManager

In the next phase, this stub will be wired into:

- a minimal Uniswap v4 deployment (PoolManager + a simple pool)
- with the same vault-level risk checks in front of every swap,
- so Uniswap agents can "fight" in a sandbox **without having direct custody of user funds**.

This makes the vault a reusable **safety layer** that different agent strategies can plug into, instead of each strategy having to re-implement its own ad-hoc risk checks.

Visually, the system is organized as a three-layer flow:

- **Left:** Users / dApps interact with the system and submit high-level intents.
- **Center:** `SafeAgentVault` holds custody of funds, manages per-user and per-agent balances, and enforces risk limits.
- **Right:** A Uniswap v4 sandbox (PoolManager + pools) executes swaps, always behind the vault's safety shell.

The following diagram summarizes this architecture:

![SafeAgentVault + Uniswap v4 architecture](architecture.png)

## Uniswap v4 Agentic Finance alignment

This project targets the **"Uniswap v4 Agentic Finance"** prize track at ETHGlobal HackMoney.

- Agents never hold user funds directly.
- All assets sit in a `SafeAgentVault` smart contract that:
  - enforces per-agent notional limits,
  - restricts trades to a whitelist of allowed pools,
  - tracks per-user, per-agent sub-accounts via `agentBalances[user][agent]`.
- Off-chain agents submit high-level trade intents such as:
  - `"swap X amount in pool P, direction D"`.

The vault acts as a **safety exoskeleton** in front of Uniswap v4:

- it checks agent enablement, pool whitelist and notional limits on-chain,
- then routes the swap through a v4 `PoolManager` (Phase 4),
- and emits `AgentSwapPlanned` / `AgentSwapExecuted` events for auditability.

For the initial submission, `executeSwap` is wired to a minimal local Uniswap v4 deployment and exercised in end-to-end tests.

The same safety shell is designed to be reusable with production v4 deployments, without changing the agent-facing interface:
agents still only send high-level trade intents, and the vault remains the single point of custody and risk enforcement.
