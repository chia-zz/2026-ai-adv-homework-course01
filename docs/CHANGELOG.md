# 更新日誌

版本格式遵循 [Semantic Versioning](https://semver.org/)。

---

## [1.0.0] — 2026-04-16

### 初始版本

完整實作花卉電商 REST API 與 SSR 前台/後台介面。

**功能**：
- 使用者認證（註冊、登入、JWT 7 天有效期、取得個人資料）
- 公開商品瀏覽（列表分頁、詳情）
- 購物車（訪客 session 與登入用戶雙模式、數量累加、庫存驗證）
- 訂單（建立 + Transaction 原子操作、模擬付款狀態機 pending/paid/failed）
- 後台商品管理 CRUD（含刪除保護：pending 訂單商品不可刪除）
- 後台訂單管理（全量查詢、狀態篩選、含用戶資訊的詳情）
- SSR 前台頁面（首頁、商品詳情、購物車、結帳、登入、訂單列表、訂單詳情）
- SSR 後台頁面（商品管理、訂單管理）
- Tailwind CSS 4 建置流程
- Vitest + Supertest 測試套件（6 個測試檔，30 個測試案例）
- swagger-jsdoc 自動產生 OpenAPI 3.0.3 文件

**技術規格**：
- Node.js + Express 4.16
- SQLite（better-sqlite3 12，WAL 模式，外鍵啟用）
- JWT HS256，7 天有效
- bcrypt 6（production: 10 rounds；test: 1 round）
