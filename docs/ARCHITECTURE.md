# 架構說明

## 目錄結構

```
.
├── server.js                  # 進入點：檢查 JWT_SECRET，呼叫 app.listen
├── app.js                     # Express 應用建立：middleware + 路由 + 錯誤處理
├── swagger-config.js          # swagger-jsdoc 設定（OpenAPI 3.0.3）
├── generate-openapi.js        # CLI 工具：讀 swagger-config → 輸出 openapi.json
├── vitest.config.js           # 測試設定（ESM，指定執行順序、關閉平行）
├── package.json
├── .env.example               # 環境變數範本
├── database.sqlite            # SQLite 資料庫檔案（首次啟動時自動建立）
│
├── src/
│   ├── database.js            # DB 連線 + 建表 + seed（自動執行 initializeDatabase）
│   ├── middleware/
│   │   ├── authMiddleware.js  # JWT 驗證，設置 req.user
│   │   ├── adminMiddleware.js # 確認 req.user.role === 'admin'
│   │   ├── sessionMiddleware.js # 讀 X-Session-Id header → req.sessionId
│   │   └── errorHandler.js    # 全域錯誤處理，防止內部訊息洩漏
│   └── routes/
│       ├── authRoutes.js      # POST /register, POST /login, GET /profile
│       ├── productRoutes.js   # GET /products, GET /products/:id（公開）
│       ├── cartRoutes.js      # 購物車 CRUD（雙模式認證）
│       ├── orderRoutes.js     # 訂單 CRUD + 模擬付款（JWT 必要）
│       ├── adminProductRoutes.js # 後台商品 CRUD（admin JWT）
│       ├── adminOrderRoutes.js   # 後台訂單列表 + 詳情（admin JWT）
│       ├── ecpayRoutes.js     # 綠界金流：產生表單、接收付款結果、Query API
│       └── pageRoutes.js      # SSR 頁面路由（EJS 渲染）
│
├── views/
│   ├── layouts/
│   │   ├── front.ejs          # 前台 layout（含 header、footer）
│   │   └── admin.ejs          # 後台 layout（含側邊欄）
│   ├── partials/              # 共用片段（header、sidebar 等）
│   └── pages/
│       ├── index.ejs          # 首頁（商品列表）
│       ├── product-detail.ejs # 商品詳情
│       ├── cart.ejs           # 購物車
│       ├── checkout.ejs       # 結帳
│       ├── login.ejs          # 登入
│       ├── orders.ejs         # 我的訂單
│       ├── order-detail.ejs   # 訂單詳情（含付款結果）
│       ├── 404.ejs            # 404 頁面
│       └── admin/
│           ├── products.ejs   # 後台商品管理
│           └── orders.ejs     # 後台訂單管理
│
├── public/
│   ├── css/
│   │   ├── input.css          # Tailwind 來源（@import tailwindcss）
│   │   └── output.css         # 建置後的 CSS（git 忽略）
│   ├── js/
│   │   ├── api.js             # 前端 fetch 封裝（帶 token/session header）
│   │   ├── auth.js            # 前端 JWT 儲存與讀取（localStorage）
│   │   ├── header-init.js     # 頁面 header 的登入狀態初始化
│   │   ├── notification.js    # 通知 toast 元件
│   │   └── pages/             # 各頁面的 JS（index.js, cart.js, checkout.js…）
│   └── stylesheets/           # 靜態 CSS（非 Tailwind）
│
└── tests/
    ├── setup.js               # 共用 helper：getAdminToken, registerUser
    ├── auth.test.js
    ├── products.test.js
    ├── cart.test.js
    ├── orders.test.js
    ├── adminProducts.test.js
    └── adminOrders.test.js
```

## 啟動流程

```
node server.js
  ├─ 檢查 process.env.JWT_SECRET（不存在 → process.exit(1)）
  └─ require('./app')
       ├─ dotenv.config()
       ├─ require('./src/database')
       │    ├─ Database('database.sqlite') + pragma WAL + foreign_keys
       │    ├─ CREATE TABLE IF NOT EXISTS（5 張表）
       │    ├─ seedAdminUser()（若 admin email 不存在則插入）
       │    └─ seedProducts()（若 products 表為空則插入 8 筆）
       ├─ app = express()
       ├─ app.set('view engine', 'ejs')
       ├─ app.use(cors, json, urlencoded, sessionMiddleware)
       ├─ 掛載 API 路由（/api/*）
       ├─ 掛載頁面路由（/）
       ├─ 404 handler（API → JSON；頁面 → 404.ejs）
       └─ errorHandler
```

