#!/usr/bin/env node
/**
 * ens_resolve.mjs
 *
 * ENS resolution tool for SafeAgentVault
 * Resolves ENS names to addresses and computes namehashes
 *
 * Usage:
 *   node tools/ens_resolve.mjs <ens-name>
 *   node tools/ens_resolve.mjs agent.safe.eth
 *
 * Environment:
 *   MAINNET_RPC_URL - Ethereum mainnet RPC URL (required)
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const ENS_REGISTRY_ADDRESS = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';

const ENS_REGISTRY_ABI = [
  'function owner(bytes32 node) external view returns (address)',
  'function resolver(bytes32 node) external view returns (address)',
  'function ttl(bytes32 node) external view returns (uint64)'
];

const ENS_RESOLVER_ABI = [
  'function addr(bytes32 node) external view returns (address)',
  'function name(bytes32 node) external view returns (string)',
  'function text(bytes32 node, string calldata key) external view returns (string)'
];

async function resolveENS(ensName) {
  // Get RPC URL from environment
  const rpcUrl = process.env.MAINNET_RPC_URL;
  if (!rpcUrl) {
    console.error('Error: MAINNET_RPC_URL environment variable not set');
    console.error('Please set it in .env file or export it:');
    console.error('  export MAINNET_RPC_URL="https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY"');
    process.exit(1);
  }

  console.log(`\n🔍 Resolving ENS name: ${ensName}\n`);

  try {
    // Connect to mainnet
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // Compute namehash
    const namehash = ethers.namehash(ensName);
    console.log(`📝 Namehash: ${namehash}`);

    // Connect to ENS registry
    const registry = new ethers.Contract(ENS_REGISTRY_ADDRESS, ENS_REGISTRY_ABI, provider);

    // Get owner
    const owner = await registry.owner(namehash);
    console.log(`👤 Registry Owner: ${owner}`);

    if (owner === ethers.ZeroAddress) {
      console.log('⚠️  This ENS name is not registered');
      return;
    }

    // Get resolver
    const resolverAddress = await registry.resolver(namehash);
    console.log(`🔗 Resolver: ${resolverAddress}`);

    if (resolverAddress === ethers.ZeroAddress) {
      console.log('⚠️  No resolver set for this ENS name');
      return;
    }

    // Connect to resolver
    const resolver = new ethers.Contract(resolverAddress, ENS_RESOLVER_ABI, provider);

    // Get resolved address
    try {
      const resolvedAddress = await resolver.addr(namehash);
      console.log(`🎯 Resolved Address: ${resolvedAddress}`);
    } catch (err) {
      console.log('⚠️  Could not resolve address:', err.message);
    }

    // Get TTL
    try {
      const ttl = await registry.ttl(namehash);
      console.log(`⏱️  TTL: ${ttl.toString()} seconds`);
    } catch (err) {
      console.log('⚠️  Could not get TTL:', err.message);
    }

    console.log('\n✅ Resolution complete\n');

  } catch (error) {
    console.error('\n❌ Error resolving ENS name:', error.message);
    process.exit(1);
  }
}

// Main
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node tools/ens_resolve.mjs <ens-name>');
  console.log('Example: node tools/ens_resolve.mjs vitalik.eth');
  process.exit(1);
}

const ensName = args[0];
resolveENS(ensName);
