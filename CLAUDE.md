# CLAUDE.md

## 專案概述

花卉電商 (Flower E-Commerce) — Node.js + Express + EJS + SQLite + Tailwind CSS

Server-Side Rendered (SSR) 電商後端，提供前台購物流程與後台管理功能。使用 better-sqlite3 做同步 I/O，JWT + X-Session-Id 雙模式認證，全 CommonJS 模組系統（vitest.config.js 除外為 ESM）。

## 常用指令

```bash
npm start          # 建置 CSS 後啟動 (production)
npm run dev:server # 只啟動 server（開發用）
npm run dev:css    # 只監聽 CSS 變更
npm run css:build  # 建置並壓縮 CSS
npm run openapi    # 產生 OpenAPI spec（輸出至 openapi.json）
npm test           # 執行所有測試（vitest run）
```

## 關鍵規則

- **統一回應格式**：所有 API 回應必須為 `{ data, error, message }`，成功時 `error: null`，失敗時 `data: null`
- **雙模式認證**：購物車 API 支援 Bearer JWT 或 `X-Session-Id` header，二者互斥；若帶了無效 JWT 則直接回 401，不 fallback 至 session
- **訂單只讀 user_id 的購物車**：建立訂單時只撈 `user_id = ?` 的購物車項目，所以訪客必須先登入才能結帳
- **SQLite 同步 API**：`better-sqlite3` 為同步操作，路由 handler 不需要 `async/await`
- **管理員保護刪除**：商品有 `pending` 訂單時無法刪除（回 409）
- 功能開發使用 `docs/plans/` 記錄計畫；完成後移至 `docs/plans/archive/`

## 詳細文件

- [./docs/README.md](./docs/README.md) — 項目介紹與快速開始
- [./docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — 架構、目錄結構、資料流
- [./docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) — 開發規範、命名規則
- [./docs/FEATURES.md](./docs/FEATURES.md) — 功能列表與完成狀態
- [./docs/TESTING.md](./docs/TESTING.md) — 測試規範與指南
- [./docs/CHANGELOG.md](./docs/CHANGELOG.md) — 更新日誌
