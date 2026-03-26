const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

function normalizeText(text = '') {
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchWithTimeout(url, timeoutMs = 8000, init = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/json,application/xml;q=0.9,*/*;q=0.8',
        ...(init.headers || {})
      }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function searchBing(query, limit = 10) {
  const rssUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&format=rss`;
  const response = await fetchWithTimeout(rssUrl);
  const xml = await response.text();

  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  const titleRegex = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/;
  const linkRegex = /<link>(.*?)<\/link>/;
  const descRegex = /<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/;

  const results = [];
  let match;

  while ((match = itemRegex.exec(xml)) !== null && results.length < limit) {
    const item = match[1];
    const titleMatch = item.match(titleRegex);
    const linkMatch = item.match(linkRegex);
    const descMatch = item.match(descRegex);

    const title = normalizeText(titleMatch?.[1] || titleMatch?.[2] || '');
    const url = normalizeText(linkMatch?.[1] || '');
    const snippet = normalizeText(descMatch?.[1] || descMatch?.[2] || '');

    if (title && url) {
      results.push({ title, url, snippet, source: 'bing', rank: results.length + 1 });
    }
  }

  return results;
}

export async function searchDuckDuckGo(query, limit = 10) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const response = await fetchWithTimeout(url);
  const html = await response.text();
  const results = [];

  const blockRegex = /<div class="result[\s\S]*?<\/div>\s*<\/div>/g;
  const linkRegex = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/;
  const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>|<div[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/div>/;

  const blocks = html.match(blockRegex) || [];

  for (const block of blocks) {
    if (results.length >= limit) break;

    const linkMatch = block.match(linkRegex);
    const snippetMatch = block.match(snippetRegex);
    if (!linkMatch) continue;

    const rawHref = linkMatch[1];
    let resolvedUrl = rawHref;

    try {
      const parsed = new URL(rawHref, 'https://duckduckgo.com');
      const redirectUrl = parsed.searchParams.get('uddg');
      if (redirectUrl) resolvedUrl = decodeURIComponent(redirectUrl);
      else if (parsed.protocol.startsWith('http')) resolvedUrl = parsed.toString();
    } catch {
      continue;
    }

    results.push({
      title: normalizeText(linkMatch[2]),
      url: resolvedUrl,
      snippet: normalizeText(snippetMatch?.[1] || snippetMatch?.[2] || ''),
      source: 'duckduckgo',
      rank: results.length + 1
    });
  }

  return results;
}

export async function searchWikipedia(query, limit = 10) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=${Math.min(limit, 20)}&srsearch=${encodeURIComponent(query)}`;
  const response = await fetchWithTimeout(url, 8000, { headers: { Accept: 'application/json' } });
  const data = await response.json();
  const list = data?.query?.search || [];

  return list.slice(0, limit).map((item, index) => ({
    title: normalizeText(item.title),
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
    snippet: normalizeText(item.snippet),
    source: 'wikipedia',
    rank: index + 1
  }));
}

export const availableEngines = { bing: searchBing, duckduckgo: searchDuckDuckGo, wikipedia: searchWikipedia };
