function canonicalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';

    if (parsed.hostname.startsWith('www.')) {
      parsed.hostname = parsed.hostname.slice(4);
    }

    if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    return parsed.toString();
  } catch {
    return url;
  }
}

export function computeScore(rank, sourceWeight = 1) {
  return Number((sourceWeight * (1 / Math.max(rank, 1))).toFixed(6));
}

export function aggregateAndRank(resultGroups, sourceWeights = {}) {
  const merged = new Map();

  for (const [source, results] of Object.entries(resultGroups)) {
    const weight = sourceWeights[source] ?? 1;

    for (const result of results) {
      const key = canonicalizeUrl(result.url);
      const score = computeScore(result.rank, weight);

      if (!merged.has(key)) {
        merged.set(key, {
          title: result.title,
          url: result.url,
          snippet: result.snippet,
          totalScore: score,
          appearances: [{ source, rank: result.rank, score }]
        });
      } else {
        const existing = merged.get(key);
        existing.totalScore = Number((existing.totalScore + score).toFixed(6));
        existing.appearances.push({ source, rank: result.rank, score });

        if ((result.snippet || '').length > (existing.snippet || '').length) {
          existing.snippet = result.snippet;
        }
      }
    }
  }

  return Array.from(merged.values())
    .sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      return a.title.localeCompare(b.title);
    })
    .map((item, index) => ({ ...item, aggregatedRank: index + 1 }));
}
