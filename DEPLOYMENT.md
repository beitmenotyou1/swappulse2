# SwapPulse Production Deployment Guide

This guide covers deploying SwapPulse to production on the Base44 platform.

---

## Architecture Overview

SwapPulse runs entirely on Base44 — no separate Docker, Kubernetes, or server management is required. The platform handles hosting, scaling, SSL, and CDN automatically.

```
┌─────────────────────────────────────────────────┐
│                  Users                          │
│   [Web Browser]  [iOS App]  [Android App]       │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│            Base44 Platform                       │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ React    │  │ Backend  │  │ Database │        │
│  │ Frontend │  │ Functions│  │ (Entities)│       │
│  │ (Vite)   │  │ (Deno)   │  │           │       │
│  └──────────┘  └──────────┘  └──────────┘        │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Workflows│  │ Auth     │  │ Analytics│        │
│  │ (Cron)   │  │ (OTP/OAuth)│  │ (Built-in)│      │
│  └──────────┘  └──────────┘  └──────────┘        │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│           External Services                     │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Polygon  │  │ PulseChain│  │ TCGDex   │        │
│  │ (NFTs,  │  │ (Mirror,  │  │ (Card    │        │
│  │  Bridge) │  │  $PULSE)  │  │  Catalog)│       │
│  └──────────┘  └──────────┘  └──────────┘        │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Stripe  │  │ AT Proto  │  │ SMTP     │        │
│  │ (Payments)│  │ (PDS)    │  │ (Email)  │        │
│  └──────────┘  └──────────┘  └──────────┘        │
└─────────────────────────────────────────────────┘
```

---

## Step 1: Publish the App

Base44 handles deployment via the **Publish** button in the builder:

1. Click **Publish** in the top-right of the Base44 builder
2. Choose visibility:
   - `public_without_login` — fully public app
   - `public_with_login` — public app, login required for actions
3. The app is deployed to `https://swap-pulse-hub.base44.app` automatically
4. Each publish creates a new version; rollback is available from the dashboard

### Mobile App Publishing (iOS / Android)

Base44 publishes the same React codebase to native mobile apps:

1. Navigate to **Mobile** in the dashboard sidebar
2. Configure app name, icon, and splash screen
3. Submit to App Store Connect and Google Play Console
4. The platform handles native build, push notifications, and deep linking

No separate Expo project is needed — the web app is already responsive and mobile-ready.

---

## Step 2: Connect a Custom Domain

1. Navigate to **Settings → Custom Domain** in the Base44 dashboard
2. Add your domain (e.g., `swappulse.org`)
3. Configure DNS records:
   - **A record**: Point to the Base44 IP (shown in dashboard)
   - **CNAME**: `www` → `swap-pulse-hub.base44.app`
4. SSL is provisioned automatically via Let's Encrypt
5. Update `published_app` URL references in backend functions

---

## Step 3: Configure Secrets

All secrets are managed in **Settings → Environment Variables**. Configure only the secrets required by the feature set you are actively running.

### Current Starknet Identity Testnet Secrets
- `SWAPPULSE_TX_RELAY_URL` — public HTTPS URL for the bearer-protected provisioning transaction relay on port 8081
- `SWAPPULSE_TX_RELAY_TOKEN` — random 32-byte bearer token shared only between Base44 server-side functions and the relay host

The relay token must never be exposed in frontend code, browser storage, `ChainNetworkConfig`, logs, screenshots or GitHub.

`POLYGON_PRIVATE_KEY` is **not required** for the current Starknet identity/provisioning architecture.

### Legacy Polygon / PulseChain Secrets
These remain only for older Polygon/PulseChain features that are still intentionally enabled. Do not create them merely to operate the Starknet identity testnet.

- `POLYGON_RPC_URL` — legacy Polygon RPC endpoint
- `POLYGON_PRIVATE_KEY` — legacy Polygon deployer/relayer key
- `POLYGON_CARD_CONTRACT` — legacy Card NFT contract address
- `POLYGON_USERNAME_CONTRACT` — legacy Username NFT address
- `PULSE_RPC_URL` — legacy PulseChain RPC endpoint
- `PULSE_PRIVATE_KEY` — legacy PulseChain deployer key
- `PULSE_CHAIN_ID` — legacy PulseChain chain ID

### Payment Secrets
- `STRIPE_SECRET_KEY` — Stripe API key
- `STRIPE_PUBLISHABLE_KEY` — Stripe client key
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret
- `NOWPAYMENTS_API_KEY` — NOWPayments API key
- `NOWPAYMENTS_IPN_SECRET` — NOWPayments IPN secret

### AT Protocol Secrets
- `PDS_URL` — Personal Data Server URL
- `PDS_APP_PASSWORD` — PDS app password
- `PDS_IDENTIFIER` — PDS handle
- `PDS_ADMIN_PASSWORD` — PDS admin password

### Auth & Security
- `APP_PASSWORD_ENCRYPTION_KEY` — Wallet encryption key
- `BACKEND_FUNCTION_SECRET` — Scheduled function auth
- `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` — Bot protection

