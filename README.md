# 聚合搜索网站（Java + Vue3 + Ant Design Vue + Pinia）

这是一个完整的**前后端分离**聚合搜索网站：

- **后端**：Java 17 + Spring Boot 3
- **前端**：Vue 3 + Vite + Ant Design Vue + Pinia

支持同时从多个搜索来源拉取结果，并做聚合去重排序。

---

## 功能概览

- 多引擎并发搜索：
  - Bing（RSS）
  - DuckDuckGo（HTML 解析）
  - Wikipedia（API）
- 统一聚合排序：
  - 按引擎内 rank 计算 score
  - 同 URL 自动合并并累计分数
- 前端界面：
  - 简洁美观（Ant Design Vue）
  - Pinia 管理查询状态、加载态、错误态
  - 显示聚合结果 + 每个引擎状态

---

## 项目结构

```text
.
├── backend/
│   ├── pom.xml
│   └── src/main/java/com/example/aggregator/
│       ├── AggregatorApplication.java
│       ├── config/WebConfig.java
│       ├── controller/SearchController.java
│       ├── dto/*
│       └── service/SearchService.java
└── frontend/
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.vue
        ├── main.js
        ├── style.css
        ├── api/searchApi.js
        └── stores/searchStore.js
```

---

## 后端启动

```bash
cd backend
mvn spring-boot:run
```

默认地址：`http://localhost:8080`

### 后端 API

- `GET /api/engines`
- `GET /api/search?q=OpenAI&engines=bing,duckduckgo,wikipedia&limit=10`

---

## 前端启动

```bash
cd frontend
npm install
npm run dev
```

默认地址：`http://localhost:5173`（已代理 `/api` 到 `http://localhost:8080`）

---

## 测试

后端包含基础单元测试：

```bash
cd backend
mvn test
```

---

## 后续可扩展

- 增加更多搜索适配器（新闻、学术、代码搜索）
- 引入缓存层（Redis）降低第三方请求压力
- 增加用户偏好权重与个性化排序
