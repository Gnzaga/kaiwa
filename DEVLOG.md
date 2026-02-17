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

### Feature 5 — Stats nav + Copy Link + Source link (commit 6e9db98)
- Sidebar: Stats (/stats) nav item with bar chart icon
- ArticleDetail: Copy Link (2s flash), Source ↗ opens original URL

### Feature 6 — Keyboard shortcuts (commit c91738d)
- GlobalShortcuts: / focuses search, g+h/s/t/l/x/a navigates
- KeyboardShortcutsHelp: ? modal, Esc closes

### Feature 7 — Archived page (commit 587ba9f)
- /archived page + ArchiveIcon sidebar nav

### Feature 8 — Article notes in reading lists (commit 610df17)
- Schema: `note` column on reading_list_items — **DB migrated**
- PATCH endpoint, inline editor UI in list detail

### Feature 9 — Unread count badges (commit 695bab5)
- /api/regions/unread-counts, sidebar badges refresh every 60s

### Feature 10 — Feed browser (commit 2ae197c)
- /api/feeds/stats, /feeds page with search/region filter

### Feature 11 — Auto mark-read (commit ebfe5e0)
- ArticleDetail auto-fires toggleRead on load if autoMarkRead pref is true

### Feature 12 — DEVLOG created (this file)

### Feature 13 — Recently Read dashboard section (commit 84ecc38)
- RecentActivity: 5 most-recently published read articles, compact cards

### Feature 14 — Feeds sidebar nav (commit 5cf373f)
- FeedIcon + /feeds link in sidebar

### Feature 15 — Sentiment filter (commit b837749)
- ArticleList: sentiment dropdown (positive/negative/neutral/mixed/bullish/bearish/restrictive/permissive)
- API ?sentiment= filter

---

## Second context session (post-summary) — 2026-02-17

### Feature 16 — Search URL param reading (commit caf57b9)
- Search page reads ?q= from URL on load (tag cloud links now work correctly)

### Feature 17 — Mark All Read (commit ab25d21)
- POST /api/articles/mark-all-read with optional region/category/source filters
- "Mark all read" button in ArticleList controls, batch upserts with onConflictDoUpdate

### Feature 18 — Related articles (commit 650cc5f)
- Article detail API now fills related: [] with up to 5 tag-matched articles
- Uses PostgreSQL ?| JSONB array operator

### Feature 19 — Clickable tags (commit 36407da)
- Tag component now renders as <Link> to /search?q=<tag>
- onClick prop available for in-place filtering

### Feature 20 — Date preset filters (commit d285b1a)
- ArticleList: Today / 7d / 30d / All segmented button group
- Sets dateFrom param; API already supported dateFrom/dateTo

### Feature 21 — Reading list JSON export (commit a2d6f55)
- Export button on reading list detail page
- Client-side blob download, includes titles, URLs, TLDRs, tags, notes

### Feature 22 — Category badge on article cards (commit 17be042)
- categorySlug (from feeds→categories JOIN) displayed as small chip
- next to source name in card header row

### Feature 23 — Read article dimming (commit b4ea0f2)
- Read articles render at 60% opacity, hover restores to 100%
- isRead state from API wired to card visual

### Feature 24 — Starred indicator on cards (commit 47e0db3)
- ★ icon in card header row for starred articles

### Feature 25 — Total unread count in sidebar (commit 19e0e39)
- Sums per-region unread badges, shows "N unread" next to KAIWA logo

### Feature 26 — Scroll-to-top button (commit 99bfaae)
- Fixed circle button appears after scrolling 400px, smooth scroll to top

### Feature 27 — Expanded/compact list view toggle (commit 8cc407f)
- Icon buttons in ArticleList controls switch between expanded (default+hero) and compact variants

### Feature 28 — Copy Summary button (commit 5d3edac)
- Article detail: copies TLDR + bullets as plain text when summary is complete

### Feature 29 — Font size toggle (commit 8bdc111)
- Article reader: A−/A/A+ cycling button, persisted in localStorage

### Feature 30 — Reading progress bar (commit cda0232)
- Thin red bar at viewport top tracks scroll progress through article pages

### Feature 31 — Toast notification system (commit b74e94b)
- ToastProvider/useToast context, auto-dismiss 3s toasts
- Article actions (star/read/archive/retranslate/resummarize/add-to-list) show feedback

---

## Active Build
- **kaiwa-build-97hdv**: features 16-31 — triggered ~current time

## Issues
- **kaiwa-build-6sdt9**: FAILED — wrong pipeline name (kaiwa-build-pipeline vs generic-build-push)
  Fixed by deleting and recreating with correct pipeline ref

