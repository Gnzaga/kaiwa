import { pgTable, serial, integer, text, boolean, timestamp, jsonb, index, primaryKey, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// ─── Auth tables (NextAuth Drizzle Adapter) ─────────────────────────

export const users = pgTable('user', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image: text('image'),
  isAdmin: boolean('is_admin').default(false),
});

export const accounts = pgTable('account', {
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('providerAccountId').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
}, (table) => [
  primaryKey({ columns: [table.provider, table.providerAccountId] }),
]);

export const sessions = pgTable('session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable('verificationToken', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.identifier, table.token] }),
]);

// ─── Reference tables ───────────────────────────────────────────────

export const regions = pgTable('regions', {
  id: text('id').primaryKey(), // 'jp', 'us', 'ph', 'tw'
  name: text('name').notNull(),
  code: text('code').unique().notNull(), // ISO 3166-1: 'JP', 'US', 'PH', 'TW'
  defaultLanguage: text('default_language').notNull(), // 'ja', 'en', 'tl', 'zh'
  flagEmoji: text('flag_emoji').notNull(),
  enabled: boolean('enabled').default(true),
  sortOrder: integer('sort_order').default(0),
});

export const categories = pgTable('categories', {
  id: text('id').primaryKey(), // 'jp-law', 'us-politics', etc.
  regionId: text('region_id').references(() => regions.id).notNull(),
  slug: text('slug').notNull(), // 'law', 'politics', 'tech'
  name: text('name').notNull(),
  icon: text('icon'), // optional icon identifier
  enabled: boolean('enabled').default(true),
  sortOrder: integer('sort_order').default(0),
});

// ─── Core tables ────────────────────────────────────────────────────

export const feeds = pgTable('feeds', {
  id: serial('id').primaryKey(),
  minifluxFeedId: integer('miniflux_feed_id').unique().notNull(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  regionId: text('region_id').references(() => regions.id).notNull(),
  categoryId: text('category_id').references(() => categories.id).notNull(),
  sourceLanguage: text('source_language').default('ja').notNull(),
  sourceName: text('source_name').notNull(),
  enabled: boolean('enabled').default(true),
  submittedByUserId: text('submitted_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const articles = pgTable('articles', {
  id: serial('id').primaryKey(),
  minifluxEntryId: integer('miniflux_entry_id').unique().notNull(),
  feedId: integer('feed_id').references(() => feeds.id),

  // Original content
  originalTitle: text('original_title').notNull(),
  originalContent: text('original_content').notNull(),
  originalUrl: text('original_url').notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),

  // Multi-language support
  sourceLanguage: text('source_language').default('ja').notNull(),
  imageUrl: text('image_url'),

  // Translated content
  translatedTitle: text('translated_title'),
  translatedContent: text('translated_content'),
  translationStatus: text('translation_status', {
    enum: ['pending', 'translating', 'complete', 'error'],
  }).default('pending'),
  translationProvider: text('translation_provider', {
    enum: ['libretranslate', 'llm', 'passthrough'],
  }),
  translationError: text('translation_error'),
  translatedAt: timestamp('translated_at', { withTimezone: true }),

  // AI Summary
  summaryTldr: text('summary_tldr'),
  summaryBullets: jsonb('summary_bullets').$type<string[]>(),
  summaryTags: jsonb('summary_tags').$type<string[]>(),
  summarySentiment: text('summary_sentiment'),
  summaryCategory: text('summary_category'),
  summaryStatus: text('summary_status', {
    enum: ['pending', 'summarizing', 'complete', 'error'],
  }).default('pending'),
  summaryError: text('summary_error'),
  summarizedAt: timestamp('summarized_at', { withTimezone: true }),

  // Embedding
  embeddingStatus: text('embedding_status', {
    enum: ['pending', 'embedding', 'complete', 'error'],
  }).default('pending'),
  embeddingError: text('embedding_error'),
  embeddedAt: timestamp('embedded_at', { withTimezone: true }),

  // User state
  isRead: boolean('is_read').default(false),
  isStarred: boolean('is_starred').default(false),
  isArchived: boolean('is_archived').default(false),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_articles_published').on(table.publishedAt),
  index('idx_articles_feed').on(table.feedId),
  index('idx_articles_status').on(table.translationStatus, table.summaryStatus),
  index('idx_articles_search').using(
    'gin',
    sql`to_tsvector('english', COALESCE(${table.translatedTitle}, '') || ' ' || COALESCE(${table.translatedContent}, '') || ' ' || COALESCE(${table.summaryTldr}, ''))`
  ),
]);

// ─── Per-user article state ─────────────────────────────────────────

export const userArticleStates = pgTable('user_article_states', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  articleId: integer('article_id').notNull().references(() => articles.id, { onDelete: 'cascade' }),
  isRead: boolean('is_read').default(false).notNull(),
  isStarred: boolean('is_starred').default(false).notNull(),
  isArchived: boolean('is_archived').default(false).notNull(),
  readAt: timestamp('read_at', { withTimezone: true }),
  starredAt: timestamp('starred_at', { withTimezone: true }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.articleId] }),
  index('idx_uas_user').on(table.userId),
  index('idx_uas_user_starred').on(table.userId, table.isStarred),
  index('idx_uas_user_read').on(table.userId, table.isRead),
]);

