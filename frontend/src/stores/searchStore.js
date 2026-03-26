import { defineStore } from 'pinia';
import { fetchEngines, searchAggregated } from '../api/searchApi';

export const useSearchStore = defineStore('search', {
  state: () => ({
    query: '',
    loading: false,
    engines: [],
    selectedEngines: [],
    response: null,
    error: ''
  }),
  actions: {
    async init() {
      const engines = await fetchEngines();
      this.engines = engines;
      this.selectedEngines = [...engines];
    },
    async runSearch() {
      if (!this.query.trim()) {
        this.error = '请输入关键词';
        return;
      }
      if (!this.selectedEngines.length) {
        this.error = '请至少选择一个搜索引擎';
        return;
      }

      this.error = '';
      this.loading = true;
      try {
        this.response = await searchAggregated({
          q: this.query,
          engines: this.selectedEngines.join(','),
          limit: 10
        });
      } catch (err) {
        this.error = err?.response?.data?.error || err.message || '搜索失败';
      } finally {
        this.loading = false;
      }
    }
  }
});
