# Kaiwa (会話)

Japanese media intelligence platform — law & economics news aggregation, translation, and AI summarization.

## Stack
- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS 4, React Query v5
- **ORM**: Drizzle ORM (PostgreSQL)
- **Worker**: pg-boss job queue (translation, summarization, sync)
- **Auth**: NextAuth v5 + Authentik OIDC (forward-auth at ingress, bypassed in dev)
- **Secrets**: Vault KV v2 at `deployments/data/kaiwa` → ExternalSecrets Operator → `kaiwa-config` K8s Secret
- **Deploy**: K8s (Talos Linux), namespace `kaiwa`

## Local Dev
```bash
docker compose up -d          # PostgreSQL on port 5433
npm run dev                   # Next.js on :3000
npm run worker                # pg-boss worker (separate terminal)
npm run db:push               # Push schema to DB
```

## Key Architecture
- **Translation pipeline**: LibreTranslate (primary, CPU) → OpenWebUI LLM fallback (GPU). Max 3 retries total.
- **Summarization**: OpenWebUI chat completions → structured JSON (tldr, bullets, tags, sentiment)
- **External services**: Miniflux (RSS), LibreTranslate, OpenWebUI, Vault, Authentik — all already running in cluster
- API response shape: `{ data: [...], total, page, pageSize }`

## Repo
- GitHub: https://github.com/Gnzaga/kaiwa (public, no secrets)
- `.env.local` has real creds (gitignored), `.env.example` has placeholders
- K8s manifests use `envFrom: secretRef: kaiwa-config` (ExternalSecrets, not Vault Agent Injector)

## Cluster Details
- Vault: `http://10.250.0.100:8200`, secrets at `deployments/data/kaiwa`, policy `kaiwa`
- Miniflux API: `http://10.100.0.205` (219 unread entries)
- OpenWebUI: `http://10.100.0.215`, model `openrouter_integration_for_openwebui.anthropic/claude-sonnet-4.5`
- Authentik: `https://auth.gnzaga.com/application/o/kaiwa/`, client ID `kaiwa`
- DB default port conflict: local PG on 5432, Docker mapped to 5433

## Remaining for Deployment
1. Build & push Docker image to Harbor
2. Provision PostgreSQL in cluster (standalone or use `databases` namespace)
3. Apply K8s manifests: service, ingress, web deployment, worker deployment
4. Optional: deploy LibreTranslate via Helm (`k8s/libretranslate-values.yaml`)
