# SafeAgentVault

**A permission firewall for autonomous trading agents — because agents should request, not execute.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Hardhat](https://img.shields.io/badge/Built%20with-Hardhat-yellow)](https://hardhat.org/)
[![Uniswap V4](https://img.shields.io/badge/Uniswap-V4-ff007a)](https://uniswap.org/)

---

## 🎯 One-Liner

**SafeAgentVault is a smart contract firewall that forces AI agents to request execution approval from users, instead of holding private keys or unlimited token approvals.**

---

## 🚨 Problem Statement

Current AI trading agents have a dangerous custody model:

- **Agents hold private keys** → One bug = total loss
- **Agents get unlimited ERC20 approvals** → No per-trade limits
- **No human-in-the-loop** → Strategies execute blindly
- **No automatic revocation** → Permissions persist forever

**Real-world risk**: A momentum trading agent with a logic error could drain your entire wallet in seconds.

---

## ✅ Solution: Permission Firewall Architecture

SafeAgentVault introduces a **request → approve → execute → revoke** flow:

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│   AI Agent  │ ──────> │  SafeAgentVault  │ <────── │    User     │
│  (Strategy) │ Request │  (Firewall)      │ Approve │  (Wallet)   │
└─────────────┘         └──────────────────┘         └─────────────┘
                                 │
                                 │ Execute
                                 ▼
                        ┌──────────────────┐
                        │  Uniswap V4 Pool │
                        └──────────────────┘
```

### Key Principles

1. **Agents never hold funds** — All assets stay in the vault
2. **Agents can only request** — `requestExecution()` creates a pending approval
3. **Users must approve** — Wallet signature required for every trade
4. **Auto-revoke after execution** — Permissions reset to zero immediately
5. **Per-agent spending caps** — `maxNotionalPerTrade` enforced on-chain

---

## 🏗️ Architecture Overview

### Core Components

**1. SafeAgentVault (Smart Contract)**
- Holds user funds in isolated sub-accounts
- Enforces per-agent spending limits
- Manages pending execution requests
- Auto-revokes permissions after each trade

**2. Agent Control Panel (React Frontend)**
- Multi-agent dashboard with real-time status
- Pending approval cards with trade details
- One-click approve/reject interface
- ENS-based agent identity display

**3. Python Agent Runtime**
- Autonomous strategy execution (momentum, arbitrage, etc.)
- Market signal monitoring
- `requestExecution()` transaction submission
- State persistence and logging

**4. Uniswap V4 Integration**
- Direct PoolManager interaction
- Route-based trading with whitelisted pools
- Slippage protection on every swap

---

## 🔄 Execution Flow

### State Machine: IDLE → REQUEST → APPROVE → EXECUTE → REVOKE

```
1. IDLE
   └─> Agent monitors market conditions

2. REQUEST
   └─> Agent calls vault.requestExecution(amountIn, minOut, zeroForOne)
   └─> Vault stores PendingRequest with timestamp
   └─> Frontend shows "Pending Approval" card

3. APPROVE
   └─> User reviews: Strategy, Amount, Slippage, Risk Checks
   └─> User clicks "Authorize & Execute" in UI
   └─> Wallet prompts for signature

4. EXECUTE
   └─> Vault calls PoolSwapHelper.swap()
   └─> Uniswap V4 executes trade
   └─> Vault updates balances

5. REVOKE
   └─> Vault sets agent.enabled = false
   └─> Vault sets agent.maxNotionalPerTrade = 0
   └─> Agent must be re-enabled for next trade
```

**Critical Safety Feature**: Step 5 (auto-revoke) happens **atomically** in the same transaction as execution. No window for unauthorized trades.

---

## 📚 Documentation

Comprehensive documentation is available in the `/docs` directory:

- **[Demo Guide](docs/demo/)** — Hackathon walkthrough and video script
- **[Architecture](docs/architecture/)** — System design, implementation details, and configuration structure

Additional resources:
- **[Setup Guide](docs/setup/)** — Environment setup and deployment instructions
- **[Frontend Docs](docs/frontend/)** — UI components and integration guides
- **[Testing](docs/testing/)** — Test suite and verification checklists

---

## 🎬 Demo Walkthrough

### What You'll See (3-Minute Video)

1. **Agent Dashboard** — Three agents with different strategies:
   - 📈 Momentum Agent (`momentum.agent.eth`) — Trend following
   - 🔄 Mean Reversion Agent — Counter-trend trading
   - ⚡ Arbitrage Hunter — Cross-pool opportunities

2. **Live Market Monitoring** — Python agent detects 0.15% spread opportunity

3. **Execution Request** — Agent submits `requestExecution()` transaction

4. **Approval Modal** — UI shows:
   - AI reasoning: "Detected favorable market conditions..."
   - Trade details: 150 USDC, 0.5% slippage
   - Risk checks: ✅ ENS verified, ✅ Pool whitelisted, ✅ Under daily limit

5. **Wallet Confirmation** — User approves via MetaMask

6. **Execution & Revoke** — Trade executes, permissions auto-revoke

7. **Post-Trade State** — Agent status changes to "Disabled" until re-enabled

---

## 🛡️ Core Features

### 1. Permissioned Agent Execution

**Problem**: Traditional bots need unlimited approvals or private key access.

**Solution**: Two-step execution with mandatory user approval.

```solidity
// Agent submits request (no execution)
function requestExecution(
    uint256 amountIn,
    uint256 minOut,
    bool zeroForOne
) external onlyAgent;

// User approves and executes (requires wallet signature)
function approveAndExecute() external onlyOwner;
```

**Result**: Agent can never execute without explicit user consent.

---

### 2. Execution Cap (Per-Trade Limits)

**Problem**: A buggy strategy could drain your entire balance.

**Solution**: On-chain spending limits per agent.

```solidity
struct AgentConfig {
    bool enabled;
    uint256 maxNotionalPerTrade;  // e.g., 100 USDC max per swap
    bytes32 ensNode;
    bytes32[] allowedRoutes;
}
```

**Example**: Even if a momentum agent goes rogue, it can only lose `maxNotionalPerTrade` per approved transaction.

---

### 3. Multi-Agent Control Panel

**Problem**: Managing multiple strategies is complex.

**Solution**: Unified dashboard with per-agent controls.

**Features**:
- Enable/disable agents individually
- Adjust spending caps on the fly
- View real-time P&L and trade history
- Monitor pending approvals across all agents

**UI Preview**:
```
┌─────────────────────────────────────────────────┐
│ 📈 Momentum Agent          [ENABLED]  [EDIT]   │
│ momentum.agent.eth                              │
│ Balance: 150 USDC  |  Spent: 50 USDC           │
│ Cap: 100 USDC/trade                             │
│ ✅ Pending Approval: 150 USDC swap             │
└─────────────────────────────────────────────────┘
```

---

### 4. ENS-Based Agent Identity

**Problem**: Addresses like `0x3C44...93BC` are unreadable and hard to audit.

**Solution**: Human-readable ENS names for every agent.

```javascript
// Instead of this:
Agent: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC

// Show this:
Agent: momentum.agent.eth
```

**Benefits**:
- **Readability**: Users see `arb.agent.eth` instead of hex addresses
- **Auditability**: All events include ENS node for filtering
- **Revocability**: Disable agent by ENS name, not address lookup
- **Sponsor Alignment**: Integrates ENS for decentralized identity

---

### 5. Execution Request UI

**Problem**: Users need context to approve trades safely.

**Solution**: Rich approval cards with AI reasoning and risk checks.

**Approval Modal Includes**:
- **AI Decision Analysis**: "Market conditions favorable: Detected 0.15% spread opportunity with strong buy signal..."
- **Transaction Details**: Amount, direction, slippage, estimated output
- **Risk Control Checklist**:
  - ✅ ENS Address Verified
  - ✅ Route Contract Whitelisted
  - ✅ Under Daily Trade Limit
  - ✅ Sufficient Balance Available
- **Market Signal Data**: Best bid/ask, spread, timestamp

**User Action**: One-click "Authorize & Execute" or "Reject"

---

## 🧪 Tech Stack

### Smart Contracts
- **Solidity 0.8.26** — Core vault logic
- **Hardhat** — Development environment
- **Uniswap V4** — PoolManager integration
- **OpenZeppelin** — ERC20 utilities

### Frontend
- **React 18** — UI framework
- **Vite** — Build tool
- **ethers.js v6** — Blockchain interaction
- **Custom hooks** — `useAgentRuntime`, `useAgentData`

### Backend
- **Python 3.11** — Agent runtime
- **web3.py** — Contract interaction
- **Flask** — State server (serves `state.json`)

### Infrastructure
- **Hardhat Node** — Local blockchain (chainId: 31337)
- **ENS Integration** — Agent identity resolution
- **JSON-RPC** — Frontend ↔ Hardhat communication

---

## 🚀 How to Run Locally

### Prerequisites
```bash
node >= 18.0.0
npm >= 9.0.0
python >= 3.11
```

### Step 1: Install Dependencies
```bash
npm install
cd frontend && npm install && cd ..
pip3 install web3 flask flask-cors python-dotenv
```

### Step 2: Start Hardhat Node (Terminal 1)
```bash
npx hardhat node
```
**Output**: Local blockchain running on `http://127.0.0.1:8545`

### Step 3: Deploy Contracts (Terminal 2)
```bash
TMPDIR=~/hh-tmp npx hardhat run scripts/demoAgent.js --network localhost
```
**Output**:
- Vault deployed at `0x9fE4...6e0`
- 3 agents configured with ENS names
- Test swap executed successfully

### Step 4: Start Flask Server (Terminal 3)
```bash
python3 server.py
```
**Output**: State server running on `http://localhost:8888`

### Step 5: Start Python Agent (Terminal 4)
```bash
python3 agent_py/loop_agent.py
```
**Output**:
- Agent monitoring market every 10s
- Submits `requestExecution()` when strategy triggers
- Writes state to `agent_py/state.json`

### Step 6: Start Frontend (Terminal 5)
```bash
cd frontend
npm run dev
```
**Output**: UI running on `http://localhost:5173`

### Step 7: Test the Flow
1. Open `http://localhost:5173` in browser
2. Wait for agent to detect opportunity (~10-30 seconds)
3. Approval modal appears automatically
4. Click "Authorize & Execute"
5. Confirm in wallet (uses Hardhat account #0)
6. Watch trade execute and permissions revoke

---

## 🎯 Why This Matters

### For Users
- **No more blind trust** — Approve every trade individually
- **Quantified risk** — Know maximum loss per transaction
- **Instant revocation** — Permissions reset after each trade
- **Multi-agent safety** — Run multiple strategies without cross-contamination

### For Developers
- **Reusable safety layer** — Plug any strategy into the vault
- **On-chain enforcement** — Risk checks can't be bypassed
- **Event-driven monitoring** — Full audit trail via `AgentSwapExecuted` events
- **Modular architecture** — Swap out PoolManager, add new risk rules

### For the Ecosystem
- **AgentFi primitive** — Standard pattern for autonomous finance
- **Regulatory alignment** — User consent for every transaction
- **Composability** — Other protocols can build on top
- **Sponsor integration** — Uses ENS (identity) + Uniswap V4 (execution)

---

## 🏆 Hackathon Alignment

### Uniswap V4 Agentic Prize Track

**Why SafeAgentVault fits**:

1. **Native V4 Integration** — Direct PoolManager interaction, not a wrapper
2. **Agent Safety Layer** — Solves custody problem for autonomous strategies
3. **Hook-Compatible** — Architecture supports custom v4 hooks
4. **Reproducible Demo** — Full local setup in 5 minutes

### ENS Integration

**Why ENS matters here**:

1. **Agent Identity** — `momentum.agent.eth` vs `0x3C44...93BC`
2. **Revocation UX** — Disable by name, not address
3. **Event Auditability** — Filter logs by ENS node
4. **Production-Ready** — Optional on-chain ownership verification

---

## 📊 Project Status

### ✅ Completed
- [x] SafeAgentVault core contract
- [x] Request → Approve → Execute → Revoke flow
- [x] Multi-agent control panel UI
- [x] Python agent runtime with strategies
- [x] Uniswap V4 PoolManager integration
- [x] ENS-based agent identity
- [x] Approval modal with risk checks
- [x] Auto-revoke after execution
- [x] Per-agent spending caps
- [x] Route whitelisting

### 🔄 In Progress
- [ ] Daily spending limits (per-agent)
- [ ] Circuit breakers (pause all agents)
- [ ] Multi-token support (currently USDC only)

### 🔮 Future Roadmap
- [ ] Governance for agent registry
- [ ] Slashing for malicious agents
- [ ] Cross-chain agent execution
- [ ] Integration with AI oracles (Chainlink Functions)

---

## 🧪 Testing

### Run Full Test Suite
```bash
npx hardhat test
```

**Coverage**:
- ✅ Vault deposit/withdraw
- ✅ Agent allocation/deallocation
- ✅ Request execution validation
- ✅ Approval and execution flow
- ✅ Auto-revoke after trade
- ✅ Spending cap enforcement
- ✅ Route whitelisting
- ✅ ENS integration

**Output**: 23 passing tests

---

## 📁 Project Structure

```
safe-agent-v4/
├── contracts/
│   ├── SafeAgentVault.sol       # Core vault with approval flow
│   ├── PoolSwapHelper.sol       # Uniswap V4 swap executor
│   └── MockERC20.sol            # Test token
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ApprovalModal.jsx      # Trade approval UI
│   │   │   ├── AgentHeartbeat.jsx     # Status indicator
│   │   │   └── PendingApprovalCard.jsx
│   │   ├── hooks/
│   │   │   ├── useAgentRuntime.js     # Polls state.json
│   │   │   └── useAgentData.js        # Blockchain reads
│   │   └── AgentDetailView.jsx        # Main dashboard
├── agent_py/
│   ├── loop_agent.py            # Autonomous agent runtime
│   ├── state.json               # Current agent state
│   └── strategies/              # Trading strategies
├── scripts/
│   └── demoAgent.js             # Full deployment script
└── test/
    └── SafeAgentVault.test.js   # Contract tests
```

---

## 🤝 Contributing

This is a hackathon project, but contributions are welcome!

**Areas for improvement**:
- Additional trading strategies (grid trading, DCA, etc.)
- Gas optimization for approval flow
- Multi-sig support for approvals
- Mobile-friendly UI

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

---

## 🔗 Links

- **Demo Video**: [Coming Soon]
- **Live Demo**: [Coming Soon]
- **Documentation**: See `/docs` folder
- **ENS Docs**: https://docs.ens.domains
- **Uniswap V4**: https://docs.uniswap.org/contracts/v4/overview

---

## 👥 Team

Built for ETHGlobal Hackathon 2024

**Contact**: [Your Contact Info]

---

## 🙏 Acknowledgments

- **Uniswap Foundation** — V4 PoolManager architecture
- **ENS Team** — Decentralized identity infrastructure
- **OpenZeppelin** — Secure contract libraries
- **Hardhat** — Best-in-class dev tooling

---

**Remember**: In AgentFi, the best agent is one that asks permission. 🤖🔐

🤖 AI Usage Disclosure

This project leveraged AI tools (Claude 3.5, ChatGPT-4o) as productivity enhancers. Below is a detailed breakdown of how they were used to ensure transparency:
Product Vision & Architecture: 100% human-designed. The core "Human-in-the-loop" safety mechanism and the vault-agent interaction flow were independently conceptualized and visualized using Excalidraw.
Smart Contracts (Solidity): Used Claude to generate initial boilerplate code. However, the critical risk-enforcement logic (route whitelisting, per-trade caps, and ENS verification) was manually implemented and refined to ensure on-chain security.
Python Agent & Strategy: AI was used to assist in writing data parsing scripts. The core trading strategy logic (Sniper/Arbitrage) and the state-syncing mechanism were developed based on manual market analysis.
Frontend (React): I designed the UI layout and UX flow. AI assisted in perfecting CSS styling (Glassmorphism effects) and provided templates for Ethers.js v6 provider integration.
Debugging & Optimization: AI served as a primary debugging tool, helping to rapidly identify and resolve local blockchain connection errors (e.g., ECONNREFUSED) and state polling issues.
Human Contribution Statement: The developer (adjust481) directed all architectural decisions, conducted all deployment operations, and performed manual integration testing to ensure the system functions as a cohesive whole.
