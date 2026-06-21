#!/bin/bash
cd /home/uc/NodeCommander
echo "=== Tables in DB ==="
node -e "const db = require('better-sqlite3')('/home/uc/NodeCommander/dev.db'); const t = db.prepare(\"SELECT name FROM sqlite_master WHERE type='table'\").all(); console.log(JSON.stringify(t));"
echo ""
echo "=== Running Prisma DB Push ==="
npx prisma db push --accept-data-loss 2>&1
echo ""
echo "=== PM2 Restart ==="
pm2 restart node-commander 2>&1
pm2 list 2>&1