import { pgTable, serial, integer, text, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

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
  summaryStatus: text('summary_status', {
    enum: ['pending', 'summarizing', 'complete', 'error'],
  }).default('pending'),
  summaryError: text('summary_error'),
  summarizedAt: timestamp('summarized_at', { withTimezone: true }),

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

// ─── Relations ──────────────────────────────────────────────────────

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
}));

export const articlesRelations = relations(articles, ({ one }) => ({
  feed: one(feeds, {
    fields: [articles.feedId],
    references: [feeds.id],
  }),
}));

// ─── Types ──────────────────────────────────────────────────────────

export type Region = typeof regions.$inferSelect;
export type NewRegion = typeof regions.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Feed = typeof feeds.$inferSelect;
export type NewFeed = typeof feeds.$inferInsert;
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
