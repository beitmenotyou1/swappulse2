# Developer Onboarding Guide

SwapPulse is open-source and welcomes contributions. This guide helps you set up your development environment on the Base44 platform.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, Tailwind CSS, shadcn/ui |
| **Backend** | Base44 backend functions (Deno / TypeScript) |
| **Database** | Base44 entities (managed PostgreSQL) |
| **Blockchain** | Solidity 0.8.24, OpenZeppelin v5, Ethers.js v6 |
| **Protocol** | AT Protocol (Bluesky fork) |
| **Mobile** | Base44 native build (iOS/Android from same codebase) |
| **Auth** | Base44 Auth (email OTP, Google OAuth, 2FA) |

---

## Prerequisites

- Node.js 18+ (for local Vite dev server)
- A Base44 account (the platform handles hosting, DB, and backend)
- Git
- MetaMask or similar wallet (for blockchain testing)

No local PostgreSQL, Redis, or Docker required — Base44 manages all infrastructure.

---

## Project Structure

```
swap-pulse-hub/
├── src/                        # Frontend (React + Vite)
│   ├── pages/                  # Route components
│   ├── components/             # Reusable UI components
│   ├── lib/                    # Hooks, contexts, utilities
│   ├── hooks/                  # TanStack Query hooks
│   └── api/base44Client.js    # Pre-initialized Base44 SDK
├── base44/
│   ├── entities/              # Entity schemas (JSON)
│   ├── functions/             # Backend functions (Deno)
│   ├── workflows/             # Scheduled/event workflows
│   ├── agents/                # AI agent configs
│   ├── shared/                # Shared backend modules
│   └── lexicons/              # AT Protocol lexicons
├── contracts/                 # Solidity source (reference)
├── docs/                      # Documentation
├── SECURITY_AUDIT.md          # Security checklist
└── DEPLOYMENT.md              # Deployment guide
```

---

## Getting Started

### 1. Access the Base44 Builder

1. Log in to the Base44 platform
2. Open the SwapPulse app in the builder
3. The live preview shows your changes instantly
4. Use the left sidebar for pages, entities, functions, workflows

### 2. Understand the Data Model

Read entity schemas in `base44/entities/`:
- `CollectionEntry.jsonc` — User's card collection
- `TradeListing.jsonc` — Marketplace listings
- `EscrowTrade.jsonc` — Escrow-protected trades
- `OnChainAsset.jsonc` — NFT assets (cards, usernames)
- `WalletBalance.jsonc` — Fiat + crypto balances
- `Post.jsonc` — Social feed posts
- `Notification.jsonc` — User notifications

Each entity has Row-Level Security (RLS) rules defining access.

### 3. Frontend Development

Pages are React components in `src/pages/`. Routes are defined in `src/App.jsx`.

```jsx
// src/pages/MyPage.jsx
import React from 'react';
import { base44 } from '@/api/base44Client';

export default function MyPage() {
  const [data, setData] = React.useState(null);

  React.useEffect(() => {
    base44.entities.CollectionEntry.list().then(setData);
  }, []);

  return <div>{JSON.stringify(data)}</div>;
}
```

**Key conventions:**
- Use `@/` alias for imports (never relative `../../`)
- Use shadcn/ui components from `@/components/ui/`
- Use Tailwind classes with design tokens (`bg-card`, `text-primary`)
- Use `useSEO` hook for page meta tags
- Use `PageHeader` component for consistent headers

### 4. Backend Function Development

Backend functions live in `base44/functions/<name>/entry.ts`:

```typescript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    // ... your logic ...

    return Response.json({ success: true, data: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
```

**Key conventions:**
- Use `Deno.serve()` or `export default async function(req)` pattern
- Use `npm:` specifier for external packages
- Use `base44:runtime` for secrets: `import { secrets } from 'base44:runtime'`
- Extract shared logic to `base44/shared/` modules
- Test with `test_backend_function` tool

### 5. Workflow Development

Workflows are `.jsonc` files in `base44/workflows/`. They use the CNCF Serverless Workflow format.

