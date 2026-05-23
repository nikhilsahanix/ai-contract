# ContractIQ

AI-powered legal contract analysis platform for law firms. Upload a PDF or DOCX contract and get an instant risk report — clause-by-clause flagging, missing-clause detection, risk scoring, and a professional redline PDF — in under 60 seconds.

---

## Features

### Core Analysis
- **AI risk scoring** — 0–10 risk score per contract, driven by Claude or Gemini
- **Clause flagging** — identifies unlimited liability, one-sided indemnity, unfair termination, and 20+ other flag types
- **Missing clause detection** — warns when expected protections (e.g. limitation of liability, governing law) are absent
- **Redline PDF generation** — professional redline report downloadable immediately after analysis
- **PDF & DOCX support** — files up to 50 MB, auto-parsed with fallback OCR for scanned documents

### Platform
- **Multi-tenant** — row-level firm isolation; no org can access another's data
- **Real-time status** — polling-based live updates as contracts move through the analysis queue
- **Async queue** — BullMQ + Redis ensures analyses never block the API; retries on failure
- **Audit log** — every sign-in, upload, and analysis recorded per org
- **Webhooks** — HMAC-SHA256-signed `analysis.completed` / `analysis.failed` events to any HTTPS endpoint
- **API keys** — machine-readable access for CI pipelines and integrations

### Billing
- **Razorpay** — INR-native payments; order created server-side, checkout modal in-browser, HMAC verification on success
- **Plans**: Solo (₹2,400/mo · 25 analyses), Firm (₹8,200/mo · 100), Max (₹20,500/mo · 250), Enterprise (custom)
- **Quota enforcement** — failed analyses never count; warning at 80%, hard-stop at limit

### Auth
- Email + password with bcrypt hashing
- JWT access tokens (15 min) + refresh tokens (7 days), rotated on use
- Email verification via Resend before workspace access
- Forgot / reset password flow (Redis token, 1 hr TTL)
- Roles: `ADMIN`, `ATTORNEY`, `VIEWER`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS v4 |
| State | Zustand |
| Backend | Fastify 4, Node.js 24 |
| ORM | Prisma + PostgreSQL |
| Queue | BullMQ + Redis (ioredis) |
| AI | Anthropic Claude (`claude-*`) or Google Gemini |
| Storage | AWS S3 or Cloudflare R2 (configurable) |
| Email | Resend |
| Payments | Razorpay |
| PDF | pdf-parse, pdf2pic, pdfkit, mammoth (DOCX), Tesseract.js (OCR) |
| Auth | @fastify/jwt, bcryptjs |

---

## Project Structure

```
ai-contract/
├── frontend/                   # Next.js app
│   └── src/
│       ├── app/
│       │   ├── (auth)/         # login, register, verify-email, forgot/reset-password
│       │   ├── (dashboard)/    # dashboard, contracts, team, api-keys, webhooks, audit-log, settings
│       │   ├── billing/        # post-payment success page
│       │   ├── pricing/        # public pricing page
│       │   └── page.tsx        # landing page
│       ├── components/
│       │   ├── providers/      # AuthProvider (Zustand hydration)
│       │   └── ui/             # CursorGlow, ScrollReveal
│       ├── lib/                # axios api.ts wrapper
│       ├── store/              # authStore (Zustand)
│       └── types/
│
└── backend/                    # Fastify API
    └── src/
        ├── config/             # env.ts (Zod), database.ts (Prisma), redis.ts
        ├── lib/                # errors, logger, queue, crypto
        ├── middleware/         # requireAuth, requireOrg
        ├── modules/
        │   ├── auth/           # register, login, refresh, logout, verify-email, forgot/reset-password
        │   ├── contracts/      # upload, list, get, delete, status
        │   ├── analysis/       # trigger, status, redline download
        │   ├── billing/        # Razorpay checkout, verify, webhook
        │   ├── apikeys/        # create, list, revoke
        │   └── webhooks/       # create, list, delete OrgWebhook
        ├── plugins/            # cors, helmet, rate-limit, audit
        ├── services/
        │   ├── ai/             # analyzer.ts, anthropic.ts, google.ts
        │   ├── email/          # resend.ts (verification, reset, analysis notifications)
        │   ├── pdf/            # parser.ts, redline.ts
        │   └── storage/        # s3.ts (works for both S3 and R2)
        └── workers/            # BullMQ analysis worker, notification worker
```

---

## Database Schema

