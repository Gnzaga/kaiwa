# Kaiwa Dev Log

Autonomous feature development session. Each entry timestamped.

---

## 2026-02-17

### 17:15 — Auth deployment (trustHost fix)
**Issue:** NextAuth v5 throwing `UntrustedHost` for all requests to `kaiwa.gnzaga.com`.
**Root cause:** NextAuth v5 defaults to blocking non-localhost hosts in production unless explicitly opted in.
**Fix:** Added `trustHost: true` to `authConfig` in `src/lib/auth.config.ts`.
**Build:** `kaiwa-build-wnnwq` — succeeded at 17:27.
**Verification:** `GET /api/auth/providers` now returns `{"authentik":{...}}` ✅

**Also discovered:** GitHub webhook to Tekton doesn't work — webhook URL `http://10.100.0.235:8080` is MetalLB internal IP unreachable from GitHub. All builds must be triggered manually via `kubectl create -f`.

---

### 17:00–17:15 — Phase 1 deployment (auth + user features)
- Added `NEXTAUTH_URL` to Vault at `deployments/data/kaiwa` ✅
- Added `NEXTAUTH_URL` entry to `k8s/base/external-secret.yaml` ✅
- Created `src/app/admin/layout.tsx` server-side admin guard ✅
- Pushed schema to prod DB (`drizzle-kit push --force`) — had to use `expect` to auto-accept the `regions_code_unique` constraint prompt ✅
- Verified: all auth keys present in Vault, `NEXTAUTH_URL` synced to `kaiwa-config` secret ✅

---

## Feature Loop (autonomous)

### Feature 1 — Starred articles page (commit 7ba609b)
- New `/starred` page showing all user-starred articles
- Extended `ArticleList` with `isStarred`, `isArchived`, `hideFilters` props (API already supported `?isStarred=true`)
- Added `StarIcon` + Starred nav item to Sidebar

### Feature 2 — Tags browse page (commit 80484cc)
- New `/tags` page displaying all AI-generated tags as weighted cloud
- Tag size/opacity scales with article count
- Clicking tag navigates to `/search?q=<tag>`
- Added `TagIcon` + Tags nav item to Sidebar

### Feature 3 — Reading time estimates (commit 84e4d56)
- `readingTime()` helper: word count / 200 wpm
- Added "N min read" to `ArticleCard` default variant header
- Added "N min read" to `ArticleDetail` header metadata row

### Feature 4 — Personal stats page (commit 5c90032)
- New `/api/user/stats` endpoint: total read/starred/archived, today/week counts,
  top regions (bar chart), top tags, reading list count, 30-day daily activity
- New `/stats` page: overview stat cards, 30-day activity heatmap, top regions bars, top tags cloud

---

## Pending / Next Features
- Stats nav item in sidebar
- Share button (copy link) on article detail
- Keyboard shortcuts (j/k navigation, s=star, /=search)
- Archived articles page (`/archived`)
- Article notes in reading lists
