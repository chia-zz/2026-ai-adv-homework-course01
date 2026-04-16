# 更新日誌

版本格式遵循 [Semantic Versioning](https://semver.org/)。

---

## [Unreleased]

### Added
- **綠界 ECPay 金流串接**（`src/routes/ecpayRoutes.js`）
  - `POST /api/ecpay/checkout`：產生 AIO 付款表單參數（含 SHA256 CheckMacValue），前端動態建立 `<form>` 並 submit 到綠界
  - `POST /api/ecpay/result`：OrderResultURL endpoint，綠界付款後由使用者瀏覽器 POST 回來（本地端可收到）。驗證 CheckMacValue 後更新訂單狀態並 redirect 至訂單詳情頁
  - `POST /api/ecpay/return`：ReturnURL dummy endpoint（本地端收不到，但綠界 API 必填），回傳 `1|OK`
  - `POST /api/ecpay/query`：主動呼叫綠界 Query API 查詢付款狀態（備援，OrderResultURL 未觸達時使用）

### Changed
- **訂單詳情頁付款流程**：原先的模擬「付款成功 / 付款失敗」按鈕，改為「前往付款（綠界）」+ 「查詢付款結果」按鈕，串接真實金流
- **Header 購物車 badge**：修正顯示數字為實際購買總數量（Σ item.quantity），而非品項種類數（items.length）
- **商品詳情頁加入購物車**：badge 增量改為使用者選取的數量，而非固定 +1
- **購物車頁數量調整**：修改數量或刪除品項時即時同步 header badge
- **Header「商品列表」連結**：由 `/` 改為 `/#products`，點擊直接捲動至首頁商品區塊

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
