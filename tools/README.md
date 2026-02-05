# SafeAgentVault Tools

Utility scripts for SafeAgentVault development and operations.

## ENS Resolution Tool

`ens_resolve.mjs` - Resolve ENS names to addresses and compute namehashes.

### Setup

1. Install dependencies (if not already installed):
```bash
npm install
```

2. Set up your mainnet RPC URL in `.env`:
```bash
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
```

Or use a public RPC:
```bash
MAINNET_RPC_URL=https://cloudflare-eth.com
```

### Usage

```bash
node tools/ens_resolve.mjs <ens-name>
```

### Examples

**Resolve a well-known ENS name:**
```bash
node tools/ens_resolve.mjs vitalik.eth
```

Output:
```
🔍 Resolving ENS name: vitalik.eth

📝 Namehash: 0xee6c4522aab0003e8d14cd40a6af439055fd2577951148c14b6cea9a53475835
👤 Registry Owner: 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
🔗 Resolver: 0x4976fb03C32e5B8cfe2b6cCB31c09Ba78EBaBa41
🎯 Resolved Address: 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
⏱️  TTL: 0 seconds

✅ Resolution complete
```

**Compute namehash for agent identity:**
```bash
node tools/ens_resolve.mjs agent.safe.eth
```

This will show:
- The namehash (bytes32) to use in `setAgentConfig()`
- The current owner (if registered)
- The resolved address (if configured)

### Integration with SafeAgentVault

Use the namehash output in your agent configuration:

```javascript
const ensNode = ethers.namehash("agent.safe.eth");
// Or use the hex output from ens_resolve.mjs

await vault.setAgentConfig(
  agentAddress,
  true,                    // enabled
  ensNode,                 // ENS node from resolution
  allowedRoutes,
  maxNotionalPerTrade
);
```

### ENS Registry

The tool uses the official ENS Registry on Ethereum mainnet:
- Address: `0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e`
- Documentation: https://docs.ens.domains
- Specification: [EIP-137](https://eips.ethereum.org/EIPS/eip-137)

### Troubleshooting

**Error: MAINNET_RPC_URL environment variable not set**
- Create a `.env` file in the project root
- Add `MAINNET_RPC_URL=<your-rpc-url>`

**Error: Could not resolve address**
- The ENS name may not have an address record set
- Check the resolver configuration on https://app.ens.domains

**Warning: This ENS name is not registered**
- The name hasn't been registered on ENS yet
- You can still use the namehash for testing purposes

## Future Tools

Additional tools planned for this directory:
- `deploy_testnet.mjs` - Deploy contracts to testnet
- `verify_contracts.mjs` - Verify contracts on Etherscan
- `agent_simulator.mjs` - Simulate agent trading strategies
