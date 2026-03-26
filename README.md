# Aggregator Website

一个完整的聚合搜索网站示例，包含：

- **后端（Node.js 原生 HTTP）**：并发请求多个搜索引擎，并做结果聚合/去重/排序。
- **前端（Vanilla HTML/CSS/JS）**：提供查询输入、搜索引擎勾选、结果展示和错误提示。

## 功能特性

- 同时搜索多个来源：
  - Bing（RSS）
  - DuckDuckGo（HTML 页面解析）
  - Wikipedia（开放 API）
- 聚合排序：
  - 按来源内排名计算分数
  - 多来源命中的相同 URL 自动合并并累加分数
- 接口设计：
  - `GET /api/engines`：返回支持的搜索引擎列表
  - `GET /api/search?q=...&engines=bing,duckduckgo,wikipedia&limit=10`

## 本地运行

> 需要 Node.js 20+

```bash
npm install
npm run dev
```

打开：<http://localhost:3000>

## 目录结构

```text
.
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── src/
│   ├── server.js
│   ├── services/
│   │   └── searchEngines.js
│   └── utils/
│       └── aggregate.js
└── tests/
    └── aggregate.test.js
```

## 测试

```bash
npm test
```

## 可扩展建议

- 增加新的搜索适配器（如学术/新闻/代码搜索等）
- 给不同来源引入动态权重配置
- 增加缓存（Redis）和限流
- 在前端增加“按来源筛选”和“结果分组视图”
