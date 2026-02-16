import { pgTable, serial, integer, text, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

export const feeds = pgTable('feeds', {
  id: serial('id').primaryKey(),
  minifluxFeedId: integer('miniflux_feed_id').unique().notNull(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  category: text('category', { enum: ['law', 'economics'] }).notNull(),
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

  // Translated content
  translatedTitle: text('translated_title'),
  translatedContent: text('translated_content'),
  translationStatus: text('translation_status', {
    enum: ['pending', 'translating', 'complete', 'error'],
  }).default('pending'),
  translationProvider: text('translation_provider', {
    enum: ['libretranslate', 'llm'],
  }),
  translationError: text('translation_error'),
  translatedAt: timestamp('translated_at', { withTimezone: true }),

  // AI Summary
  summaryTldr: text('summary_tldr'),
  summaryBullets: jsonb('summary_bullets').$type<string[]>(),
  summaryTags: jsonb('summary_tags').$type<string[]>(),
  summarySentiment: text('summary_sentiment', {
    enum: ['bullish', 'bearish', 'neutral', 'restrictive', 'permissive'],
  }),
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

// Relations
export const feedsRelations = relations(feeds, ({ many }) => ({
  articles: many(articles),
}));

export const articlesRelations = relations(articles, ({ one }) => ({
  feed: one(feeds, {
    fields: [articles.feedId],
    references: [feeds.id],
  }),
}));

// Types
export type Feed = typeof feeds.$inferSelect;
export type NewFeed = typeof feeds.$inferInsert;
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
