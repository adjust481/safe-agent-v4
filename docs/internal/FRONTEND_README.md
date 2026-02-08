# SafeAgentVault Frontend Dashboard

React-based dashboard for monitoring and interacting with SafeAgentVault.

## Features

### 6.1 Vault State Dashboard
- **Balances**: User main balance, agent sub-balance, agent spent
- **Agent Config**: Enabled status, ENS node, max per trade
- **Default Route**: Token0/Token1, fee, pool address, helper address
- **Auto-refresh**: Polls every 1.5 seconds

### 6.2 Swap History
- Displays last 20 `AgentSwapExecuted` events from chain
- Real-time event listener for new swaps
- Shows: Block number, TX hash, agent, user, pool, direction, amounts

### 6.3 Manual Swap (Dev Helper)
- Execute swaps directly from the UI
- **Two modes**:
  - **MetaMask**: Uses browser wallet (requires agent account imported)
  - **ENV Private Key**: Uses `VITE_AGENT_PK` from `.env.local`
- Displays TX hash and success/error status

### 6.4 Python Agent Status
- Polls `http://127.0.0.1:8000/status` every 1 second
- Shows: status, last decision, last TX hash, errors, update time
- Displays "offline" if Python server not running

## Setup

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Sync Deployment Info

After deploying contracts, sync the deployment file:

```bash
npm run sync:deploy
```

This copies `../deployments/localhost.json` to `src/deployments.localhost.json`.

### 3. Configure Environment (Optional)

For ENV private key mode, create `.env.local`:

```bash
# Agent private key (Hardhat account #2)
VITE_AGENT_PK=0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
```

**⚠️ WARNING**: Only use test keys! Never commit `.env.local`.

## Running

### Start Frontend

```bash
npm run dev
```

Frontend will be available at: **http://localhost:5173/**

### Start Python Status Server (Optional)

In a separate terminal:

```bash
# Install dependencies if needed
pip install fastapi uvicorn

# Start server
uvicorn agent_py.status_server:app --port 8000
```

## Complete Workflow

### Terminal 1: Local Blockchain

```bash
TMPDIR=~/hh-tmp npx hardhat node
```

### Terminal 2: Deploy Contracts

```bash
TMPDIR=~/hh-tmp npx hardhat run scripts/demoAgent.js --network localhost
```

### Terminal 3: Sync & Start Frontend

```bash
cd frontend
npm run sync:deploy
npm run dev
```

### Terminal 4: Python Status Server (Optional)

```bash
uvicorn agent_py.status_server:app --port 8000
```

## Using MetaMask Mode

1. **Import Agent Account**:
   - Open MetaMask
   - Import account using private key: `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a`
   - This is Hardhat account #2 (the agent)

2. **Add Localhost Network**:
   - Network Name: Localhost 8545
   - RPC URL: http://127.0.0.1:8545
   - Chain ID: 31337
   - Currency: ETH

3. **Execute Swap**:
   - Select "MetaMask" mode
   - Enter amount (default: 50)
   - Click "Execute Swap"
   - Approve transaction in MetaMask

## File Structure

```
frontend/
├── src/
│   ├── App.jsx                      # Main dashboard component
│   ├── App.css                      # Styles
│   ├── lib/
│   │   ├── format.js                # Formatting utilities
│   │   └── provider.js              # Web3 provider helpers
│   ├── abi/
│   │   └── SafeAgentVault.json      # Contract ABI
│   └── deployments.localhost.json   # Deployment addresses
├── package.json
└── README.md
```

## Key Implementation Details

### Defensive Struct Reading

The code uses defensive unpacking for Solidity struct getters:

```javascript
// agentConfigs only returns first 3 fields (no dynamic array)
const cfg = await vault.agentConfigs(agent);
const agentConfig = {
  enabled: cfg?.[0] ?? false,
  ensNode: cfg?.[1] ? ethers.hexlify(cfg[1]) : '0x00...',
  maxNotionalPerTrade: cfg?.[2] ?? 0n,
};

// routes returns all 5 fields
const route = await vault.routes(defaultRouteId);
const defaultRoute = {
  token0: route?.[0] ?? ethers.ZeroAddress,
  token1: route?.[1] ?? ethers.ZeroAddress,
  fee: route?.[2] ?? 0,
  pool: route?.[3] ?? ethers.ZeroAddress,
  enabled: route?.[4] ?? false,
};
```

### Event Listening

Real-time swap events are captured and prepended to history:

```javascript
vault.on('AgentSwapExecuted', (agent, user, ensNode, routeId, pool, zeroForOne, amountIn, amountOut, event) => {
  setSwapHistory(prev => [{
    blockNumber: event.log.blockNumber,
    txHash: event.log.transactionHash,
    // ... other fields
  }, ...prev.slice(0, 19)]);
});
```

### Cleanup

Event listeners are properly cleaned up to prevent memory leaks:

```javascript
useEffect(() => {
  vault.on('AgentSwapExecuted', handleSwapEvent);
  return () => {
    vault.off('AgentSwapExecuted', handleSwapEvent);
  };
}, [vault, fetchVaultState]);
```

## Troubleshooting

### "Failed to fetch vault state"
- Ensure local blockchain is running on port 8545
- Check that contracts are deployed
- Verify `deployments.localhost.json` exists and has correct addresses

### "MetaMask not found"
- Install MetaMask browser extension
- Refresh the page after installation

### "Python Agent Status: offline"
- Python status server is optional
- Start it with: `uvicorn agent_py.status_server:app --port 8000`
- Check that port 8000 is not in use

### Swap fails with "insufficient agent balance"
- Check that user has allocated funds to agent
- Run `python agent_py/snapshot.py` to verify balances

### Hot reload issues
- If event listeners duplicate, refresh the page
- Clear browser cache if stale data persists

## Development

### Update Deployment Addresses

After redeploying contracts:

```bash
npm run sync:deploy
```

Then refresh the browser.

### Add New Features

The dashboard is modular:
- Add new cards to the `grid` section
- Create new state variables and fetch functions
- Use `useCallback` for functions passed to `useEffect`

## Production Notes

- **Never use ENV private key mode in production**
- Always use MetaMask or hardware wallet for real funds
- The dashboard connects to localhost by default
- For testnet/mainnet, update `deployments.localhost.json` with correct addresses and RPC URL

## License

MIT
