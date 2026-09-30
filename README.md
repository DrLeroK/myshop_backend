# MyShop Backend Engine

[![Node.js](https://img.shields.io/badge/Node.js-v22-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.21-lightgrey.svg)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-teal.svg)](https://www.prisma.io/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.8-black.svg)](https://socket.io/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)

High-performance financial and operational backend engine for multi-shop enterprise management, transactional POS sales logging, live SQL analytics, algorithmic microfinance underwriting, and authenticated real-time WebSocket alerts.

---

## 🌐 Connected Ecosystem

`myshop_backend` serves as the central data and business logic engine for two dedicated frontend applications:

1. **[`myshop`](../myshop)**: The customer/store-owner POS and retail operations web application (Next.js 16, Tailwind CSS, Lucide Icons, Socket.io client). Handles daily point-of-sale checkout, barcode scanning, stock replenishment, inter-shop inventory transfers, expense recording, and real-time operational alerts.
2. **[`myshop_capital`](../myshop_capital)**: The institutional credit underwriting and microfinance loan evaluation portal (Next.js 16, institutional dashboard). Evaluates real-time store financial metrics, algorithmically calculates credit scores (300–850), and manages loan origination, approvals, disbursements, and repayment schedules.

```
                           +----------------------------------------------+
                           |             Connected Clients                |
                           +----------------------+-----------------------+
                                                  |
                     +----------------------------+----------------------------+
                     |                                                         |
                     v                                                         v
    +----------------------------------+                      +----------------------------------+
    |         myshop (Frontend)        |                      |     myshop_capital (Frontend)    |
    |  Retail POS & Store Operations   |                      | Institutional Credit & Lending   |
    |  (Port: 3000)                    |                      | (Port: 3001)                     |
    +-----------------+----------------+                      +----------------+-----------------+
                      |                                                        |
                      | HTTP REST + JWT & Socket.io                            | HTTP REST + JWT
                      +----------------------------+---------------------------+
                                                   |
                                                   v
                         +----------------------------------------------------+
                         |             myshop_backend (Engine)                |
                         |  Express.js, Prisma ORM, Helmet, Rate-Limiting    |
                         |  (Port: 5000)                                      |
                         +-------------------------+--------------------------+
                                                   |
                                                   v
                         +----------------------------------------------------+
                         |              PostgreSQL 16 Database                |
                         |  Stores, Products, Sales, Expenses, Underwriting   |
                         +----------------------------------------------------+
```

---

## 🚀 Key Features

### 1. Multi-Tenant Multi-Shop Hierarchy
- **Executive Oversight**: Store owners can manage multiple physical branches or outlets under a unified account.
- **Consolidated Analytics**: Aggregated dashboard tracking consolidated revenue, total profit margins, and inventory distribution across all owned shops.
- **Inter-Shop Stock Transfer**: Atomically rebalance stock between different branches with database transactions.
- **Role-Based Access Control (RBAC)**: Enforces access isolation between `SUPER_ADMIN`, `OWNER`, `MANAGER`, and `CASHIER`.

### 2. Transactional Sales Engine (1 Write -> 3 Consequences)
Every completed sale transaction executes inside an atomic Prisma database transaction:
1. **Stock Decrement**: Automatically decrements product inventory in real time.
2. **Historical Ledger Snapshot**: Locks historical selling price, unit cost, and computed profit at the moment of checkout, preventing historical distortion when catalog prices change.
3. **Automated Event Triggers**: Checks low-stock thresholds and emits real-time notifications to authenticated shop staff.

### 3. Financial & Operational SQL Analytics
- **Live Aggregations**: On-demand SQL calculations for Gross Revenue, Cost of Goods Sold (COGS), Gross Profit, Operating Expenses, and Net Profit.
- **Trend Analysis**: Real-time week-over-week and month-over-month percentage growth comparisons.
- **Best Sellers & Breakdown**: Real-time best-selling item rankings and payment method distributions (`CASH`, `CARD`, `MOBILE_MONEY`).

### 4. Algorithmic Credit Underwriting (MyShop Capital Engine)
- **Automatic Score Generation**: Proprietary credit scoring algorithm (300 to 850) based on historical monthly revenue consistency, profit margins, sales volume, and transaction frequency.
- **Max Recommended Borrowing Limits**: Calculates maximum prudent loan limits based on rolling cash-flow data.
- **Loan Lifecycle Management**: Complete workflow covering `SUBMITTED`, `UNDERWRITING_REVIEW`, `APPROVED`, `DISBURSED`, `REPAID`, and `REJECTED`.

### 5. Production Security Layer
- **HTTP Security Headers**: Configured with `helmet` for cross-origin isolation, MIME-sniffing prevention (`nosniff`), and frame protection.
- **Rate Limiting**:
  - Global API rate limiter protecting all endpoints from DDoS abuse.
  - Strict authentication rate limiter (`/api/auth/login`, `/api/auth/register`) mitigating brute-force credential attacks.
- **Dynamic CORS Origin Validation**: Strictly validates request origins against whitelist configured in `.env`.
- **Authenticated Real-Time WebSockets**: Socket.io connections are validated via JWT tokens in the handshake, and room subscriptions (`shop_${shopId}`) verify user ownership and assignment to prevent cross-tenant data leakage.

---

## 📁 Directory Structure

```
myshop_backend/
├── .env                       # Local environment variables (never committed)
├── .env.example               # Environment template with documentation
├── .gitignore                 # Git ignore rules
├── .dockerignore              # Docker build context exclusions
├── Dockerfile                 # Multi-stage production container build (node:22-slim)
├── docker-compose.yml         # Container orchestration for API + PostgreSQL
├── docker-entrypoint.sh       # Container startup & migration script
├── package.json               # Node.js dependencies & scripts
├── tsconfig.json              # TypeScript compilation configuration
├── prisma/
│   └── schema.prisma          # Database schema (Models, Enums, Relations)
├── src/
│   ├── app.ts                 # Express app setup, security middlewares, routing
│   ├── server.ts              # HTTP server & Socket.io initialization
│   ├── config/
│   │   ├── env.ts             # Typed environment configuration
│   │   ├── prisma.ts          # Shared Prisma client instance
│   │   └── socket.ts          # Authenticated Socket.io server & event dispatch
│   ├── controllers/           # HTTP Request/Response controllers
│   ├── middlewares/           # Auth, RBAC, shop access, and error handlers
│   ├── routes/                # Express API route declarations
│   ├── seeds/
│   │   └── seed.ts            # Database seed script for demo accounts & products
│   └── services/              # Core business logic & database transactions
└── tests/
    └── test_runner.ts         # Automated E2E integration & security test suite
```

---

## ⚙️ Environment Variables

Create your local `.env` by copying `.env.example`:

```bash
cp .env.example .env
```

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP Server port | `5000` |
| `NODE_ENV` | Application mode (`development` or `production`) | `development` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` |
| `JWT_SECRET` | Secret key for signing authentication tokens | (Change in prod) |
| `JWT_EXPIRES_IN` | Token validity duration | `7d` |
| `CORS_ORIGIN` | Comma-separated list of allowed web origins | `http://localhost:3000,http://localhost:3001` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in milliseconds | `900000` (15m) |
| `RATE_LIMIT_MAX_REQUESTS` | Max general API requests per IP per window | `100` |
| `AUTH_RATE_LIMIT_MAX` | Max auth attempts per IP per window | `15` |
| `POSTGRES_USER` | PostgreSQL container username | `postgres` |
| `POSTGRES_PASSWORD` | PostgreSQL container password | `postgres` |
| `POSTGRES_DB` | PostgreSQL database name | `myshop_db` |
| `DOCKER_POSTGRES_PORT`| Published host port for Docker PostgreSQL | `5434` |
| `SEED_DATABASE` | Auto-seed database on container startup (`true`/`false`) | `false` |

---

## 🏃 Running the Application

### Option 1: Running with Docker (Recommended for Containerized Environments)

Ensure [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/) are installed.

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/myshop_backend.git
   cd myshop_backend
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   ```

3. **Start services with Docker Compose**:
   ```bash
   docker compose up --build
   ```
   To run in the background (detached mode):
   ```bash
   docker compose up -d --build
   ```

4. **Verify running containers**:
   ```bash
   docker compose ps
   ```

5. **Stop containers**:
   ```bash
   docker compose down
   ```
   *(To wipe database volumes: `docker compose down -v`)*

---

### Option 2: Running Locally Without Docker

Ensure **Node.js (>= 20)** and a local **PostgreSQL (>= 15)** instance are installed and running.

1. **Clone and enter the directory**:
   ```bash
   git clone https://github.com/your-username/myshop_backend.git
   cd myshop_backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env to set your local PostgreSQL credentials in DATABASE_URL
   ```

4. **Synchronize database schema**:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Seed initial demo data**:
   ```bash
   npm run seed
   ```

6. **Start development server**:
   ```bash
   npm run dev
   ```

7. **Build and start production server**:
   ```bash
   npm run build
   npm start
   ```

---

## 🧪 Testing

Run the automated integration and security test suite:

```bash
npm test
```

The test runner validates:
- Health check endpoints
- JWT authentication for Store Owners and Cashiers
- Multi-shop aggregation and isolation
- Inventory stock management & inter-shop stock transfers
- Transactional sales with stock decrements, profit calculation, and alert emission
- Financial aggregation reports (revenue, COGS, margins, trends)
- Helmet HTTP security headers (`nosniff`, `SAMEORIGIN`)
- 401 Unauthorized protection on private routes
- 403 Forbidden cross-tenant isolation between shops

---

## 📡 API Reference Overview

### Authentication (`/api/auth`)
- `POST /api/auth/register` - Create owner account (Rate-limited)
- `POST /api/auth/login` - Authenticate user & return JWT token (Rate-limited)
- `GET /api/auth/profile` - Retrieve current user profile and assigned/owned stores

### Multi-Shop Management (`/api/shops`)
- `GET /api/shops/my-shops` - List shops belonging to current owner
- `POST /api/shops` - Create a new shop branch
- `GET /api/shops/owner/dashboard` - Aggregated executive dashboard across all stores
- `POST /api/shops/owner/transfer-stock` - Atomically transfer inventory between branches

### Products & Inventory (`/api/products`)
- `GET /api/products/shop/:shopId` - List store inventory (filters: `search`, `lowStock`, `categoryId`)
- `POST /api/products/shop/:shopId` - Create new inventory item
- `PATCH /api/products/:productId/stock/shop/:shopId` - Manual stock adjustment
- `PUT /api/products/:productId/shop/:shopId` - Update product details
- `DELETE /api/products/:productId/shop/:shopId` - Archive product

### POS & Sales Operations (`/api/sales`)
- `POST /api/sales/shop/:shopId` - Log transactional sale (decrements stock, triggers alerts)
- `GET /api/sales/shop/:shopId` - Paginated sales transaction history

### Financial Analytics (`/api/reports`)
- `GET /api/reports/summary/shop/:shopId` - Income summary (Revenue, COGS, Gross Profit, Expenses, Net Profit)
- `GET /api/reports/best-sellers/shop/:shopId` - Top-performing inventory items
- `GET /api/reports/trends/shop/:shopId` - Growth trend comparison (`this_week_vs_last_week`, etc.)
- `GET /api/reports/payment-methods/shop/:shopId` - Revenue distribution by payment method

### Microfinance & Underwriting (`/api/loans`)
- `GET /api/loans/underwriting/:shopId` - Algorithmic credit score & underwriting metrics
- `POST /api/loans/apply/:shopId` - Submit loan request
- `GET /api/loans/all` - List loan applications (institutional view for `myshop_capital`)
- `PATCH /api/loans/review/:loanId` - Approve, reject, or disburse working capital loans

---

## 🔒 Security Best Practices

- Always replace default `JWT_SECRET` with an unpredictable, cryptographically random key before deploying to production.
- Do not check `.env` into public Git repositories.
- Restrict `CORS_ORIGIN` to the exact production domains of your frontend deployments.
