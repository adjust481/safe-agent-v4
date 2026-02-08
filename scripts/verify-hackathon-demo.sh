#!/bin/bash
# Quick verification script for 4 core capabilities

set -e

cd "$(dirname "$0")"

echo "=== Hackathon Demo Verification ==="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check function
check() {
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} $1"
  else
    echo -e "${RED}✗${NC} $1"
    exit 1
  fi
}

# 1. Check agents.local.json structure
echo "1. Checking agents.local.json structure..."
python3 -c "
import json
with open('deployments/agents.local.json') as f:
    config = json.load(f)

agents = config.get('agents', [])
if len(agents) < 3:
    print('Error: Expected at least 3 agents')
    exit(1)

for agent in agents:
    # Check required fields
    required = ['address', 'strategy', 'enabled', 'config']
    for field in required:
        if field not in agent:
            print(f'Error: Agent missing {field}')
            exit(1)

    # Check config.cap
    if 'cap' not in agent['config']:
        print(f'Error: Agent config missing cap')
        exit(1)

print('All agents have required fields')
"
check "agents.local.json structure"

# 2. Check state.json format
echo ""
echo "2. Checking state.json format..."
if [ -f "agent_py/state.json" ]; then
  python3 -c "
import json
with open('agent_py/state.json') as f:
    state = json.load(f)

# Check required fields
required = ['status', 'last_update', 'agent', 'decision', 'snapshot']
for field in required:
    if field not in state:
        print(f'Error: state.json missing {field}')
        exit(1)

# Check agent fields
agent_fields = ['address', 'strategy', 'enabled', 'cap']
for field in agent_fields:
    if field not in state['agent']:
        print(f'Error: state.json agent missing {field}')
        exit(1)

# Check decision fields
decision_fields = ['action', 'reason']
for field in decision_fields:
    if field not in state['decision']:
        print(f'Error: state.json decision missing {field}')
        exit(1)

print('state.json has all required fields')
"
  check "state.json format"
else
  echo -e "${YELLOW}⚠${NC} state.json not found (agent not running)"
fi

# 3. Check frontend files
echo ""
echo "3. Checking frontend files..."

files=(
  "frontend/src/AgentDetailView.jsx"
  "frontend/src/AgentDetailView.css"
  "frontend/src/AgentSidebar.jsx"
  "frontend/src/AgentSidebar.css"
  "frontend/src/PythonAgentStatusCard.jsx"
  "frontend/src/PythonAgentStatusCard.css"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo -e "   ${GREEN}✓${NC} $file"
  else
    echo -e "   ${RED}✗${NC} $file not found"
    exit 1
  fi
done

# 4. Check for Toggle Switch in AgentDetailView.jsx
echo ""
echo "4. Checking Toggle Switch implementation..."
if grep -q "toggle-switch" frontend/src/AgentDetailView.jsx; then
  check "Toggle Switch found"
else
  echo -e "${RED}✗${NC} Toggle Switch not found"
  exit 1
fi

# 5. Check for cap input in AgentDetailView.jsx
echo ""
echo "5. Checking cap input implementation..."
if grep -q "cap-input" frontend/src/AgentDetailView.jsx; then
  check "Cap input found"
else
  echo -e "${RED}✗${NC} Cap input not found"
  exit 1
fi

# 6. Check for enabled badge in AgentSidebar.jsx
echo ""
echo "6. Checking enabled badge in sidebar..."
if grep -q "enabled-badge" frontend/src/AgentSidebar.jsx; then
  check "Enabled badge found"
else
  echo -e "${RED}✗${NC} Enabled badge not found"
  exit 1
fi

# 7. Check for cap badge in AgentSidebar.jsx
echo ""
echo "7. Checking cap badge in sidebar..."
if grep -q "cap-badge" frontend/src/AgentSidebar.jsx; then
  check "Cap badge found"
else
  echo -e "${RED}✗${NC} Cap badge not found"
  exit 1
fi

# 8. Check strategy adapters for cap enforcement
echo ""
echo "8. Checking strategy adapters for cap enforcement..."
if grep -q "cap_is_zero" agent_py/strategies/sniper_policy.py; then
  check "Sniper policy cap enforcement"
else
  echo -e "${RED}✗${NC} Sniper policy cap enforcement not found"
  exit 1
fi

if grep -q "cap_is_zero" agent_py/strategies/arb_policy.py; then
  check "Arb policy cap enforcement"
else
  echo -e "${RED}✗${NC} Arb policy cap enforcement not found"
  exit 1
fi

# 9. Check services
echo ""
echo "9. Checking running services..."

if lsof -i :8545 > /dev/null 2>&1; then
  echo -e "   ${GREEN}✓${NC} Hardhat (port 8545)"
else
  echo -e "   ${YELLOW}⚠${NC} Hardhat not running (port 8545)"
fi

if lsof -i :8888 > /dev/null 2>&1; then
  echo -e "   ${GREEN}✓${NC} HTTP Server (port 8888)"
else
  echo -e "   ${YELLOW}⚠${NC} HTTP Server not running (port 8888)"
fi

if lsof -i :5173 > /dev/null 2>&1; then
  echo -e "   ${GREEN}✓${NC} Vite (port 5173)"
else
  echo -e "   ${YELLOW}⚠${NC} Vite not running (port 5173)"
fi

if ps aux | grep "loop_agent.py" | grep -v grep > /dev/null 2>&1; then
  echo -e "   ${GREEN}✓${NC} Agent loop"
else
  echo -e "   ${YELLOW}⚠${NC} Agent loop not running"
fi

# 10. Test HTTP access to state.json
echo ""
echo "10. Testing HTTP access to state.json..."
if curl -s -f http://localhost:8888/agent_py/state.json > /dev/null 2>&1; then
  check "state.json accessible via HTTP"
else
  echo -e "${YELLOW}⚠${NC} state.json not accessible (HTTP server may not be running)"
fi

echo ""
echo -e "${GREEN}✅ All checks passed!${NC}"
echo ""
echo "=== Next Steps ==="
echo ""
echo "1. Start all services (if not running):"
echo "   Terminal 1: npx hardhat node"
echo "   Terminal 2: npx hardhat run scripts/deploy-local.js --network localhost"
echo "   Terminal 3: python3 server.py"
echo "   Terminal 4: cd agent_py && source .venv/bin/activate && DRY_RUN=1 POLL_INTERVAL=5 python loop_agent.py"
echo "   Terminal 5: cd frontend && npm run dev"
echo ""
echo "2. Open browser: http://localhost:5173"
echo ""
echo "3. Test capabilities:"
echo "   - Toggle agent enable/disable"
echo "   - Change cap value"
echo "   - Switch between agents"
echo "   - View decision visualization"
echo ""
echo "4. Read full guide: HACKATHON_DEMO_GUIDE.md"
echo ""
