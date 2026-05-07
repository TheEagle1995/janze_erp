#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  AVERO ERP — One-command dev startup
#  Run from the project root: bash start-dev.sh
# ─────────────────────────────────────────────────────────────

set -e
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC}  $1"; }
fail() { echo -e "${RED}✗${NC} $1"; }

echo ""
echo "🚀  AVERO & Janze ERP — Starting dev environment"
echo "────────────────────────────────────────────────"

# ── 1. Check Node ──────────────────────────────────────────────
if ! node --version &>/dev/null; then
  fail "Node.js not found. Install from https://nodejs.org (v20+)"
  exit 1
fi
ok "Node.js $(node --version)"

# ── 2. Check Docker ────────────────────────────────────────────
if ! docker info &>/dev/null; then
  fail "Docker is not running!"
  echo ""
  echo "  → Open Docker Desktop and wait for it to start."
  echo "  → Then run this script again."
  exit 1
fi
ok "Docker is running"

# ── 3. Create frontend .env if missing ────────────────────────
if [ ! -f frontend/.env ]; then
  echo "VITE_API_URL=http://localhost:4000/api/v1" > frontend/.env
  ok "Created frontend/.env"
fi

# ── 4. Start database + redis ─────────────────────────────────
echo ""
echo "→ Starting PostgreSQL and Redis..."
docker compose up -d db redis

echo "→ Waiting for database to be ready..."
for i in {1..20}; do
  if docker compose exec -T db pg_isready -U avero -d avero_erp &>/dev/null; then
    ok "Database is ready"
    break
  fi
  if [ $i -eq 20 ]; then
    fail "Database did not start in time. Check: docker compose logs db"
    exit 1
  fi
  sleep 2
  echo "   ... waiting ($i/20)"
done

# ── 5. Install deps if node_modules missing ────────────────────
echo ""
if [ ! -d backend/node_modules ]; then
  warn "Installing backend dependencies..."
  (cd backend && npm install)
fi
if [ ! -d frontend/node_modules ]; then
  warn "Installing frontend dependencies..."
  (cd frontend && npm install)
fi
ok "Dependencies ready"

# ── 6. Run migrations ─────────────────────────────────────────
echo ""
echo "→ Running database migrations..."
(cd backend && npx prisma migrate deploy 2>/dev/null || npx prisma migrate dev --name init 2>/dev/null) && ok "Migrations applied"

# ── 7. Seed if first time ──────────────────────────────────────
SEED_FLAG=".seeded"
if [ ! -f "$SEED_FLAG" ]; then
  echo "→ Seeding database (first run)..."
  (cd backend && npm run db:seed) && touch "$SEED_FLAG" && ok "Database seeded"
fi

# ── 8. Launch servers ─────────────────────────────────────────
echo ""
echo "────────────────────────────────────────────────"
ok "Everything ready!"
echo ""
echo "  Frontend  →  http://localhost:3000"
echo "  Backend   →  http://localhost:4000"
echo "  API Docs  →  http://localhost:4000/docs"
echo ""
echo "  Login:  admin@avero.uz  /  Admin@1234"
echo ""
echo "  Press Ctrl+C to stop all servers"
echo "────────────────────────────────────────────────"
echo ""

# Run backend + frontend concurrently
npx concurrently \
  --names "BACKEND,FRONTEND" \
  --prefix-colors "cyan,magenta" \
  "cd backend && npm run dev" \
  "cd frontend && npm run dev"
