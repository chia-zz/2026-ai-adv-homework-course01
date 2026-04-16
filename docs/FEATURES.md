# 功能列表與完成狀態

## 完成狀態總覽

| 功能模組 | 狀態 |
|----------|------|
| 使用者認證（Auth） | ✅ 完成 |
| 商品瀏覽（Products） | ✅ 完成 |
| 購物車（Cart） | ✅ 完成 |
| 訂單（Orders） | ✅ 完成 |
| 綠界 ECPay 金流（ECPay） | ✅ 完成 |
| 後台商品管理（Admin Products） | ✅ 完成 |
| 後台訂單管理（Admin Orders） | ✅ 完成 |
| 前台 SSR 頁面 | ✅ 完成 |
| 後台 SSR 頁面 | ✅ 完成 |

---

## 1. 使用者認證（Auth）

路由前綴：`/api/auth`，檔案：`src/routes/authRoutes.js`

### 端點總覽

| 方法 | 路徑 | 認證 | 說明 |
|------|------|------|------|
| POST | `/api/auth/register` | 無 | 註冊新帳號 |
| POST | `/api/auth/login` | 無 | 登入 |
| GET | `/api/auth/profile` | JWT | 取得個人資料 |

### `POST /api/auth/register` — 註冊

**必填欄位**：`email`（字串，有效 email 格式）、`password`（字串，最少 6 字元）、`name`（字串）

**業務邏輯**：
1. 驗證三個欄位皆存在，否則 400
2. 正則驗證 email 格式（`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`），否則 400
3. 驗證 password 長度 ≥ 6，否則 400
4. 查詢 email 是否已存在，若已存在 → 409 CONFLICT
5. `bcrypt.hashSync(password, 10)` 雜湊密碼
6. 插入 users 表，role 固定為 `'user'`（普通用戶無法自行設為 admin）
7. 回傳 `{ user: { id, email, name, role }, token }`，token 立即可用（7 天有效）

**回應**：201 Created

**錯誤情境**：
- 400 `VALIDATION_ERROR`：欄位缺失、email 格式錯誤、password < 6 字元
- 409 `CONFLICT`：email 已被註冊

### `POST /api/auth/login` — 登入

**必填欄位**：`email`、`password`

**業務邏輯**：
1. 驗證兩個欄位皆存在，否則 400
2. 查詢 email 對應的用戶（`SELECT * FROM users WHERE email = ?`）
3. 若 email 不存在 → 401（回傳「Email 或密碼錯誤」，不透露哪個錯誤）
4. `bcrypt.compareSync(password, user.password_hash)` 驗證密碼
5. 密碼不符 → 401（同上，不透露具體原因）
6. 回傳 `{ user: { id, email, name, role }, token }`

**回應**：200 OK

**錯誤情境**：
- 400 `VALIDATION_ERROR`：欄位缺失
- 401 `UNAUTHORIZED`：email 不存在或密碼錯誤（統一訊息，防止 email 枚舉）

### `GET /api/auth/profile` — 取得個人資料

**認證**：Bearer JWT 必要

**業務邏輯**：從 `req.user.userId`（authMiddleware 設置）查詢完整用戶資料。

**回應**：`{ id, email, name, role, created_at }`

**錯誤情境**：
- 401 `UNAUTHORIZED`：無 token 或 token 無效

---

## 2. 商品瀏覽（Products）

路由前綴：`/api/products`，檔案：`src/routes/productRoutes.js`，**無需認證**。

### 端點總覽

| 方法 | 路徑 | 認證 | 說明 |
|------|------|------|------|
| GET | `/api/products` | 無 | 商品列表（分頁） |
| GET | `/api/products/:id` | 無 | 商品詳情 |

### `GET /api/products` — 商品列表

**查詢參數**：
- `page`（integer，預設 1，最小 1）
- `limit`（integer，預設 10，範圍 1–100，超出自動夾緊）

**業務邏輯**：以 `created_at DESC` 排序，使用 SQL `LIMIT ? OFFSET ?` 分頁。

