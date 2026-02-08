#!/bin/bash
# 同步部署信息和 ABI 到前端

echo "🚀 Syncing deployment files to frontend..."

# 1. 复制 deployments/localhost.json 到前端部署配置
cp deployments/localhost.json frontend/src/deployments.localhost.json
echo "✅ Copied deployments/localhost.json"

# 2. 创建 ABI 文件夹（如果不存在）
mkdir -p frontend/src/abi

# 3. 拷贝 ABI（SafeAgentVault）
cp artifacts/contracts/SafeAgentVault.sol/SafeAgentVault.json frontend/src/abi/SafeAgentVault.json
echo "✅ Copied SafeAgentVault ABI"

# 4. 验证地址一致性
VAULT_ROOT=$(grep -o '"vault": "[^"]*"' deployments/localhost.json | cut -d'"' -f4)
VAULT_FRONTEND=$(grep -o '"vault": "[^"]*"' frontend/src/deployments.localhost.json | cut -d'"' -f4)

echo ""
echo "📋 Vault Address Check:"
echo "   deployments/localhost.json:       $VAULT_ROOT"
echo "   frontend/src/deployments.localhost.json: $VAULT_FRONTEND"

if [ "$VAULT_ROOT" = "$VAULT_FRONTEND" ]; then
    echo "✅ Vault addresses match."
else
    echo "❌ Vault address mismatch!"
    exit 1
fi

echo ""
echo "🎉 Sync complete!"