## API 路由總覽

| 前綴 | 檔案 | 認證 | 說明 |
|------|------|------|------|
| `/api/auth` | `authRoutes.js` | 無（register/login）/ JWT（profile） | 註冊、登入、取個人資料 |
| `/api/products` | `productRoutes.js` | 無 | 公開商品列表與詳情 |
| `/api/cart` | `cartRoutes.js` | JWT 或 X-Session-Id（雙模式） | 購物車 CRUD |
| `/api/orders` | `orderRoutes.js` | JWT 必要 | 建立訂單、訂單列表、詳情、模擬付款 |
| `/api/ecpay` | `ecpayRoutes.js` | JWT（checkout/query）/ 無（result/return） | 綠界金流：產生表單、接收付款結果、Query 備援 |
| `/api/admin/products` | `adminProductRoutes.js` | JWT + admin role | 後台商品管理 CRUD |
| `/api/admin/orders` | `adminOrderRoutes.js` | JWT + admin role | 後台訂單查詢 |
| `/` | `pageRoutes.js` | 無（SSR 頁面，前端 JS 自行驗證） | EJS 頁面渲染 |

## 統一回應格式

所有 `/api/*` 路由皆使用此格式回應：

```json
// 成功
{
  "data": { ... },
  "error": null,
  "message": "成功"
}

// 失敗
{
  "data": null,
  "error": "ERROR_CODE",
  "message": "錯誤描述"
}
```

常見 error code：
- `VALIDATION_ERROR` — 參數格式錯誤或缺失
- `UNAUTHORIZED` — 未登入或 token 無效
- `FORBIDDEN` — 已登入但權限不足（非 admin）
- `NOT_FOUND` — 資源不存在
- `CONFLICT` — 衝突（如 email 重複、商品有 pending 訂單）
- `CART_EMPTY` — 購物車為空（建立訂單時）
- `STOCK_INSUFFICIENT` — 庫存不足
- `INVALID_STATUS` — 訂單狀態不符合操作條件
- `INTERNAL_ERROR` — 未捕捉的伺服器錯誤（不洩漏細節）

## 認證與授權機制

### JWT 認證（`authMiddleware.js`）

1. 從 `Authorization: Bearer <token>` header 提取 token
2. `jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] })` 驗證
3. 從 DB 確認 `userId` 對應的 user 仍存在
4. 設置 `req.user = { userId, email, role }`
5. 任一步驟失敗 → 401 UNAUTHORIZED

**JWT 參數**：
- algorithm: `HS256`
- expiresIn: `7d`（7 天）
- payload: `{ userId, email, role }`

### Admin 授權（`adminMiddleware.js`）

必須在 `authMiddleware` 之後使用。檢查 `req.user.role === 'admin'`，否則 403 FORBIDDEN。

### Session 認證（`sessionMiddleware.js`）

全域掛載，讀取 `X-Session-Id` header → 設置 `req.sessionId`。本身不做驗證，僅傳遞識別碼。

### 購物車雙模式認證（`cartRoutes.js` 內的 `dualAuth`）

```
請求帶有 Authorization: Bearer <token>
  → 驗證 JWT（成功 → req.user；token 無效 → 401，不 fallback）

請求沒有 Authorization header，但有 X-Session-Id
  → req.sessionId 已由 sessionMiddleware 設置 → 直接通過

兩者皆無 → 401
```

所有購物車操作後，`getOwnerCondition()` 依 `req.user` 或 `req.sessionId` 決定用 `user_id` 或 `session_id` 作為查詢條件。

> **重要**：建立訂單（`POST /api/orders`）只查 `user_id = ?` 的購物車，訪客（session）購物車無法直接結帳，必須先登入。

## 資料庫 Schema

資料庫位置：`./database.sqlite`（專案根目錄），`pragma foreign_keys = ON`，WAL 模式。

### `users`