**回應**：
```json
{
  "data": {
    "products": [ { "id", "name", "description", "price", "stock", "image_url", "created_at", "updated_at" } ],
    "pagination": { "total", "page", "limit", "totalPages" }
  }
}
```

### `GET /api/products/:id` — 商品詳情

**路徑參數**：`id`（UUID）

**錯誤情境**：
- 404 `NOT_FOUND`：商品不存在

---

## 3. 購物車（Cart）

路由前綴：`/api/cart`，檔案：`src/routes/cartRoutes.js`

### 雙模式認證機制（重要）

所有購物車端點皆使用 `dualAuth` 中間件，而非標準 `authMiddleware`：

- **已登入用戶**：提供 `Authorization: Bearer <token>`，購物車以 `user_id` 識別
- **訪客**：提供 `X-Session-Id: <任意字串>`，購物車以 `session_id` 識別
- **若 Authorization header 存在但 token 無效**：直接回 401，**不**嘗試 fallback 至 session 模式
- **兩者皆無**：401

### 端點總覽

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/cart` | 查看購物車 |
| POST | `/api/cart` | 加入商品 |
| PATCH | `/api/cart/:itemId` | 修改數量 |
| DELETE | `/api/cart/:itemId` | 移除項目 |

### `GET /api/cart` — 查看購物車

**業務邏輯**：JOIN `cart_items` 與 `products`，計算每項總價，回傳 `items` 陣列與 `total`（所有項目加總）。

**回應**：
```json
{
  "data": {
    "items": [
      {
        "id": "cart_item_uuid",
        "product_id": "product_uuid",
        "quantity": 2,
        "product": { "name", "price", "stock", "image_url" }
      }
    ],
    "total": 3360
  }
}
```

### `POST /api/cart` — 加入商品

**必填欄位**：`productId`（字串）、`quantity`（正整數，預設 1）

**業務邏輯（累加邏輯）**：
1. 驗證 `productId` 存在，`quantity` 為正整數
2. 查詢商品是否存在（404 若不存在）
3. 檢查購物車中是否已有同一商品：
   - **已存在**：新數量 = 現有數量 + 傳入數量。若新數量 > 庫存 → 400 `STOCK_INSUFFICIENT`；否則 UPDATE
   - **不存在**：若傳入數量 > 庫存 → 400；否則 INSERT 新 cart_item
4. 回傳 `{ id, product_id, quantity }`（含更新後的最終數量）

> **關鍵**：重複加入同一商品是「累加」而非「覆蓋」。例如購物車已有 2 個，再加 3 個 → 最終 5 個。

**錯誤情境**：
- 400 `VALIDATION_ERROR`：productId 缺失或 quantity 非正整數
- 400 `STOCK_INSUFFICIENT`：數量超過庫存
- 404 `NOT_FOUND`：商品不存在

### `PATCH /api/cart/:itemId` — 修改數量

**必填欄位**：`quantity`（正整數）

**業務邏輯**：直接覆蓋數量（非累加）。先驗證 cart_item 屬於當前用戶/session，再檢查新數量不超庫存。

**錯誤情境**：
- 400 `VALIDATION_ERROR`：quantity 非正整數
- 400 `STOCK_INSUFFICIENT`：超過庫存
- 404 `NOT_FOUND`：cart_item 不存在或不屬於當前用戶/session

### `DELETE /api/cart/:itemId` — 移除項目

回傳 `{ data: null, error: null, message: '已從購物車移除' }`。

---

## 4. 訂單（Orders）

路由前綴：`/api/orders`，檔案：`src/routes/orderRoutes.js`，**全程需 JWT 認證**（`router.use(authMiddleware)`）。

> **注意**：訪客（session）購物車無法直接結帳。建立訂單只讀取 `user_id = ?` 的 cart_items，訪客必須先登入後再加入購物車才能結帳。

### 端點總覽

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/orders` | 從購物車建立訂單 |
| GET | `/api/orders` | 取得自己的訂單列表 |
| GET | `/api/orders/:id` | 取得訂單詳情 |
| PATCH | `/api/orders/:id/pay` | 直接更新付款狀態（內部用，正式付款走 `/api/ecpay/checkout`） |

