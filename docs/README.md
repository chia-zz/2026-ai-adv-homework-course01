# 花卉電商 — 專案介紹

花卉電商是一個全端 SSR 電商系統，前台供訪客與會員購買花卉商品，後台供管理員管理商品與訂單。

## 技術棧

| 層級 | 技術 |
|------|------|
| 執行環境 | Node.js |
| Web 框架 | Express 4.16 |
| 模板引擎 | EJS 5（雙 layout：front / admin） |
| 資料庫 | SQLite（better-sqlite3 12，WAL 模式） |
| 認證 | JWT（jsonwebtoken 9，HS256，7 天有效期） |
| 密碼雜湊 | bcrypt 6（saltRounds = 10，測試環境為 1） |
| UUID | uuid v4 |
| CSS 框架 | Tailwind CSS 4（@tailwindcss/cli 建置） |
| 測試 | Vitest 2 + Supertest 7 |
| API 文件 | swagger-jsdoc 6（JSDoc 標注 → openapi.json） |
| 跨域 | cors 2 |

## 快速開始

### 1. 安裝相依套件

```bash
npm install
```

### 2. 設定環境變數

```bash
cp .env.example .env
# 編輯 .env，至少填入 JWT_SECRET
```

### 3. 啟動開發環境（兩個終端機）

```bash
# 終端機 1：監聽 CSS 變更
npm run dev:css

# 終端機 2：啟動 Server
npm run dev:server
```

瀏覽器開啟 http://localhost:3001

### 4. 直接啟動（production）

```bash
npm start
# 等同於：npm run css:build && node server.js
```

> **注意**：`server.js` 啟動時會檢查 `JWT_SECRET` 是否存在，不存在會 `process.exit(1)`。

### 5. 初始帳號

| 角色 | Email | 密碼 |
|------|-------|------|
| 管理員 | admin@hexschool.com | 12345678 |

帳號在首次啟動時由 `src/database.js` 自動 seed。

## 常用指令

```bash
npm start          # CSS build + 啟動 server
npm run dev:server # 只啟動 server
npm run dev:css    # 監聽 CSS（watch mode）
npm run css:build  # 建置並壓縮 CSS
npm run openapi    # 產生 openapi.json
npm test           # 執行所有測試
```

## 文件索引

| 文件 | 說明 |
|------|------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 目錄結構、啟動流程、API 路由表、DB Schema、認證機制 |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | 開發規範、命名規則、新增 API 步驟、環境變數說明 |
| [FEATURES.md](./FEATURES.md) | 所有功能的行為描述、端點、錯誤情境 |
| [TESTING.md](./TESTING.md) | 測試結構、執行順序、撰寫新測試的指南 |
| [CHANGELOG.md](./CHANGELOG.md) | 版本更新日誌 |
