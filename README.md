# AVERO & Janze — Complete Retail ERP + POS System

A production-ready, offline-capable Retail ERP system for the AVERO and Janze fashion brands.

---

## What's Inside

| Module | Tech | Description |
|--------|------|-------------|
| **Backend API** | NestJS + Prisma + PostgreSQL | REST API, auth, orders, inventory, analytics, finance |
| **Frontend POS** | React + Vite + Tailwind CSS | POS terminal, dashboard, products, customers |
| **Telegram Bot** | Telegraf + Node.js | Daily reports, stock alerts, customer lookup |
| **Database** | PostgreSQL 16 | Unified schema with all business data |
| **Cache** | Redis 7 | Sessions, rate limiting |
| **Proxy** | Nginx | SSL termination, routing |

---

## Project Structure

```
erp-system/
├── backend/                 # NestJS API
│   ├── src/
│   │   ├── modules/         # auth, products, inventory, orders, customers, analytics, finance
│   │   ├── common/          # guards, decorators, filters
│   │   └── database/        # PrismaService
│   └── prisma/
│       ├── schema.prisma    # Complete database schema
│       └── seed.ts          # Default data (users, products, accounts)
├── frontend/                # React + Vite
│   └── src/
│       ├── pages/           # LoginPage, POSPage, DashboardPage, etc.
│       ├── components/      # Layout, Sidebar, shared UI
│       ├── api/             # Typed API client for every endpoint
│       └── stores/          # Zustand (auth, cart, ui)
├── telegram-bot/            # Telegraf bot
│   └── src/
│       ├── index.ts         # Commands, jobs, internal webhook
│       ├── config/          # Environment config
│       ├── database/        # PostgreSQL + Redis
│       └── services/        # API calls to backend
├── docker/                  # Dockerfiles (backend, frontend, bot)
├── nginx/                   # Nginx config (routes, rate limiting)
├── scripts/                 # setup.sh
├── docker-compose.yml       # Full stack orchestration
├── .env.example             # All required environment variables
└── README.md
```

---

## Quick Start (Local Development)

### Prerequisites
- Node.js 20+
- Docker Desktop (for PostgreSQL + Redis)

### 1 — Run the setup script

```bash
git clone https://github.com/YOUR_USERNAME/avero-erp.git
cd avero-erp
bash scripts/setup.sh
```

The script creates a `.env` file, installs all dependencies, and prints next steps.

### 2 — Start the database

```bash
docker compose up -d db redis
```

Wait ~10 seconds for the database to be ready.

### 3 — Run migrations and seed

```bash
cd backend
npm run db:migrate   # creates all tables
npm run db:seed      # adds default users, products, accounts
```

### 4 — Start the services

Open three terminal windows:

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev

# Terminal 3 — Bot (optional)
cd telegram-bot && npm run dev
```

### 5 — Open the app

- **POS / Dashboard:** http://localhost:3000
- **API Docs (Swagger):** http://localhost:4000/docs
- **Login:** `admin@avero.uz` / `Admin@1234`

---

## Run with Docker (Full Stack)

### 1 — Create your .env

```bash
cp .env.example .env
nano .env   # Fill in DB_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET
```

Generate secrets:
```bash
openssl rand -hex 32   # use for JWT_SECRET
openssl rand -hex 32   # use for JWT_REFRESH_SECRET
```

### 2 — Build and start

```bash
docker compose up -d
```

First run takes ~5 minutes to build all images. After that:

```bash
docker compose ps       # check all services are "Up"
docker compose logs -f  # watch logs
```

### 3 — Verify it's working

```bash
curl http://localhost/health
# {"status":"ok","timestamp":"..."}
```

Then open http://localhost in your browser.

---

## Deploy to Production (VPS)

### 1 — Get a server

- **DigitalOcean:** $12/month — 2 GB RAM, 1 CPU (recommended)
- OS: Ubuntu 22.04 LTS

### 2 — Install Docker on server

```bash
# SSH into your server
ssh root@YOUR_SERVER_IP

# Install Docker
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin git
```

### 3 — Upload your code

```bash
# On your server
mkdir -p /opt/avero && cd /opt/avero
git clone https://github.com/YOUR_USERNAME/avero-erp.git .
```

### 4 — Configure environment

```bash
cp .env.example .env
nano .env
# Fill in all values with real passwords and secrets
```

### 5 — Start the system

```bash
docker compose up -d
```

### 6 — Connect your domain

In your domain registrar's DNS settings, add:

| Type | Name | Value |
|------|------|-------|
| A | @ | YOUR_SERVER_IP |
| A | www | YOUR_SERVER_IP |

Wait for DNS to propagate (5 min – 24 hours).

### 7 — Enable HTTPS (free SSL)

```bash
apt install -y certbot
docker compose stop nginx

certbot certonly --standalone \
  -d your-domain.com \
  -d www.your-domain.com \
  --email your@email.com \
  --agree-tos --non-interactive

# Update nginx config with your domain name
sed -i 's/server_name _;/server_name your-domain.com www.your-domain.com;/' nginx/conf.d/avero.conf

docker compose start nginx
```

---

## Default Credentials (change after first login!)

| User | Email | Password | PIN |
|------|-------|----------|-----|
| Super Admin | admin@avero.uz | Admin@1234 | 0000 |
| Manager | manager@avero.uz | Manager@1234 | 1234 |
| Cashier | cashier@avero.uz | Cashier@1234 | 5678 |

---

## Telegram Bot Setup

1. Message **@BotFather** on Telegram → `/newbot` → get your token
2. Add token to `.env`: `BOT_TOKEN=your_token`
3. Restart the bot: `docker compose restart bot`
4. In Telegram, send: `/register AVERO-ADMIN-2026` (your ADMIN_REGISTRATION_CODE)

Bot commands:
- `/report` — Daily sales summary
- `/stock` — Low stock alerts
- `/search [name]` — Product search
- `/customer [phone]` — Customer lookup

---

## Useful Commands

```bash
# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Restart a service
docker compose restart backend

# Update and redeploy
git pull origin main
docker compose build backend frontend bot
docker compose up -d --no-deps backend frontend bot

# Database backup
docker compose exec db pg_dump -U avero avero_erp | gzip > backup-$(date +%Y%m%d).sql.gz

# Run migrations after code update
docker compose run --rm backend npx prisma migrate deploy

# Open Prisma Studio (database GUI)
cd backend && npm run db:studio
# Then open http://localhost:5555
```

---

## Architecture

```
Browser / POS Terminal
        │
        ▼
    Nginx (port 80/443)
    ├── /api/*    → backend:4000  (NestJS REST API)
    ├── /docs     → backend:4000  (Swagger UI)
    ├── /webhook/ → bot:8080      (Telegram webhook)
    └── /         → frontend:80  (React SPA)
        │
        ▼
    PostgreSQL (db:5432)    Redis (redis:6379)
```

---

## License

MIT — use freely for commercial and personal projects.
