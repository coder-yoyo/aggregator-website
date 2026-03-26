import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateAndRank, computeScore } from '../src/utils/aggregate.js';

test('computeScore should inversely scale by rank', () => {
  assert.equal(computeScore(1, 1), 1);
  assert.equal(computeScore(2, 1), 0.5);
  assert.equal(computeScore(1, 0.8), 0.8);
});

test('aggregateAndRank should merge duplicate URLs and sort by score', () => {
  const result = aggregateAndRank({
    bing: [
      { title: 'A', url: 'https://example.com/', snippet: 'a', rank: 1 },
      { title: 'B', url: 'https://another.com', snippet: 'b', rank: 2 }
    ],
    duckduckgo: [{ title: 'A2', url: 'https://www.example.com', snippet: 'better snippet', rank: 3 }]
  });

  assert.equal(result.length, 2);
  assert.equal(result[0].url, 'https://example.com/');
  assert.equal(result[0].appearances.length, 2);
  assert.equal(result[0].snippet, 'better snippet');
  assert.equal(result[0].aggregatedRank, 1);
});