### `POST /api/orders` — 建立訂單

**必填欄位**：`recipientName`、`recipientEmail`（有效 email 格式）、`recipientAddress`

**業務邏輯（Transaction）**：
1. 驗證三個收件人欄位及 email 格式
2. 查詢 `cart_items WHERE user_id = ?`（含 product 資訊）
3. 若購物車為空 → 400 `CART_EMPTY`
4. 批次檢查所有商品庫存，若有不足列出品名 → 400 `STOCK_INSUFFICIENT`
5. 計算 `total_amount`（Σ price × quantity）
6. 產生 `order_no`（格式：`ORD-YYYYMMDD-XXXXX`，XXXXX 為 UUID 前 5 碼大寫）
7. **Transaction 原子操作**：
   - INSERT orders
   - 迴圈 INSERT order_items（快照 product_name, product_price）
   - 迴圈 `UPDATE products SET stock = stock - quantity`
   - `DELETE FROM cart_items WHERE user_id = ?`（清空購物車）
8. 若 transaction 失敗則完全回滾，不會有部分扣庫存的情況

**回應**（201 Created）：
```json
{
  "data": {
    "id", "order_no", "total_amount",
    "status": "pending",
    "items": [ { "product_name", "product_price", "quantity" } ],
    "created_at"
  }
}
```

### `GET /api/orders` — 訂單列表

回傳當前用戶所有訂單，以 `created_at DESC` 排序，欄位：`id, order_no, total_amount, status, created_at`。

### `GET /api/orders/:id` — 訂單詳情

只能查看自己的訂單（SQL 條件：`id = ? AND user_id = ?`）。回傳完整訂單資訊，含 `items` 陣列（order_items 全欄位）。

**錯誤情境**：404（不存在或不屬於當前用戶，統一訊息避免資訊洩漏）

### `PATCH /api/orders/:id/pay` — 直接更新付款狀態（內部）

**必填欄位**：`action`（字串，`"success"` 或 `"fail"`）

**狀態機**：訂單只能從 `pending` 轉換。
- `action: "success"` → status 改為 `"paid"`
- `action: "fail"` → status 改為 `"failed"`
- 若訂單狀態不是 `pending` → 400 `INVALID_STATUS`

此端點模擬金流回調，實際部署可替換為真實金流（如 ECPay）的 webhook handler。

---

## 5. 後台商品管理（Admin Products）

路由前綴：`/api/admin/products`，檔案：`src/routes/adminProductRoutes.js`，需 JWT + admin role（`router.use(authMiddleware, adminMiddleware)`）。

### 端點總覽

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/admin/products` | 後台商品列表（分頁） |
| POST | `/api/admin/products` | 新增商品 |
| PUT | `/api/admin/products/:id` | 全量更新商品 |
| DELETE | `/api/admin/products/:id` | 刪除商品 |

### `GET /api/admin/products`

與公開商品列表相同（同樣的 SQL），差異在於需要 admin 認證。查詢參數：`page`（預設 1）、`limit`（預設 10，上限 100）。

### `POST /api/admin/products` — 新增商品

**必填欄位**：`name`（字串）、`price`（正整數）、`stock`（非負整數）

**選填欄位**：`description`（字串）、`image_url`（字串）

**驗證細節**：
- `price` 必須為整數且 > 0（非整數或 ≤ 0 皆 400）
- `stock` 必須為整數且 ≥ 0

### `PUT /api/admin/products/:id` — 更新商品

部分欄位可更新（未傳的欄位維持原值，實為 partial update 語意）。同樣的欄位驗證。
更新時自動設定 `updated_at = datetime('now')`。

**錯誤情境**：404（商品不存在）、400（欄位格式錯誤）

### `DELETE /api/admin/products/:id` — 刪除商品

**保護邏輯**：刪除前檢查該商品是否存在於任何 `status = 'pending'` 的訂單中。若有 → 409 `CONFLICT`（「此商品存在未完成的訂單，無法刪除」）。

> 這是保護訂單完整性的關鍵業務規則。`paid` 或 `failed` 訂單的商品可以刪除（因 order_items 已快照資料）。

---

## 6. 後台訂單管理（Admin Orders）

路由前綴：`/api/admin/orders`，檔案：`src/routes/adminOrderRoutes.js`，需 JWT + admin role。

### 端點總覽

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/admin/orders` | 後台訂單列表（分頁 + 狀態篩選） |
| GET | `/api/admin/orders/:id` | 後台訂單詳情（含用戶資訊） |

