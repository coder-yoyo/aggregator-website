const form = document.getElementById('search-form');
const queryInput = document.getElementById('query');
const statusEl = document.getElementById('status');
const errorsEl = document.getElementById('errors');
const resultsEl = document.getElementById('aggregated-results');
const resultTemplate = document.getElementById('result-template');

function getSelectedEngines() {
  return Array.from(document.querySelectorAll('#engine-options input:checked')).map((item) => item.value);
}

function setStatus(text) {
  statusEl.textContent = text;
}

function setErrors(items = []) {
  if (!items.length) {
    errorsEl.textContent = '';
    return;
  }

  errorsEl.innerHTML = items
    .map((item) => `<div>⚠️ ${item.engine}: ${item.error || 'Search failed'}</div>`)
    .join('');
}

function renderResults(results = []) {
  resultsEl.innerHTML = '';

  if (!results.length) {
    resultsEl.innerHTML = '<p>No results found.</p>';
    return;
  }

  for (const result of results) {
    const fragment = resultTemplate.content.cloneNode(true);
    const link = fragment.querySelector('a');
    const url = fragment.querySelector('.url');
    const snippet = fragment.querySelector('.snippet');
    const meta = fragment.querySelector('.meta');

    link.textContent = result.title || result.url;
    link.href = result.url;
    url.textContent = result.url;
    snippet.textContent = result.snippet || 'No snippet available.';
    meta.textContent = `Aggregated rank #${result.aggregatedRank} · score ${result.totalScore.toFixed(
      4
    )} · sources: ${result.appearances.map((item) => `${item.source}#${item.rank}`).join(', ')}`;

    resultsEl.appendChild(fragment);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const q = queryInput.value.trim();
  const engines = getSelectedEngines();

  if (!q) {
    setStatus('Please enter a query.');
    return;
  }

  if (!engines.length) {
    setStatus('Please select at least one search engine.');
    return;
  }

  setStatus('Searching...');
  setErrors([]);
  renderResults([]);

  const params = new URLSearchParams({ q, engines: engines.join(','), limit: '10' });

  try {
    const response = await fetch(`/api/search?${params}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const failed = data.engines.filter((item) => item.status === 'error');
    const successful = data.engines.filter((item) => item.status === 'ok');

    setStatus(
      `Done in ${data.elapsedMs}ms · ${data.aggregated.length} merged results · successful engines: ${successful.length}/${data.engines.length}`
    );
    setErrors(failed);
    renderResults(data.aggregated);
  } catch (error) {
    setStatus(`Search failed: ${error.message}`);
  }
});