| Model | Key Fields |
|---|---|
| `Org` | id, name, slug, plan, analysisCount, analysisLimit |
| `User` | id, orgId, email, passwordHash, role, emailVerified |
| `Contract` | id, orgId, originalName, contractType, jurisdiction, status, s3Key |
| `Analysis` | id, contractId, riskScore, riskLevel, flags, missingClauses, redlineKey |
| `ApiKey` | id, orgId, name, keyPrefix, keyHash, isActive, lastUsedAt, expiresAt |
| `OrgWebhook` | id, orgId, url, secret, events[] |
| `AuditLog` | id, orgId, userId, action, ipAddress, userAgent |
| `RefreshToken` | id, userId, tokenHash, expiresAt |

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Razorpay account (live or test)
- Resend account (for transactional email)
- Anthropic or Google AI API key
- AWS S3 or Cloudflare R2 bucket

### 1. Clone

```bash
git clone https://github.com/your-username/contractiq.git
cd contractiq
```

### 2. Backend setup

```bash
cd backend
npm install

cp .env.example .env   # then fill in your values — see Environment Variables below
```

Run database migrations:

```bash
npx prisma migrate deploy
# or for local dev:
npx prisma migrate dev
```

Start the API:

```bash
npm run dev        # ts-node-dev / tsx watch
# or
npm run build && npm start
```

The API listens on `http://localhost:3000` by default. All routes are prefixed `/v1`.

### 3. Frontend setup

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173 (or 3001)
```

### 4. Start the worker

The BullMQ analysis worker must run separately:

```bash
cd backend
npm run worker     # starts workers/index.ts
```

---

## Environment Variables

### Backend (`backend/.env`)

```env
# ─── Server ───────────────────────────────────────────────────────────────────
NODE_ENV=development
PORT=3000
API_BASE_URL=http://localhost:3000
FRONTEND_URL=http://localhost:5173
API_WHITELIST_ORIGINS=          # comma-separated extra CORS origins (optional)

# ─── Database ─────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://user:password@host:5432/contractiq

# ─── Redis ────────────────────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ─── JWT ──────────────────────────────────────────────────────────────────────
# Generate: openssl rand -hex 32
JWT_ACCESS_SECRET=<64-char-hex>
JWT_REFRESH_SECRET=<64-char-hex>

# ─── Storage ──────────────────────────────────────────────────────────────────
STORAGE_PROVIDER=s3             # or 'r2'

# AWS S3 (required when STORAGE_PROVIDER=s3)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
S3_BUCKET_NAME=contractiq

# Cloudflare R2 (required when STORAGE_PROVIDER=r2)
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_ACCOUNT_ID=
R2_BUCKET_NAME=contractiq

# ─── AI ───────────────────────────────────────────────────────────────────────
AI_PROVIDER=anthropic           # or 'google'
ANTHROPIC_API_KEY=sk-ant-...    # required when AI_PROVIDER=anthropic
GOOGLE_API_KEY=                 # required when AI_PROVIDER=google

# ─── Razorpay ─────────────────────────────────────────────────────────────────
# Dashboard → Settings → API Keys
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
# Dashboard → Webhooks → create endpoint → copy secret
RAZORPAY_WEBHOOK_SECRET=...

# ─── Resend ───────────────────────────────────────────────────────────────────
RESEND_API_KEY=re_...
EMAIL_FROM=ContractIQ <no-reply@yourdomain.com>