### Email & Notifications
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USERNAME` / `SMTP_TOKEN` — Email
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — Web Push

### After Starknet Identity Testnet Deployment
Follow `chain/infra/README.md` to deploy the private testnet, start the read-only RPC gateway and provisioning relay, then set `SWAPPULSE_TX_RELAY_URL` and `SWAPPULSE_TX_RELAY_TOKEN` in Base44.

`META_RELAY_CONTRACT_ADDRESS` belongs to the older Polygon meta-transaction design and is not required by the current Starknet identity relay.

---

## Step 4: Deploy Smart Contracts

For the **current Starknet identity testnet**, use the host-side deployment flow documented in `chain/infra/README.md`. The registry-owner key and relay bearer token stay on the host and are never committed to Base44 or GitHub.

The following are **legacy Polygon/PulseChain deployment paths** and are needed only if those older features are intentionally enabled:

1. **Polygon contracts**: Invoke `deploy-polygon-contracts` from the Admin dashboard
2. **PulseChain contracts**: Invoke `deploy-pulse-contracts`
3. **Polygon bridge**: Invoke `deploy-polygon-bridge`
4. **LayerZero OFT**: Invoke `deploy-lz-pulse-token`
5. **Metadata anchor**: Invoke `deploy-card-metadata-anchor`
6. **Configure LayerZero peers**: Invoke `configure-lz-peers`

Legacy contract addresses are stored in their corresponding secrets (`POLYGON_CARD_CONTRACT`, etc.).

---

## Step 5: Enable Scheduled Workflows

The following workflows are pre-configured and should be active in production:

| Workflow | Schedule | Purpose |
|----------|----------|---------|
| TCGDex Catalog Sync | Every 5 min | Sync card catalogue |
| Pricing Sync | Hourly | Sync card pricing |
| Localization Sync | Every 2 hours | Sync 17 languages |
| Bridge Queue Processor | Every 5 min | Retry failed bridges |
| Meta Transaction Processor | Every 5 min | Process gas-less txs |
| Fee Sweep | Daily | Collect platform fees |
| Low Balance Alerts | Hourly | Alert users on low balance |
| Status Monitoring | Every 5 min | Service health checks |
| Firehose Ingestion | Every 5 min | AT Protocol firehose |
| Notification Ingestion | Every 5 min | Process notifications |
| Weekly Digest | Weekly | Email digest |
| Weekly SEO Audit | Weekly | SEO health check |

Verify each is **active** in the Workflows dashboard.

---

## Step 6: Pre-Launch Checklist

### Content
- [ ] Help pages published (`/help` and sub-pages)
- [ ] Terms of Service published (`/terms`)
- [ ] Privacy Policy published (`/privacy`)
- [ ] About page published (`/about`)
- [ ] Status page published (`/status`)
- [ ] Sitemap generated (`/sitemap.xml`)
- [ ] `robots.txt` configured (`/robots.txt`)

### SEO
- [ ] Open Graph images generated (`seo-og-image` function)
- [ ] Meta tags configured in `index.html`
- [ ] Canonical URLs set
- [ ] Favicon configured

### Analytics
- [ ] `base44.analytics.track()` calls verified in key flows
- [ ] Event names consistent (see `src/lib/analytics.ts`)

### Security
- [ ] Complete `SECURITY_AUDIT.md` checklist
- [ ] RLS rules verified on all entities
- [ ] Secrets all configured (no missing values)
- [ ] Admin dashboard access restricted

### Payments
- [ ] Stripe webhook endpoint registered
- [ ] NOWPayments IPN URL configured
- [ ] Test purchase flow completed
- [ ] Refund flow tested

### Blockchain
- [ ] Starknet identity contracts build and test successfully
- [ ] Private testnet deployment manifest verified through the read-only HTTPS RPC
- [ ] Provisioning relay `/health` endpoint responds on its HTTPS URL
- [ ] `SWAPPULSE_TX_RELAY_URL` and `SWAPPULSE_TX_RELAY_TOKEN` are stored only as Base44 server-side secrets
- [ ] Raw Devnet RPC port 5050 is not publicly exposed
- [ ] Legacy Polygon/PulseChain relayers are funded only if those legacy features are intentionally enabled

### Mobile
- [ ] App icon and splash screen configured
- [ ] Push notification VAPID keys set
- [ ] Deep linking configured
- [ ] TestFlight / Internal Testing build verified

---

## Step 7: Post-Launch Monitoring

### Status Page
- The `/status` page monitors 14 services via the `StatusService` entity
- The `Status Monitoring` workflow checks health every 5 minutes
- Subscribe users via the `StatusSubscriber` entity

### Error Tracking
- Backend function errors appear in the dashboard function logs
- Use `base44/shared/logger.ts` for structured JSON logging
- Check the Workflows dashboard for failed workflow runs

### Analytics
- Built-in analytics available in the dashboard
- Custom events tracked via `base44.analytics.track()`
- Event names defined in `src/lib/analytics.ts`

### Incident Response
1. Check the Status page for service outages
2. Review workflow run history for failures
3. Check backend function logs for errors
4. Use `manage-service` to update service status
5. Use `manage-incident` to create incident records
6. Notify subscribers via the status page

---

## Rollback

Base44 supports instant rollback from the dashboard:
1. Navigate to **Publish History**
2. Select the previous version
3. Click **Restore**
4. The app reverts immediately

---

## Backup

- **Database**: Base44 manages automatic backups
- **Entity data**: Export via `export-my-data` function (per user)
- **Smart contracts**: Immutable on-chain — no backup needed
- **Secrets**: Stored in Base44 secrets manager (no export needed)

---

Last Updated: 2026-08-26