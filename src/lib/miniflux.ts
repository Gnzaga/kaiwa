import { config } from './config';

const baseUrl = config.miniflux.url;
const headers = {
  'X-Auth-Token': config.miniflux.apiKey,
  'Content-Type': 'application/json',
};

interface MinifluxEntry {
  id: number;
  feed_id: number;
  title: string;
  url: string;
  content: string;
  status: string;
  published_at: string;
  feed: {
    id: number;
    title: string;
    site_url: string;
    category: {
      id: number;
      title: string;
    };
  };
  enclosures?: { url: string; mime_type: string }[];
}

interface MinifluxEntriesResponse {
  total: number;
  entries: MinifluxEntry[];
}

interface MinifluxFeed {
  id: number;
  title: string;
  feed_url: string;
  site_url: string;
  category: {
    id: number;
    title: string;
  };
}

interface MinifluxCategory {
  id: number;
  title: string;
}

interface MinifluxDiscoverResult {
  url: string;
  title: string;
}

export type { MinifluxEntry, MinifluxEntriesResponse, MinifluxFeed };

export async function fetchEntries(params: {
  status?: string;
  category_id?: number;
  limit?: number;
  offset?: number;
} = {}): Promise<MinifluxEntriesResponse> {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set('status', params.status);
  if (params.category_id) searchParams.set('category_id', String(params.category_id));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.offset) searchParams.set('offset', String(params.offset));

  const url = `${baseUrl}/v1/entries?${searchParams.toString()}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Miniflux fetchEntries failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function fetchFeeds(): Promise<MinifluxFeed[]> {
  const res = await fetch(`${baseUrl}/v1/feeds`, { headers });
  if (!res.ok) {
    throw new Error(`Miniflux fetchFeeds failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function markAsRead(entryId: number): Promise<void> {
  const res = await fetch(`${baseUrl}/v1/entries`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ entry_ids: [entryId], status: 'read' }),
  });
  if (!res.ok) {
    throw new Error(`Miniflux markAsRead failed: ${res.status} ${res.statusText}`);
  }
}

export async function discoverFeed(url: string): Promise<MinifluxDiscoverResult[]> {
  const res = await fetch(`${baseUrl}/v1/discover`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Miniflux discover failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function createFeed(params: { feed_url: string; category_id: number }): Promise<{ feed_id: number }> {
  const res = await fetch(`${baseUrl}/v1/feeds`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Miniflux createFeed failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function getOrCreateCategory(title: string): Promise<number> {
  // Try to find existing category
  const res = await fetch(`${baseUrl}/v1/categories`, { headers });
  if (!res.ok) {
    throw new Error(`Miniflux getCategories failed: ${res.status}`);
  }
  const categories: MinifluxCategory[] = await res.json();
  const existing = categories.find(c => c.title === title);
  if (existing) return existing.id;

  // Create new category
  const createRes = await fetch(`${baseUrl}/v1/categories`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ title }),
  });
  if (!createRes.ok) {
    throw new Error(`Miniflux createCategory failed: ${createRes.status}`);
  }
  const created: MinifluxCategory = await createRes.json();
  return created.id;
}
