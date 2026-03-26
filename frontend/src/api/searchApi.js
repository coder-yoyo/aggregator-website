import axios from 'axios';

export async function fetchEngines() {
  const { data } = await axios.get('/api/engines');
  return data.engines || [];
}

export async function searchAggregated(params) {
  const { data } = await axios.get('/api/search', { params });
  return data;
}
