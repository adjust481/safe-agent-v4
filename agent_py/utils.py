"""
Common utilities for Python agent demo.
"""
import json
import os
from pathlib import Path
from web3 import Web3
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def get_project_root():
    """Get project root directory (parent of agent_py)."""
    return Path(__file__).parent.parent

def load_deployment_info():
    """Load deployment info from deployments/localhost.json."""
    deployment_path = get_project_root() / "deployments" / "localhost.json"

    if not deployment_path.exists():
        raise FileNotFoundError(
            f"Deployment file not found: {deployment_path}\n"
            "Please run: TMPDIR=~/hh-tmp npx hardhat run scripts/demoAgent.js"
        )

    with open(deployment_path, 'r') as f:
        return json.load(f)

def load_contract_abi(contract_name):
    """Load contract ABI from Hardhat artifacts."""
    artifact_path = get_project_root() / "artifacts" / "contracts" / f"{contract_name}.sol" / f"{contract_name}.json"

    if not artifact_path.exists():
        raise FileNotFoundError(f"Contract artifact not found: {artifact_path}")

    with open(artifact_path, 'r') as f:
        artifact = json.load(f)
        return artifact['abi']

def create_web3_instance(rpc_url=None):
    """Create Web3 instance connected to local node."""
    if rpc_url is None:
        deployment = load_deployment_info()
        rpc_url = os.getenv('RPC_URL', deployment.get('rpcUrl', 'http://127.0.0.1:8545'))

    w3 = Web3(Web3.HTTPProvider(rpc_url))

    if not w3.is_connected():
        raise ConnectionError(f"Failed to connect to {rpc_url}")

    return w3

def get_agent_account(w3):
    """Get agent account from private key in .env."""
    private_key = os.getenv('AGENT_PRIVATE_KEY')

    if not private_key:
        raise ValueError(
            "AGENT_PRIVATE_KEY not found in .env\n"
            "Please copy .env.example to .env and set your private key"
        )

    return w3.eth.account.from_key(private_key)

def get_vault_contract(w3):
    """Get SafeAgentVault contract instance."""
    deployment = load_deployment_info()
    vault_address = deployment['addresses']['vault']
    vault_abi = load_contract_abi('SafeAgentVault')

    return w3.eth.contract(address=vault_address, abi=vault_abi)

def format_token_amount(amount, decimals=18):
    """Format token amount from wei to human-readable."""
    return float(amount) / (10 ** decimals)

def parse_token_amount(amount_str, decimals=18):
    """Parse human-readable amount to wei."""
    return int(float(amount_str) * (10 ** decimals))