| 欄位 | 型別 | 約束 |
|------|------|------|
| id | TEXT | PRIMARY KEY（UUID v4） |
| email | TEXT | UNIQUE NOT NULL |
| password_hash | TEXT | NOT NULL（bcrypt） |
| name | TEXT | NOT NULL |
| role | TEXT | NOT NULL DEFAULT 'user'，CHECK IN ('user','admin') |
| created_at | TEXT | NOT NULL DEFAULT datetime('now') |

### `products`

| 欄位 | 型別 | 約束 |
|------|------|------|
| id | TEXT | PRIMARY KEY（UUID v4） |
| name | TEXT | NOT NULL |
| description | TEXT | 可為 NULL |
| price | INTEGER | NOT NULL CHECK(price > 0) |
| stock | INTEGER | NOT NULL DEFAULT 0 CHECK(stock >= 0) |
| image_url | TEXT | 可為 NULL |
| created_at | TEXT | NOT NULL DEFAULT datetime('now') |
| updated_at | TEXT | NOT NULL DEFAULT datetime('now') |

> `updated_at` 不由 trigger 自動更新，UPDATE 時需在 SQL 中明確指定 `updated_at = datetime('now')`。

### `cart_items`

| 欄位 | 型別 | 約束 |
|------|------|------|
| id | TEXT | PRIMARY KEY（UUID v4） |
| session_id | TEXT | 可為 NULL（訪客使用） |
| user_id | TEXT | 可為 NULL，FK → users(id)（登入用戶使用） |
| product_id | TEXT | NOT NULL，FK → products(id) |
| quantity | INTEGER | NOT NULL DEFAULT 1 CHECK(quantity > 0) |

> `session_id` 和 `user_id` 互斥使用，同一筆只會有其中一個有值。

### `orders`

| 欄位 | 型別 | 約束 |
|------|------|------|
| id | TEXT | PRIMARY KEY（UUID v4） |
| order_no | TEXT | UNIQUE NOT NULL（格式：`ORD-YYYYMMDD-XXXXX`） |
| user_id | TEXT | NOT NULL，FK → users(id) |
| recipient_name | TEXT | NOT NULL |
| recipient_email | TEXT | NOT NULL |
| recipient_address | TEXT | NOT NULL |
| total_amount | INTEGER | NOT NULL |
| status | TEXT | NOT NULL DEFAULT 'pending'，CHECK IN ('pending','paid','failed') |
| created_at | TEXT | NOT NULL DEFAULT datetime('now') |

### `order_items`

| 欄位 | 型別 | 約束 |
|------|------|------|
| id | TEXT | PRIMARY KEY（UUID v4） |
| order_id | TEXT | NOT NULL，FK → orders(id) |
| product_id | TEXT | NOT NULL（不設 FK，允許商品被刪除後訂單仍保留快照） |
| product_name | TEXT | NOT NULL（下單時快照商品名稱） |
| product_price | INTEGER | NOT NULL（下單時快照商品價格） |
| quantity | INTEGER | NOT NULL |

> `order_items` 儲存的是下單當下的價格與名稱快照，與 `products` 表解耦，商品修改後不影響歷史訂單。

## 訂單建立 Transaction 流程

`POST /api/orders` 使用 `db.transaction()` 確保原子性：

```
1. INSERT INTO orders（建立訂單主表）
2. 循環每個購物車項目：
   a. INSERT INTO order_items（快照商品名稱與價格）
   b. UPDATE products SET stock = stock - quantity（扣庫存）
3. DELETE FROM cart_items WHERE user_id = ?（清空用戶購物車）
```

任一步驟失敗，整個 transaction 回滾，確保庫存不會被錯誤扣除。

## SSR 頁面渲染模式

`pageRoutes.js` 使用雙 layout 的兩步渲染：

```javascript
// 前台：先渲染 pages/xxx.ejs，再嵌入 layouts/front.ejs
res.render('pages/index', { layout: 'front', ...locals }, function(err, body) {
  res.render('layouts/front', { body, ...locals });
});

// 後台：先渲染 pages/admin/xxx.ejs，再嵌入 layouts/admin.ejs
```

每個頁面的 `locals` 包含 `{ title, pageScript }`，`pageScript` 對應 `public/js/pages/<name>.js`，在 layout 中動態載入。
