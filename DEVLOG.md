# Kaiwa Dev Log

Autonomous feature development session. Each entry timestamped.

---

## 2026-02-17

### Feature 186 — Category page: stats in header
`src/app/region/[regionId]/[categorySlug]/page.tsx` + `src/app/api/stats/route.ts`: added `?category=` param to stats API; category page header now shows today/hour/total subtitle.

### Feature 185 — Reading list: bulk "Mark all read"
`src/app/api/reading-lists/[id]/mark-all-read/route.ts` (new) + `src/app/lists/[id]/page.tsx`: new POST endpoint bulk-upserts read state for all list items; "Mark all read" button added to list header.

### Feature 184 — Article detail: floating "Copy as quote"
`src/components/articles/ArticleDetail.tsx`: text selection in article content shows a floating "Copy as quote" button; copies `> selected text\n\n— Title (URL)` to clipboard.

### Feature 183 — Stats: week-over-week delta
`src/app/api/user/stats/route.ts` + `src/app/stats/page.tsx`: added `readLastWeek` count (8–14 days ago); "This Week" stat card shows `↑N vs last` / `↓N vs last` delta.

### Feature 182 — ArticleList: `/` key focuses tag filter
`src/components/articles/ArticleList.tsx`: pressing `/` focuses the tag filter input (preventDefault so `/` isn't typed).

### Feature 181 — ArticleList n/p pagination shortcuts
`src/components/articles/ArticleList.tsx`: `n`/`p` keys now work as aliases for `]`/`[` to go to next/previous page.

### Feature 180 — Region page: stats in header
`src/app/region/[regionId]/page.tsx`: header now shows "N today · M this hour · total total" subtitle from `/api/stats?region=` query.

### Feature 179 — Reading list: total reading time estimate
`src/app/api/reading-lists/[id]/route.ts` + `src/app/lists/[id]/page.tsx`: computes `readingMinutes` per item (char_length/1000), sums them, and shows `~Xm reading` or `~Xh reading` in header.

### Feature 178 — Article detail: metadata panel
`src/components/articles/ArticleDetail.tsx`: collapsible "Article Metadata" panel above related articles shows ID, published/ingested dates, word count, source lang, translation/summary status, and original URL.

### Feature 177 — Article card: double-click opens original URL
`src/components/articles/ArticleCard.tsx`: default variant `onDoubleClick` opens `article.originalUrl` in new tab.

### Feature 176 — Reading list detail: Copy Markdown button
`src/app/lists/[id]/page.tsx`: added "Copy Markdown" button alongside "Copy URLs" that formats list as `# Name\n- [title](url)\n  > tldr`.

### Feature 175 — Dashboard: QuickRead widget
`src/components/dashboard/QuickRead.tsx`: new widget fetching `?sort=quickest&isRead=false` articles; shows top 3 shortest unread articles in right column.

### Feature 174 — (skipped — feeds link already done)

### Feature 173 — Tags page: A-Z letter section headers
`src/app/tags/page.tsx`: when "A-Z" sort active and no letter filter, tags are grouped under letter section headers (e.g. "A", "B", ...) with dividers.

### Feature 172 — Reading lists page: show "Updated Xh ago" per list
`src/app/lists/page.tsx`: added `relTime` helper and `updatedAt` field to interface; shows relative last-update time under each list name.

### Feature 171 — Article list: add "6h" date preset
`src/components/articles/ArticleList.tsx`: added "6h" (last 6 hours) to date preset bar.

### Feature 170 — Dashboard RecentActivity: show "N this week" count
`src/components/dashboard/RecentActivity.tsx`: added `articles-read-week` query; shows "N this week" in section header.

### Feature 169 — Stats: Total Words Read estimate
`src/app/api/user/stats/route.ts`: added `totalWordsRead` computed from `char_length(translatedContent)/5`.
`src/app/stats/page.tsx`: shows "Words Read" stat card with k/M suffix formatting.

### Feature 168 — StatsBar: "this hour" subtitle on Articles Today
`src/app/api/stats/route.ts`: added `articlesThisHour` count (last 60 min).
`src/components/dashboard/StatsBar.tsx`: "Articles Today" card shows sub-label "N this hour".

### Feature 167 — Article detail: serif/sans font toggle
`src/components/articles/ArticleDetail.tsx`: added `serifFont` state (localStorage `article-font-family`); "Serif" toggle button applies `font-serif` to article content.

### Feature 166 — Article card: "open original" button in hover actions
`src/components/articles/ArticleCard.tsx`: added ↗ link in hover quick-action row to open `originalUrl` in new tab.

### Feature 165 — Article detail: `?` keyboard shortcut hints overlay
`src/components/articles/ArticleDetail.tsx`: `?` key toggles a modal listing all article page keyboard shortcuts; Esc closes.

### Feature 164 — Reading list detail: shuffle sort option
`src/app/lists/[id]/page.tsx`: added "Shuffle" to sort select; uses deterministic hash (articleId × knuth + seed) so re-selecting "Shuffle" gives a new random order.

### Feature 163 — Sidebar: unread badge on "All Articles" nav item
`src/components/layout/Sidebar.tsx`: added optional `badge` prop to `NavItem`; "All Articles" now shows total unread count badge when expanded (matching region badge style).

### Feature 162 — Feeds page: filtered count includes statusFilter
`src/app/feeds/page.tsx`: filtered count label now shows when statusFilter is active; shows "X/Y feeds" ratio.

### Feature 161 — Stats page: Coverage % stat
`src/app/stats/page.tsx`: computed `totalRead / totalArticles * 100` as "Coverage" stat card.

### Feature 160 — Reading list detail: completion bar in header
`src/app/lists/[id]/page.tsx`: shows "X/N read" progress bar + percentage in header using `isRead` field from items.

### Feature 159 — Article list: "1h" date preset
`src/components/articles/ArticleList.tsx`: added "1h" (last hour) preset to date preset bar; updates `getDateFrom` to compute 1h offset.

### Feature 158 — Tags page: A-Z letter jump filter
`src/app/tags/page.tsx`: added `letterFilter` state + alphabet chip row showing only letters that have tags. Clicking a letter filters to that initial; clicking again or "All" resets.

### Feature 157 — Article card: copy link quick action
`src/components/articles/ArticleCard.tsx`: added ⎘ button on hover in the quick-action row that copies `article.originalUrl` to clipboard.

### Feature 156 — Stats page: Total Articles in DB
`src/app/api/user/stats/route.ts`: added parallel `count()` from articles table as `totalArticles`.
`src/app/stats/page.tsx`: shows "Total in DB" stat card.

### Feature 155 — Reading list detail: per-article read indicator
`src/app/api/reading-lists/[id]/route.ts`: left-join `userArticleStates` on articleId + userId, expose `isRead` on each item.
`src/app/lists/[id]/page.tsx`: show "✓ read" badge for read articles.

### Feature 154 — Reading list progress: X/N read per list
`src/app/api/reading-lists/route.ts`: added `readCount` via join with `userArticleStates`.
`src/app/lists/page.tsx`: show "X/N read" + mini progress bar per list.

### Feature 153 — Article card category badge links to region page
`src/components/articles/ArticleCard.tsx`: category badge in default variant now renders as `<a>` linking to `/region/${regionId}/${categorySlug}` when `feedRegionId` is available; falls back to plain `<span>` when not.

### Feature 152 — Stats: Best Streak (30d)
`src/app/stats/page.tsx`: computed `longestStreak` from 30-day `days` array (consecutive days with count > 0); added "Best Streak (30d)" stat card.

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

### Feature 32 — Recent search history (commit 019f276)
- Search page: saves last 8 searches to localStorage, shows as pill buttons, Clear button

### Feature 33 — NEW badge on fresh unread articles (commit 8566df6)
- Red-tinted "NEW" chip on default ArticleCard for articles < 6h old and unread

### Feature 34 — Inline list rename + word count (commit f203d2e)
- Reading list detail: click title to rename in-place (Enter/Escape)
- Article detail: word count + reading time (e.g. "4 min read · 820 words")

### Feature 35 — Dynamic page title (commit a3462ee)
- DynamicTitle: updates document.title to "(N) KAIWA" when there are unread articles

### Feature 36 — Article Prev/Next navigation (commit 530d94b)
- ArticleNav: sessionStorage-based nav list, ← → arrow key shortcuts
- GlobalShortcuts: added g+f (Feeds), g+r (Archived), g+/ (Search)

### Feature 37 — Keyboard shortcuts help updated (commit b4fb1b2)
- KeyboardShortcutsHelp updated with new shortcuts from features 36+

### Feature 38 — Sentiment distribution on stats (commit e967e57)
- /api/user/stats: sentimentDist query
- Stats page: segmented color bar + legend

### Feature 39 — Print button (commit c7174c6)
- Article detail: Print button → window.print()
- globals.css: @media print hides sidebar/nav/buttons/fixed elements

---

## Third context session — 2026-02-17 (features 40+)

### Feature 40 — Command palette (commit 46ff056)
- Cmd+K / Ctrl+K spotlight-style search modal
- Inline results, navigate to article or full search

### Feature 41 — Reading streak counter (commit 24002d6)
- Stats page: streak calculated from dailyActivity, shown as StatCard with "day(s)" suffix

### Feature 42 — Recently viewed articles in palette (commit d287357)
- CommandPalette shows last 6 viewed articles when query empty
- trackArticleView() called from ArticleDetail on load

### Feature 43 — Arrow key navigation in palette (commit a7640e9)
- ↑↓ keys move selection; Enter opens selected item or falls back to full search
- Item highlighted with bg-bg-primary

### Feature 44+45 — Oldest sort, sidebar persistence, share button (commit 32b202f)
- Added 'Oldest' option to sort dropdown (API already supported it)
- Sidebar collapsed state persisted in localStorage
- Collapsed nav items show label as title tooltip
- Share button: navigator.share() with clipboard fallback

### Feature 46 — Article page keyboard shortcuts (commit be057f9)
- s = star, r = mark read, a = archive
- o = open original source in new tab (added later)
- Updated KeyboardShortcutsHelp

### Feature 47 — Image lightbox (commit 39e4e96)
- Click hero image → full-viewport lightbox (click anywhere to dismiss)

### Feature 48+49 — Tags filter + result count (commit 8410821)
- Tags page: text input filters tag cloud client-side
- Article list: "Showing X-Y of Z articles" above pagination

### Feature 50+51 — Persist prefs, 'o' shortcut (commit 312736b)
- Article list: sort, read-filter, view-mode persisted in localStorage
- 'o' key opens original article URL in new tab

### Feature 52 — New articles banner (commit 408244b)
- Background refetch every 2 min; shows "N new articles — click to refresh" banner
- Only on page 1 + newest sort where new articles would appear

### Feature 53 — Public reading list sharing (commit 8e39ed7)
- Toggle list public/private; public URL /lists/:id/public (no auth)
- API endpoint /api/reading-lists/:id/public (no auth required)
- Middleware updated to bypass auth for public routes
- Copy Share Link button

### Feature 54 — Personal article notes (commit a1d78ee)
- Added 'note' text column to user_article_states — **DB schema pushed**
- Article detail: collapsible My Note panel with textarea, save/clear
- Dot indicator when note exists

### Feature 55 — Sentiment filter in search (commit f28aac9)
- SearchBar: sentiment dropdown
- Search API: ?sentiment= parameter

### Feature 56 — Unread badge on mobile nav (commit 4b82668)
- Total unread count badge on Home icon in mobile bottom nav

### Feature 57+58 — Accessibility + language badge (commit 0943dd2)
- "Skip to main content" link (visible on keyboard focus)
- Source language badge on article cards for non-English articles (e.g. 'ja', 'zh')

### Feature 59 — Filter within reading list (commit 9653a1f)
- Filter input appears on lists with > 4 articles, narrows by title client-side

### Feature 60 — Pagination jump-to-page input (commit 2f96c4e)
- Article list: when totalPages > 5, show number `<input>` instead of static "page/total" text
- Allows direct navigation to arbitrary pages in large result sets

### Feature 61+62 — Copy-as-markdown + Top Sources widget (commit 0da6fd7)
- Article detail: "Copy MD" button copies `[Title](url)` markdown link to clipboard
- Dashboard: TopSources widget — top 7 sources by article count today with mini bar chart
- New API: `/api/stats/sources` — top sources by count in last 24h

### Feature 63+64 — Source filter dropdown + Regions Glance (commit 305ed6f)
- Article list: source filter replaced with `<select>` dropdown, populated from `/api/feeds`
  - Filtered by regionId when on a region page
- Dashboard: RegionsGlance component — region pills with unread count badges

### Feature 65 — Trending Tags dashboard widget (commit a4da90e)
- Dashboard: TrendingTags component — top 12 tags from last 24h as clickable pills
- Tag pill size/opacity scaled by frequency; links to tag filter page
- New API: `/api/tags/trending` — top tags from articles published in last 24h

### Feature 66 + Suspense fix (commit 1ef0c49)
- Article cards: hover-visible ★ and ○/✓ quick action buttons (star/read toggle)
  - Optimistic UI with localStarred/localRead state
  - e.preventDefault() + e.stopPropagation() prevents navigation inside Link
- Bug fix: search/page.tsx wrapped in `<Suspense>` (useSearchParams requires it in Next.js 16)

### Feature 67 — All Articles page + sidebar nav (commit 68ef798)
- New route: `/articles` — global article list using ArticleList component
- Sidebar: "All Articles" nav item with grid icon

### Feature 68 — Focus mode for article reading (commit f04c045)
- Article detail: `f` key toggles focus mode — hides sidebar, expands content to max-w-2xl centered
- Focus/Exit Focus button in article action bar
- Keyboard shortcut registered in KeyboardShortcutsHelp

### Feature 69 — Feed health indicators + stale filter (commit 0c2a502)
- Feeds page: color-coded "Last:" text (orange >24h, red >48h with ⚠ warning)
- "Show stale only" toggle button to filter feeds silent >24h

### Feature 70 — Weekly reading digest clipboard export (commit 1b8154c)
- Stats page: "Copy weekly digest" button generates markdown summary of last 7 days of read articles
- New API: `/api/user/digest` — markdown digest with title, source, date, tags (up to 50 articles)

### Feature 71 — 'Surprise me' random unread article (commit f6ae538)
- Dashboard: "Surprise me" button in page header
- Navigates to a random unread summarized article from last 7 days
- New API: `/api/articles/random` — ORDER BY RANDOM() with filters

### Feature 72 — [ ] keyboard shortcuts for page navigation (commit 3599fed)
- Article list: `[` = previous page, `]` = next page
- Registered in KeyboardShortcutsHelp

### Feature 73 — autoMarkRead toggle in Settings (commit 73b4448)
- Settings > My Preferences: toggle switch for "Mark articles as read when opened"
- Wired to existing `autoMarkRead` user preference (was already in API, no UI)

### Feature 74 — Archive quick action on article cards (commit 73b4448)
- ArticleCard hover: ■ button to toggle archive alongside ★ and ○/✓
- Optimistic `localArchived` state like star/read

### Feature 75 — OPML feed export (commit 73b4448)
- New API: `/api/feeds/opml` — exports all enabled feeds as grouped OPML XML
- Feeds page: "Export OPML" download link in header

### Feature 76 — Light theme implementation (commit 73b4448)
- `globals.css`: `[data-theme="light"]` CSS variable overrides
- `ThemeApplier` client component reads user preference, applies `data-theme` to `<html>`
- Handles dark/light/system (OS prefers-color-scheme) with live MQ listener

### Feature 77 — 't' scroll-to-top shortcut (commit 7c656d1)
- GlobalShortcuts: `t` key smoothly scrolls to top
- Registered in KeyboardShortcutsHelp

### Feature 78 — Auto-expand active region in sidebar (commit 7c656d1)
- Sidebar: useEffect watches pathname, auto-expands matching region when navigating to `/region/*`

### Feature 79 — Export starred articles as markdown (commit 7c656d1)
- New API: `/api/user/starred-export` → .md download with titles, TLDRs, bullets, tags (up to 200)
- Stats page: "Export starred" download link in header

### Feature 80 — p/n article navigation shortcuts (commit 7c656d1)
- ArticleNav: `p` = previous article, `n` = next article (in addition to ← →)

### Feature 81 — 'c' shortcut to copy article link (commit 7c656d1)
- ArticleDetail keyboard handler: `c` copies current page URL to clipboard

### Feature 82 — articlesPerPage preference wired to article list (commit 7c656d1)
- ArticleList fetches user prefs and uses `articlesPerPage` (default 20) instead of hardcoded 20

### Feature 83 — Archived count in stats page (commit 0ff925f)
- Stats page: "Archived" stat card added (API already returned `totalArchived`)

### Feature 84 — Starred article card highlight (commit 0ff925f)
- Starred articles in article list show subtle gold border (`border-accent-highlight/30`)

### Feature 85 — "This Month" stat (commit 0ff925f)
- User stats API: `readThisMonth` (30-day count)
- Stats page: 4-col grid with 7 stat cards including "This Month"

### Feature 86 — Command palette `>` nav mode (commit e435244)
- CommandPalette: query starting with `>` switches to page navigation mode
- Filters 12 nav pages by label/hint; shows with `→` icon
- Allows quick keyboard-driven navigation without touching mouse

### Feature 87 — Reading status dashboard widget (commit bb0f741)
- `ReadingStatus` component: shows "X read today · Y day streak" in dashboard greeting area
- Streak calculated from daily activity set, handles yesterday-start if today not read yet
- Links to /stats page

### Feature 88 — Article source name → clickable source filter (commit bb0f741)
- Default article card: source name is now a `<button>` that navigates to `/articles?source=<name>`
- Uses `e.preventDefault()` + `e.stopPropagation()` to avoid triggering the parent Link

### Feature 89 — Articles page reads URL source/tag params (commit bb0f741)
- `src/app/articles/page.tsx` rewritten as client component with Suspense
- Reads `?source=` and `?tag=` from URL, passes as `initialSource`/`initialTag` to ArticleList
- Shows filter hint text when active

### Feature 90 — Daily reading goal (commit 24b39ba)
- userPreferences schema: added `daily_goal` integer column (default 10); DB schema pushed
- Settings page: number input for daily goal (0 = disabled)
- ReadingStatus dashboard widget: shows "X/Y today"; turns green (text-success) when goal met

### Feature 91 — 'b' keyboard shortcut to go back (commit 24b39ba)
- GlobalShortcuts: `b` calls `window.history.back()`

### Feature 92 — 'c' copy link shows toast feedback (commit 24b39ba)
- ArticleDetail keyboard handler: 'c' now calls clipboard + shows "Link copied" toast

### Feature 93 — 'l' toggles save-to-list picker on article detail (commit 24b39ba)

### Feature 94 — Mark-all-read 2-click confirmation (commit 01f0649)
- First click: button changes to 'Confirm?' (highlighted red), auto-resets after 3s
- Second click: fires the actual mark-all-read request

### Feature 95 — Inline rename reading list (commit 01f0649)
- Click 'Rename' → inline input with save/cancel; Enter to confirm, Esc to cancel
- Uses PATCH /api/reading-lists/:id which already supported name updates

### Feature 96 — Delete reading list confirmation (commit 01f0649)
- First click shows 'Sure?', auto-resets after 3s; second click deletes

### Feature 97 — Total articles count in dashboard StatsBar (commit 01f0649)
- API /api/stats now returns `totalArticles` field
- StatsBar grid changed to 4 columns, shows 'Total Articles' with locale formatting

### Feature 98 — 'i' shortcut toggles original text (commit 412365f)

### Feature 99 — RecentActivity shows readAt timestamp (commit 412365f)
- Articles API now returns `readAt` from userArticleStates join
- RecentActivity shows "read X ago" using actual read time, not publishedAt

### Feature 100 — Collapsible AI Summary section (commit 412365f)
- AI Summary section has click-to-collapse toggle, expanded by default
- Chevron icon rotates to indicate collapsed/expanded state

### Feature 101 — Tags page links to /articles?tag= (commit 0429381)
- Previously linked to /search?q= (full-text); now links to exact tag filter

### Feature 102 — 'All caught up!' empty state for unread filter (commit 0429381)
- When readFilter=unread returns 0 results: shows ✓ + "All caught up!" friendly message

### Feature 103 — readThisYear stat (commit 0429381)
- Stats API + stats page: adds "This Year" stat card (Jan 1 to today)

### Feature 104 — Language filter in article list (commit bae3237)
- Articles API: new `language` query param for sourceLanguage filtering
- ArticleList: language dropdown (ja/en/zh/ko/tl)
- Also fixed: `?tag=` param was ignored by API (was reading `?tags=`); now handles both

### Feature 105 — Copy URLs button in reading list detail (commit bae3237)
- One click copies all article original URLs as newline-separated text

### Feature 106 — Article position indicator in ArticleNav (commit 7556ff3)
- Shows "X / N" between prev/next navigation buttons

### Feature 107 — Search results pagination (commit 7556ff3)
- Prev/Next pagination on search page (API already supported it)

### Feature 108 — Total unread count in dashboard ReadingStatus (commit ed8839b)
- Shows "N unread" between read-today and streak; uses already-fetched unread-counts

### Feature 109 — Active filter chips in article list (commit ed8839b)
- Dismissible chips show active filters (source/tag/read/sentiment/language/date)
- 'Clear all' button resets all filters at once

### Feature 110 — 'd' shortcut copies TL;DR (commit 9837cf2)
- ArticleDetail keyboard handler: `d` copies summaryTldr to clipboard with "TL;DR copied" toast
- Fixed deps array for 'o' and 'd' handlers (was capturing stale closure values)

### Feature 111 — Absolute date tooltips on article card timestamps (commit 9837cf2)
- All relative time spans on ArticleCard now have `title` attribute with full date/time
- `absoluteTime()` helper: "Feb 17, 2026, 09:30 AM" format

### Feature 112 — 'v' / 'u' keyboard shortcuts in article list (commit 4928429)
- 'v': toggles compact/expanded view mode (persists to localStorage)
- 'u': toggles unread filter on/off (persists to localStorage)

### Feature 113 — Keyboard shortcuts reference in Settings page (commit 4928429)
- New "Keyboard Shortcuts" section in settings showing all shortcuts in a 2-column grid

### Feature 114 — Top tags in stats page are clickable (commit 4928429)
- Each tag links to /articles?tag= for instant filtering
- Top tag highlighted with accent color and bold weight

### Feature 115 — Reading pace + lists count in stats (commit 4928429)
- "Avg/Active Day" stat card: articles read per active day over last 30 days
- "Reading Lists" stat card: total number of reading lists created

### Feature 116 — Custom empty states for Starred and Archived pages (commit 4928429)
- Starred empty: ★ + "No starred articles yet" + hint
- Archived empty: ■ + "Nothing archived yet" + hint
- Added `emptyMessage` prop to ArticleList for custom empty state content

### Feature 117 — 'Unread First' sort option (commit 4818141)
- Articles API: new `unread_first` sort: unread articles shown before read, then newest first
- ArticleList: 'Unread First' option added to sort dropdown

### Feature 118 — Feed source names link to article list (commit 4818141)
- Feeds page: source name is now a Link to /articles?source= for quick browsing

### Feature 119 — Reading time estimate in article list footer (commit 4818141)
- Articles API now returns `readingMinutes` per article (CEIL(char_length / 1000))
- ArticleCard uses precomputed `readingMinutes` when available (avoids needing full content)
- Article list footer shows "~Xm reading on this page" or "~Xh reading on this page"

### Feature 120 — Command palette '#' quick actions mode (commit 4818141)
- Typing '#' in command palette shows quick navigation actions (unread, starred, language filters, sentiments, surprise)
- Placeholder updated: "Search articles... (> pages, # actions)"

### Feature 121 — Reading list items show article tags (commit 659e5bd)
- Each article in reading list detail shows summaryTags as small clickable links to /articles?tag=

### Feature 122 — Reading progress bar in article detail (commit 659e5bd)
- Thin accent-colored bar at top of viewport tracks scroll progress (0-100%) while reading

### Feature 123 — Today vs yesterday comparison in ReadingStatus (commit 659e5bd)
- Dashboard greeting area shows "+X vs yesterday" in green or "-X" in red when there's data

### Feature 124 — Reading list sort + filter improvements (commit 659e5bd)
- Sort dropdown: manual order / newest added / oldest added / published date
- Filter input appears when list has 2+ articles (was 4+)

### Feature 125 — StatsBar cards link to relevant pages (commit aabc301)
- "Articles Today" → /articles?datePreset=today, "Total Articles" → /articles; hover border accent

### Feature 126 — RecentActivity link updated (commit aabc301)
- "View starred →" changed to "View all read →" linking to /articles?readFilter=read

### Feature 127 — Hero card only on page 1 (commit aabc301)
- Article list hero variant disabled on pages 2+, preventing mid-list large cards

### Feature 128 — Tags page shows total tag assignments count (commit aabc301)
- Header now shows "N tags · M tag assignments" instead of just "N tags"

### Feature 129 — Article detail '↓ Read' button + content anchor (commit aabc301)
- New '↓ Read' button in action bar scrolls to article content (id="article-content")
- Only shown when translated content is available

### Feature 130 — Tag component links to /articles?tag= (commit 578237a)
- All Tag components (article cards, detail page, reading lists) now link to exact tag filter

### Feature 131 — TrendingTags links to /articles?tag= (commit 578237a)
- Dashboard TrendingTags widget fixed to use exact tag filter instead of full-text search

### Feature 132 — TopSources links to /articles?source= (commit 578237a)
- Dashboard TopSources widget fixed: was linking to /?source= which did nothing, now links to /articles?source=

### Feature 133 — 'g n' keyboard shortcut for All Articles (commit 578237a)
- GlobalShortcuts: 'g n' navigates to /articles; added to KeyboardShortcutsHelp and settings

### Feature 134 — Feeds page shows stale count in header (commit 578237a)
- Header summary appends "X stale ⚠" when enabled feeds haven't published articles in 24h+

### Feature 135 — Dashboard "Recently Viewed" widget
- New `RecentlyViewed` component reads from `kaiwa-recent-articles` localStorage key (same data as command palette history)
- Shows last 5 viewed articles with source names, links to article detail
- Placed in right column below TopSources; hidden when history is empty

### Feature 136 — Feeds page enabled/disabled status filter
- Added "All / Active / Disabled" segmented button group to feeds filter bar
- Filters by `feed.enabled` in client-side filter logic

### Feature 137 — Stats page "Best Day (30d)" stat card
- Finds the day with the highest read count in the last 30 days from `dailyActivity` data
- Shows count + date label (e.g. "47 · Feb 5")

### Feature 138 — Article detail reading time remaining updates while scrolling
- Header reading time changes from "X min read" to "Xm remaining" once the user scrolls 2%+ down
- Uses existing `readProgress` state + `readingMins` calculation

### Feature 140 — Dashboard greeting shows current day + date
- "Tuesday, February 17" subtitle appears above greeting in dashboard header
- Server-rendered using `toLocaleDateString` with weekday + month + day format

### Feature 141 — Sidebar collapsed mode shows unread dot
- When sidebar is collapsed, a small accent-colored dot appears on the logo icon when there are unread articles
- Keeps users informed of unread count even with sidebar collapsed

### Feature 142 — Article list "60d" date preset
- Added "60d" button to the All/Today/7d/30d date filter group
- `getDateFrom` function handles 60-day lookback

### Feature 143 — Tags page alphabetical sort toggle
- New "A–Z / By count" toggle button in tags filter bar
- Sorts filtered tag cloud alphabetically when toggled; defaults to by-count (API order)

### Feature 144 — Lists page header shows total count
- Subtitle: "N lists · M articles" below "My Lists" heading

### Feature 145 — Article list "Quickest Read" sort
- New sort option: "Quickest Read" — orders by shortest estimated reading time (readingMinutes ASC)
- API: new `quickest` sort case using `CEIL(char_length(COALESCE(...)) / 1000.0) ASC`

### Feature 146 — Feeds page sort dropdown
- New sort select: "Default order / Most articles / Stalest first"
- Applied to client-side sorted array after filtering

### Feature 148 — Settings page saves preference with toast
- prefsMutation now shows "Preferences saved" toast on success via useToast

### Feature 149 — RecentActivity shows article sentiment
- Dashboard Recently Read list shows sentiment label (e.g. "negative", "bullish") next to source

### Feature 150 — Article detail source name links to /articles?source=
- Clicking the source name in the article header metadata navigates to articles filtered by that source

### Feature 151 — Compact article card shows reading time
- Hoisted rt/precomputedRt computation above variant checks so compact cards now also show reading time

### Feature 147 — Stats page daily goal progress bar
- Loads user prefs (`dailyGoal`) and shows progress bar between heatmap sections
- Green accent when goal reached, shows "X/Y (Z%)" label
- Hidden when dailyGoal is 0 (default/unset)

---

## Active Build
- **kaiwa-build-f101-116-czpd2**: features 101-116 — triggered 2026-02-18

## Build History
- **kaiwa-build-tg98g** through **kaiwa-build-dtgvv**: FAILED — missing `fsGroup: 65532` in PipelineRun taskRunTemplate podTemplate securityContext
  Root cause: NFS volume owned by root:root 755; git-clone task runs as UID 65532 and can't write without fsGroup chown
  Fix: add `taskRunTemplate.podTemplate.securityContext.fsGroup: 65532` + `serviceAccountName: build-bot`
- **kaiwa-build-wnvj6**: FAILED at build-push — Next.js prerender error: useSearchParams() without Suspense in search/page.tsx
  Fix: wrap SearchPageContent in `<Suspense>` boundary

## Issues
- **kaiwa-build-6sdt9**: FAILED — wrong pipeline name
- **kaiwa-build-qnrvx**: FAILED — ParameterTypeMismatch on kaniko-extra-args
- **kaiwa-build-n6js6**: FAILED — workspace named 'source' but pipeline expects 'shared-data'
  Fixed: use workspace name 'shared-data'