```json
{
  "name": "My Workflow",
  "description": "What it does",
  "trigger": {
    "config": {
      "trigger_type": "scheduled",
      "cron_expression": "0 9 * * *",
      "timezone": "Europe/London"
    }
  },
  "definition": {
    "document": { "dsl": "1.0.0", "name": "my_workflow", "version": "1.0", "namespace": "base44" },
    "do": [
      {
        "my_step": {
          "call": "invoke_backend_function",
          "with": { "function_name": "myFunction", "args": {} },
          "then": "end",
          "x-base44": { "title": "My Step" }
        }
      }
    ]
  }
}
```

**Trigger types:** `scheduled`, `entity`, `connector`, `in_app_agent`, `app_user_auth`, `app_publish`, `app_payment`

---

## Development Workflow

### Making Changes

1. Edit files in the builder (or via the AI assistant)
2. The live preview updates instantly
3. Test interactions using the preview tools
4. Verify backend functions with `test_backend_function`
5. Publish when ready

### Code Quality

- **ESLint**: Configured in `eslint.config.js`
- **TypeScript**: Backend functions use `.ts` extension
- **Formatting**: Prettier-compatible
- **Imports**: Always use `@/` alias for frontend, `npm:` for backend

### Creating a Pull Request

1. Fork the repository on GitHub
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes in the Base44 builder
4. Sync to GitHub via the 2-way repo sync
5. Open a PR on GitHub

### Branch Naming

| Type | Prefix | Example |
|------|--------|---------|
| Feature | `feat/` | `feat/add-trading-feedback` |
| Bugfix | `fix/` | `fix/corrupt-image-handling` |
| Refactor | `refactor/` | `refactor/optimize-queries` |
| Docs | `docs/` | `docs/update-api-docs` |

### Commit Message Format

```
<type>(<scope>): <subject>

<body>
```

Example:
```
feat(trading): implement smart bundle suggestions

Uses collaborative filtering to suggest optimal
multi-card bundles for trade balancing.
```

---

## Testing

### Backend Functions

```bash
# Test via the builder's test_backend_function tool
test_backend_function('myFunction', { param: 'value' })
```

### Frontend Verification

Use the preview tools in the builder:
- `preview_screenshot` — capture the current page
- `preview_execute_code` — run a verification script
- Drive real interactions (click, fill, navigate) and assert DOM/state changes

### Smart Contract Tests

Solidity source files in `contracts/` are reference only — they're not compiled on Base44. Test them off-platform with Hardhat:

```bash
npx hardhat test
```

---

## Contributing Areas

### High Priority
- Mobile app improvements (responsive UI, PWA features)
- Smart contract gas optimisation
- AI agent accuracy
- Localization expansion (currently 17 languages)
- Accessibility (WCAG 2.1 AA)

### Good First Issues
Look for issues tagged `good-first-issue` or `help-wanted` on GitHub.

---

## Key Concepts

### Entities
Entities are JSON schemas defining stored data. Built-in fields: `id`, `created_date`, `updated_date`, `created_by_id`. Use `base44.entities.EntityName.list()`, `.filter()`, `.create()`, `.update()`, `.delete()`.

### Row-Level Security (RLS)
RLS rules define who can read/create/update/delete each entity's records. Always check RLS when creating new entities.

### Workflows
Automated processes triggered by schedules, entity changes, connectors, or app events. Use `invoke_backend_function` activity to run backend logic.

### Agents
AI agents with entity access, backend function tools, and conversation UI. Configured in `base44/agents/`.

### Secrets
API keys and sensitive values stored in Settings → Environment Variables. Accessed via `secrets.get('NAME')` in backend functions.

---

## Getting Help

- 📚 **Help Center**: `/help` in the app
- 📖 **API Docs**: `docs/api-endpoints.md`
- 🔒 **Security**: `SECURITY_AUDIT.md`
- 🚀 **Deployment**: `DEPLOYMENT.md`
- 📊 **Status**: `/status` in the app

---

## Code of Conduct

We follow the Contributor Covenant. Please be respectful and inclusive.

Happy hacking! 🚀

---

Last Updated: 2026-08-26