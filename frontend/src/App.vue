<template>
  <div class="page">
    <a-card class="search-card" :bordered="false">
      <template #title>聚合搜索（Vue3 + Ant Design Vue）</template>

      <a-space direction="vertical" style="width: 100%" size="middle">
        <a-input-search
          v-model:value="store.query"
          size="large"
          placeholder="输入关键词，例如：OpenAI Agent"
          enter-button="搜索"
          :loading="store.loading"
          @search="store.runSearch"
        />

        <a-checkbox-group v-model:value="store.selectedEngines" :options="engineOptions" />

        <a-alert v-if="store.error" type="error" :message="store.error" show-icon />

        <a-alert
          v-if="store.response"
          type="info"
          show-icon
          :message="`耗时 ${store.response.elapsedMs} ms，聚合结果 ${store.response.aggregated.length} 条`"
        />
      </a-space>
    </a-card>

    <a-row :gutter="16" style="margin-top: 16px">
      <a-col :span="16">
        <a-card title="聚合结果" :bordered="false">
          <a-empty v-if="!store.response || !store.response.aggregated.length" description="暂无结果" />
          <a-list v-else :data-source="store.response.aggregated" item-layout="vertical">
            <template #renderItem="{ item }">
              <a-list-item>
                <a-typography-title :level="5" style="margin-bottom: 6px">
                  <a :href="item.url" target="_blank">{{ item.title }}</a>
                </a-typography-title>
                <div class="url">{{ item.url }}</div>
                <div class="snippet">{{ item.snippet || '暂无摘要' }}</div>
                <a-tag color="blue">Rank #{{ item.aggregatedRank }}</a-tag>
                <a-tag color="purple">Score {{ item.totalScore }}</a-tag>
                <a-tag v-for="it in item.appearances" :key="`${it.source}-${it.rank}`">
                  {{ it.source }} #{{ it.rank }}
                </a-tag>
              </a-list-item>
            </template>
          </a-list>
        </a-card>
      </a-col>

      <a-col :span="8">
        <a-card title="引擎状态" :bordered="false">
          <a-empty v-if="!store.response" description="请先搜索" />
          <a-list v-else :data-source="store.response.engines" size="small">
            <template #renderItem="{ item }">
              <a-list-item>
                <a-space direction="vertical" size="small">
                  <strong>{{ item.engine }}</strong>
                  <a-tag :color="item.status === 'ok' ? 'green' : 'red'">{{ item.status }}</a-tag>
                  <span>结果数：{{ item.count }}</span>
                  <span v-if="item.error" class="error">{{ item.error }}</span>
                </a-space>
              </a-list-item>
            </template>
          </a-list>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useSearchStore } from './stores/searchStore';

const store = useSearchStore();
const engineOptions = computed(() => store.engines.map((e) => ({ label: e, value: e })));

onMounted(async () => {
  await store.init();
});
</script>
