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
