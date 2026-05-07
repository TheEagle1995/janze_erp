#!/bin/bash
set -e
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $1"; }
info() { echo -e "${YELLOW}→${NC} $1"; }

echo "🚀 AVERO & Janze ERP — Local Setup"

# Check Node
node --version >/dev/null 2>&1 || { echo "Node.js 20+ required"; exit 1; }
ok "Node.js $(node --version)"

# Check Docker
docker --version >/dev/null 2>&1 || { echo "Docker required"; exit 1; }
ok "Docker available"

# Create .env if it doesn't exist
if [ ! -f .env ]; then
  info "Creating .env from template..."
  cat > .env << 'ENV'
DB_USER=avero
DB_PASSWORD=avero_secret_123
DATABASE_URL=postgresql://avero:avero_secret_123@localhost:5432/avero_erp
REDIS_URL=redis://localhost:6379
JWT_SECRET=local_dev_jwt_secret_change_in_production_32chars
JWT_REFRESH_SECRET=local_dev_refresh_secret_change_in_prod_32chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d
PORT=4000
NODE_ENV=development
CORS_ORIGINS=http://localhost:3000
API_INTERNAL_KEY=local_internal_key_12345
VAT_RATE_PCT=12
TELEGRAM_BOT_INTERNAL_URL=http://localhost:8080
LARGE_ORDER_THRESHOLD=1000000
VITE_API_URL=http://localhost:4000/api/v1
ENV
  ok ".env created"
else
  ok ".env already exists"
fi

# Create frontend .env
if [ ! -f frontend/.env ]; then
  echo "VITE_API_URL=http://localhost:4000/api/v1" > frontend/.env
  ok "frontend/.env created"
fi

# Install all dependencies
info "Installing dependencies..."
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
cd telegram-bot && npm install && cd ..
ok "Dependencies installed"

echo ""
echo "📋 Next steps:"
echo "  1. Start PostgreSQL + Redis:  docker compose up -d db redis"
echo "  2. Run migrations:            cd backend && npm run db:migrate"
echo "  3. Seed database:             cd backend && npm run db:seed"
echo "  4. Start backend:             cd backend && npm run dev"
echo "  5. Start frontend:            cd frontend && npm run dev"
echo ""
echo "  OR run everything with Docker:"
echo "  docker compose up -d"
echo ""
echo "  Default login: admin@avero.uz / Admin@1234"