### `GET /api/admin/orders` — 訂單列表

**查詢參數**：
- `page`（integer，預設 1）
- `limit`（integer，預設 10，上限 100）
- `status`（選填，`pending` / `paid` / `failed`）：篩選特定狀態的訂單；傳入無效值則忽略，列出全部

**業務邏輯**：動態 SQL 條件，傳入 `status` 時加 `WHERE status = ?`，否則無條件。以 `created_at DESC` 排序。

回傳欄位比用戶端多出 `user_id` 與 `recipient_email`。

### `GET /api/admin/orders/:id` — 訂單詳情

與用戶端訂單詳情的差異：
- 可查任何用戶的訂單（無 `user_id` 條件）
- 額外回傳 `user: { name, email }`（來自 users 表），若用戶已刪除則 `user: null`

---

## 7. 綠界 ECPay 金流（ECPay）

路由前綴：`/api/ecpay`，檔案：`src/routes/ecpayRoutes.js`

### 設計背景

本專案運行於本地端，無法接收綠界的 **Server Notify**（`ReturnURL` 為 server-to-server POST）。付款結果改為雙軌確認：
1. **主軌**：使用 `OrderResultURL`——付款後由使用者瀏覽器 POST 回本地 server，本地端可正常接收
2. **備援**：`POST /api/ecpay/query` 主動呼叫綠界 Query API

### 端點總覽

| 方法 | 路徑 | 認證 | 說明 |
|------|------|------|------|
| POST | `/api/ecpay/checkout` | JWT | 產生付款表單參數 |
| POST | `/api/ecpay/result` | 無 | OrderResultURL：接收付款結果、更新訂單、redirect |
| POST | `/api/ecpay/return` | 無 | ReturnURL dummy（本地收不到，回 `1\|OK`） |
| POST | `/api/ecpay/query` | JWT | 主動查詢綠界付款狀態（備援） |

### `POST /api/ecpay/checkout` — 產生付款表單

**必填欄位**：`orderId`（字串）

**業務邏輯**：
1. 驗證訂單存在且屬於當前用戶
2. 確認訂單狀態為 `pending`，已付款/失敗的訂單不可重新付款
3. 組合 ECPay AIO 參數：
   - `MerchantTradeNo`：`order_no` 去除連字號後取前 20 碼（例：`ORD20260416AB12C`）
   - `MerchantTradeDate`：當下時間，格式 `yyyy/MM/dd HH:mm:ss`
   - `ItemName`：各品項「商品名稱 x數量」以 `#` 串接
   - `TotalAmount`：訂單金額（整數，單位：元）
   - `ReturnURL`：`{BASE_URL}/api/ecpay/return`（Server Notify，本地收不到）
   - `OrderResultURL`：`{BASE_URL}/api/ecpay/result`（**瀏覽器 POST，本地可收到**）
   - `ClientBackURL`：`{BASE_URL}/orders/:id`（取消付款返回）
   - `ChoosePayment`：`Credit`（信用卡）
4. 計算 `CheckMacValue`（SHA256，符合 PHP urlencode 規則）
5. 回傳 `{ action: "https://payment-stage.ecpay.com.tw/...", fields: { ... } }`

**前端行為**：收到 `action` 與 `fields` 後，動態建立隱藏 `<form>`，自動 submit 到綠界，頁面跳轉至綠界付款頁。