// ─── Reading lists / collections ────────────────────────────────────

export const readingLists = pgTable('reading_lists', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  isPublic: boolean('is_public').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const readingListItems = pgTable('reading_list_items', {
  id: serial('id').primaryKey(),
  readingListId: integer('reading_list_id').notNull().references(() => readingLists.id, { onDelete: 'cascade' }),
  articleId: integer('article_id').notNull().references(() => articles.id, { onDelete: 'cascade' }),
  note: text('note'),
  sortOrder: integer('sort_order').default(0),
  addedAt: timestamp('added_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_rli_list').on(table.readingListId),
]);

// ─── User preferences ──────────────────────────────────────────────

export const userPreferences = pgTable('user_preferences', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  defaultRegionId: text('default_region_id').references(() => regions.id),
  theme: text('theme', { enum: ['system', 'dark', 'light'] }).default('system'),
  articlesPerPage: integer('articles_per_page').default(20),
  autoMarkRead: boolean('auto_mark_read').default(true),
  dailyGoal: integer('daily_goal').default(10),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ─── User muted sources ─────────────────────────────────────────────

export const userMutedSources = pgTable('user_muted_sources', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  feedId: integer('feed_id').notNull().references(() => feeds.id, { onDelete: 'cascade' }),
  mutedAt: timestamp('muted_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.feedId] }),
]);

// ─── Relations ──────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many, one }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  userArticleStates: many(userArticleStates),
  readingLists: many(readingLists),
  preferences: one(userPreferences, {
    fields: [users.id],
    references: [userPreferences.userId],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const regionsRelations = relations(regions, ({ many }) => ({
  categories: many(categories),
  feeds: many(feeds),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  region: one(regions, {
    fields: [categories.regionId],
    references: [regions.id],
  }),
  feeds: many(feeds),
}));

export const feedsRelations = relations(feeds, ({ one, many }) => ({
  region: one(regions, {
    fields: [feeds.regionId],
    references: [regions.id],
  }),
  category: one(categories, {
    fields: [feeds.categoryId],
    references: [categories.id],
  }),
  articles: many(articles),
  submittedBy: one(users, {
    fields: [feeds.submittedByUserId],
    references: [users.id],
  }),
}));

export const articlesRelations = relations(articles, ({ one, many }) => ({
  feed: one(feeds, {
    fields: [articles.feedId],
    references: [feeds.id],
  }),
  userStates: many(userArticleStates),
}));

export const userArticleStatesRelations = relations(userArticleStates, ({ one }) => ({
  user: one(users, {
    fields: [userArticleStates.userId],
    references: [users.id],
  }),
  article: one(articles, {
    fields: [userArticleStates.articleId],
    references: [articles.id],
  }),
}));

export const readingListsRelations = relations(readingLists, ({ one, many }) => ({
  user: one(users, {
    fields: [readingLists.userId],
    references: [users.id],
  }),
  items: many(readingListItems),
}));

export const readingListItemsRelations = relations(readingListItems, ({ one }) => ({
  readingList: one(readingLists, {
    fields: [readingListItems.readingListId],
    references: [readingLists.id],
  }),
  article: one(articles, {
    fields: [readingListItems.articleId],
    references: [articles.id],
  }),
}));

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userPreferences.userId],
    references: [users.id],
  }),
  defaultRegion: one(regions, {
    fields: [userPreferences.defaultRegionId],
    references: [regions.id],
  }),
}));

// ─── Types ──────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type Region = typeof regions.$inferSelect;
export type NewRegion = typeof regions.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Feed = typeof feeds.$inferSelect;
export type NewFeed = typeof feeds.$inferInsert;
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type UserArticleState = typeof userArticleStates.$inferSelect;
export type ReadingList = typeof readingLists.$inferSelect;
export type ReadingListItem = typeof readingListItems.$inferSelect;
export type UserPreferences = typeof userPreferences.$inferSelect;