# ─── Encryption ───────────────────────────────────────────────────────────────
# Generate: openssl rand -hex 32
ENCRYPTION_KEY=<64-char-hex>
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/v1
```

---

## API Reference

All endpoints are prefixed `/v1`. Auth endpoints that require a token expect:
```
Authorization: Bearer <access_token>
```

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | — | Create org + admin user |
| `POST` | `/auth/login` | — | Returns access + refresh tokens |
| `POST` | `/auth/refresh` | — | Rotate refresh token |
| `POST` | `/auth/logout` | — | Revoke refresh token |
| `GET` | `/auth/verify-email` | — | `?token=` — activate account |
| `POST` | `/auth/forgot-password` | — | Send reset link |
| `POST` | `/auth/reset-password` | — | `{ token, password }` |
| `GET` | `/me` | ✓ | Current user + org |
| `PATCH` | `/me` | ✓ | Update profile |
| `PATCH` | `/me/password` | ✓ | Change password |
| `GET` | `/members` | ✓ | Org member list |
| `GET` | `/contracts` | ✓ | List contracts (paginated) |
| `POST` | `/contracts/upload` | ✓ | `multipart/form-data` — triggers analysis |
| `GET` | `/contracts/:id` | ✓ | Contract detail |
| `DELETE` | `/contracts/:id` | ✓ | Delete contract + S3 objects |
| `GET` | `/contracts/:id/analysis/status` | ✓ | Polling endpoint |
| `GET` | `/contracts/:id/analysis/redline` | ✓ | Download redline PDF |
| `GET` | `/api-keys` | ✓ | List API keys |
| `POST` | `/api-keys` | ✓ ADMIN | Create key (raw key shown once) |
| `DELETE` | `/api-keys/:id` | ✓ ADMIN | Revoke key |
| `GET` | `/webhooks` | ✓ ADMIN | List webhooks |
| `POST` | `/webhooks` | ✓ ADMIN | Register endpoint |
| `DELETE` | `/webhooks/:id` | ✓ ADMIN | Remove endpoint |
| `GET` | `/audit-logs` | ✓ ADMIN | Last 100 events |
| `GET` | `/billing/plans` | — | List plans with pricing |
| `POST` | `/billing/checkout` | ✓ | Create Razorpay order |
| `POST` | `/billing/verify` | ✓ | Verify payment + activate plan |
| `POST` | `/billing/webhook` | — | Razorpay webhook (HMAC-verified) |
| `GET` | `/health` | — | DB + Redis + queue health check |

---

## Razorpay Integration

The payment flow is fully server-side-verified:

1. **Frontend** calls `POST /billing/checkout` with the plan ID
2. **Backend** creates a Razorpay Order and returns `{ orderId, amount, currency, keyId }`
3. **Frontend** loads `checkout.razorpay.com/v1/checkout.js` and opens the modal
4. On success the modal returns `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }`
5. **Frontend** calls `POST /billing/verify` with those three fields + `planId`
6. **Backend** verifies `HMAC-SHA256(orderId|paymentId, RAZORPAY_KEY_SECRET)` and upgrades the org's plan
7. **Webhook** at `/billing/webhook` handles async `payment.captured` events as a second safety net

Configure the webhook URL in your Razorpay Dashboard:
```
https://api.yourdomain.com/v1/billing/webhook
```
Events to subscribe: `payment.captured`, `subscription.cancelled`

---

## Webhook Delivery (Outgoing)

ContractIQ delivers signed events to endpoints your team registers via the Webhooks UI or API.

**Payload shape:**
```json
{
  "event": "analysis.completed",
  "orgId": "...",
  "contractId": "...",
  "analysisId": "...",
  "riskScore": 7.4,
  "riskLevel": "HIGH",
  "timestamp": "2026-05-23T12:00:00.000Z"
}
```

**Verification (Node.js example):**
```js
const crypto = require("crypto");

const sig = req.headers["x-contractiq-signature"];
const expected = crypto
  .createHmac("sha256", YOUR_WEBHOOK_SECRET)
  .update(JSON.stringify(req.body))
  .digest("hex");

if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
  return res.status(401).end();
}
```

Failed deliveries are retried with exponential backoff (BullMQ). After 3 failures the webhook is marked inactive.

---

## Plans & Quotas

| Plan | Price | Analyses/mo | Team | API Keys | Webhooks |
|---|---|---|---|---|---|
| Solo | ₹2,400/mo | 25 | 1 user | — | — |
| Firm | ₹8,200/mo | 100 | Unlimited | — | ✓ |
| Max | ₹20,500/mo | 250 | Unlimited | ✓ | ✓ |
| Enterprise | Custom | Unlimited | Unlimited | ✓ | ✓ |

- Quota resets on every billing cycle
- Failed analyses do **not** count against the quota
- Warning at 80% · hard-stop at 100%

---

## Security

- All contracts encrypted at rest in S3/R2; transferred over TLS
- Row-level org isolation — Prisma queries always filter by `orgId`
- Passwords hashed with bcrypt (cost factor 12)
- JWT access tokens expire in 15 minutes; refresh tokens rotate on every use and are revoked on logout
- API keys stored as SHA-256 hashes; raw key shown only at creation
- Webhook payloads signed with HMAC-SHA256 per-endpoint secret
- Razorpay payment signatures verified server-side before any plan upgrade
- Password reset tokens stored as SHA-256 in Redis with 1-hour TTL
- Rate limiting on all routes via `@fastify/rate-limit`
- Helmet security headers via `@fastify/helmet`

---

## Development

```bash
# Type-check both packages
cd backend  && npx tsc --noEmit
cd frontend && npx tsc --noEmit

# Prisma studio
cd backend && npx prisma studio

# Generate Prisma client after schema changes
cd backend && npx prisma generate

# Run a migration
cd backend && npx prisma migrate dev --name your_migration_name
```

---

## License

Private — all rights reserved.