**回應**：
```json
{
  "data": {
    "action": "https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5",
    "fields": { "MerchantID": "...", "CheckMacValue": "...", ... }
  },
  "error": null,
  "message": "成功"
}
```

**錯誤情境**：
- 400 `VALIDATION_ERROR`：orderId 缺失
- 400 `INVALID_STATUS`：訂單狀態不是 pending
- 404 `NOT_FOUND`：訂單不存在或不屬於當前用戶

### `POST /api/ecpay/result` — 接收付款結果（OrderResultURL）

**觸發方式**：綠界付款完成後，透過使用者瀏覽器 form POST 至此 endpoint（本地端可接收）。

**業務邏輯**：
1. 從 `req.body` 取得 `MerchantTradeNo`、`RtnCode`、`CheckMacValue`（由綠界傳入）
2. 重新計算 CheckMacValue 驗證完整性，不符則拒絕（400）
3. 以 `REPLACE(order_no, '-', '') = MerchantTradeNo` 找回訂單
4. 若訂單狀態為 `pending`：`RtnCode === '1'` → `paid`；其餘 → `failed`
5. Redirect 至 `/orders/:id?payment=success` 或 `?payment=failed`

> 此 endpoint 不回 JSON，而是直接 `res.redirect()`，因為它是瀏覽器的表單目標頁。

### `POST /api/ecpay/query` — 主動查詢（備援）

**必填欄位**：`orderId`

**業務邏輯**：
1. 組合 Query 參數（`MerchantID`, `MerchantTradeNo`, `TimeStamp`），計算 CheckMacValue
2. 以 Node.js 內建 `https` 模組 POST 至綠界 `QueryTradeInfo/V5`
3. 解析回應（URL-encoded 格式），取出 `RtnCode` 與 `RtnMsg`
4. **只有 `RtnCode === '1'` 時才更新訂單為 `paid`**；其他狀態（例如訂單不存在、處理中）維持 `pending`，讓使用者可再試
5. 回傳更新後的訂單資料與綠界查詢結果

**常見 RtnCode**：
| RtnCode | 意義 |
|---------|------|
| `1` | 付款成功 |
| `10200047` | 訂單不存在（交易尚未建立，通常是用戶未完成付款） |
| `10200095` | 訂單處理中 |

### CheckMacValue 計算規則

```
1. 移除 CheckMacValue 本身，對其他參數按 key 字母順序（case-insensitive）排序
2. 組合字串：HashKey=xxx&Key1=Val1&Key2=Val2&HashIV=xxx
3. encodeURIComponent 後轉小寫，並還原 ! ( ) * - . _ 為字面值，空格轉 +
4. SHA256 雜湊 → 轉大寫
```

### 測試付款資訊（staging 環境）

| 欄位 | 值 |
|------|-----|
| 信用卡號 | `4311-9522-2222-2222` |
| 有效期限 | `01/26`（或任一未來日期） |
| CVV | `222` |

---

## 8. 前台 SSR 頁面

路由前綴：`/`，檔案：`src/routes/pageRoutes.js`，**無認證**（前端 JS 自行讀取 localStorage 的 token 處理登入狀態）。

| 路徑 | 頁面 | pageScript |
|------|------|-----------|
| `/` | 首頁（商品列表） | `index` |
| `/products/:id` | 商品詳情 | `product-detail` |
| `/cart` | 購物車 | `cart` |
| `/checkout` | 結帳 | `checkout` |
| `/login` | 登入/註冊 | `login` |
| `/orders` | 我的訂單 | `orders` |
| `/orders/:id` | 訂單詳情 | `order-detail` |
| `/admin/products` | 後台商品管理 | `admin-products` |
| `/admin/orders` | 後台訂單管理 | `admin-orders` |

`pageScript` 對應 `public/js/pages/<name>.js`，在 layout 中動態插入 `<script>` 標籤。

訂單詳情頁 `/orders/:id` 接受 `?payment=success` 或 `?payment=fail` query 參數，前端用於顯示付款結果提示（由 `paymentResult` local 傳入 EJS）。
