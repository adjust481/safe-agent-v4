"""
Query and display vault state snapshot.
"""
from utils import (
    create_web3_instance,
    load_deployment_info,
    get_vault_contract,
    format_token_amount
)

def get_vault_snapshot(w3, vault, deployment):
    """Get current vault state snapshot."""
    user_address = deployment['actors']['user']
    agent_address = deployment['actors']['agent']
    vault_address = deployment['addresses']['vault']

    # Query balances with error handling
    try:
        user_balance = vault.functions.balances(user_address).call()
    except Exception as e:
        print(f"Warning: Could not fetch user_balance: {e}")
        user_balance = 0

    try:
        agent_sub_balance = vault.functions.agentBalances(user_address, agent_address).call()
    except Exception as e:
        print(f"Warning: Could not fetch agent_sub_balance: {e}")
        agent_sub_balance = 0

    try:
        agent_spent = vault.functions.agentSpent(user_address, agent_address).call()
    except Exception as e:
        print(f"Warning: Could not fetch agent_spent: {e}")
        agent_spent = 0

    # Get vault's actual token balance (token0 held by vault contract)
    vault_token_balance = 0
    try:
        token0_address = deployment['addresses']['token0']
        # Load ERC20 ABI (minimal)
        erc20_abi = [
            {
                "constant": True,
                "inputs": [{"name": "_owner", "type": "address"}],
                "name": "balanceOf",
                "outputs": [{"name": "balance", "type": "uint256"}],
                "type": "function"
            }
        ]
        token_contract = w3.eth.contract(address=token0_address, abi=erc20_abi)
        vault_token_balance = token_contract.functions.balanceOf(vault_address).call()
    except Exception as e:
        print(f"Warning: Could not fetch vault token balance: {e}")
        vault_token_balance = 0

    # Query agent config (defensive unpacking - Solidity public getter doesn't return dynamic arrays)
    try:
        agent_config = vault.functions.agentConfigs(agent_address).call()
        # Safely extract fields
        enabled = agent_config[0] if len(agent_config) > 0 else False
        ens_node = agent_config[1] if len(agent_config) > 1 else b""
        max_per_trade = agent_config[2] if len(agent_config) > 2 else 0
    except Exception as e:
        print(f"Warning: Could not fetch agent_config: {e}")
        enabled = False
        ens_node = b""
        max_per_trade = 0

    # Convert ensNode to hex safely
    try:
        ens_node_hex = ens_node.hex() if ens_node else "0x" + "00" * 32
    except Exception:
        ens_node_hex = str(ens_node)

    # Get allowedRoutes using dedicated getter (works around Solidity public getter limitation)
    try:
        allowed_routes = vault.functions.getAllowedRoutes(agent_address).call()
    except Exception as e:
        print(f"Warning: Could not fetch allowedRoutes: {e}")
        allowed_routes = []

    # Query default route
    try:
        default_route_id = vault.functions.defaultRouteId().call()
        route = vault.functions.routes(default_route_id).call()
        default_route = {
            'token0': route[0],
            'token1': route[1],
            'fee': route[2],
            'pool': route[3],
            'enabled': route[4]
        }
    except Exception as e:
        print(f"Warning: Could not fetch default route: {e}")
        default_route = {
            'token0': '0x0000000000000000000000000000000000000000',
            'token1': '0x0000000000000000000000000000000000000000',
            'fee': 0,
            'pool': '0x0000000000000000000000000000000000000000',
            'enabled': False
        }

    # Query poolSwapHelper
    try:
        pool_swap_helper = vault.functions.poolSwapHelper().call()
    except Exception as e:
        print(f"Warning: Could not fetch poolSwapHelper: {e}")
        pool_swap_helper = '0x0000000000000000000000000000000000000000'

    return {
        'user_balance': user_balance,
        'agent_sub_balance': agent_sub_balance,
        'agent_spent': agent_spent,
        'vault_balance': vault_token_balance,  # ← 新增：vault 持有的 token0 余额
        'agent_config': {
            'enabled': enabled,
            'ensNode': ens_node_hex,
            'maxNotionalPerTrade': max_per_trade,
            'allowedRoutes': allowed_routes
        },
        'default_route': default_route,
        'poolSwapHelper': pool_swap_helper
    }

def print_snapshot(snapshot):
    """Pretty print vault snapshot."""
    print("=== Vault State Snapshot ===\n")

    print("User Balances:")
    print(f"  Main balance      : {format_token_amount(snapshot['user_balance']):.4f} tokens")
    print(f"  Agent sub-balance : {format_token_amount(snapshot['agent_sub_balance']):.4f} tokens")
    print(f"  Agent spent       : {format_token_amount(snapshot['agent_spent']):.4f} tokens")
    print()

    print("Agent Config:")
    print(f"  Enabled           : {snapshot['agent_config']['enabled']}")
    print(f"  ENS Node          : {snapshot['agent_config']['ensNode']}")
    print(f"  Max per trade     : {format_token_amount(snapshot['agent_config']['maxNotionalPerTrade']):.4f} tokens")
    print(f"  Allowed routes    : {len(snapshot['agent_config']['allowedRoutes'])} route(s)")
    if snapshot['agent_config']['allowedRoutes']:
        for i, route_id in enumerate(snapshot['agent_config']['allowedRoutes']):
            print(f"    [{i}] {route_id.hex() if hasattr(route_id, 'hex') else route_id}")
    print()

    print("Pool Swap Helper:")
    print(f"  Address           : {snapshot['poolSwapHelper']}")
    print()

    print("Default Route:")
    print(f"  Token0            : {snapshot['default_route']['token0']}")
    print(f"  Token1            : {snapshot['default_route']['token1']}")
    print(f"  Fee               : {snapshot['default_route']['fee']}")
    print(f"  Pool              : {snapshot['default_route']['pool']}")
    print(f"  Enabled           : {snapshot['default_route']['enabled']}")
    print()

def main():
    """Main entry point."""
    try:
        # Setup
        w3 = create_web3_instance()
        deployment = load_deployment_info()
        vault = get_vault_contract(w3)

        print(f"Connected to network (chainId: {w3.eth.chain_id})")
        print(f"Vault address: {deployment['addresses']['vault']}")
        print()

        # Get and display snapshot
        snapshot = get_vault_snapshot(w3, vault, deployment)
        print_snapshot(snapshot)

    except Exception as e:
        print(f"Error: {e}")
        return 1

    return 0

if __name__ == "__main__":
    exit(main())
