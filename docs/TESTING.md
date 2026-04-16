# 測試規範與指南

## 測試技術棧

- **測試框架**：Vitest 2（`vitest run`）
- **HTTP 測試**：Supertest 7（對 Express app 發送真實 HTTP 請求）
- **資料庫**：與正式環境相同的 SQLite（`database.sqlite`），測試跑完資料留存

## 測試檔案總覽

| 檔案 | 涵蓋功能 | 測試案例數量 |
|------|----------|------------|
| `tests/setup.js` | 共用輔助函式（非測試） | — |
| `tests/auth.test.js` | 註冊、登入、取得個人資料 | 5 |
| `tests/products.test.js` | 商品列表、分頁、商品詳情 | 4 |
| `tests/cart.test.js` | 購物車 CRUD（訪客+登入雙模式） | 6 |
| `tests/orders.test.js` | 建立訂單、列表、詳情 | 5 |
| `tests/adminProducts.test.js` | 後台商品 CRUD + 權限驗證 | 6 |
| `tests/adminOrders.test.js` | 後台訂單列表 + 篩選 + 詳情 + 權限 | 4 |

## 執行順序與依賴關係

`vitest.config.js` 設定 `fileParallelism: false` 且指定固定順序：

```
auth → products → cart → orders → adminProducts → adminOrders
```

**必須保持此順序的原因**：
1. 測試共用同一個 SQLite 資料庫（不是每次 test 前重置）
2. `orders.test.js` 的 `beforeAll` 依賴 products 表已有 seed 資料（從 products.test.js 後確認）
3. `adminOrders.test.js` 的 `beforeAll` 需建立一個真實訂單（register user → add cart → place order），依賴 products、orders 流程

## 共用輔助函式（`tests/setup.js`）

### `getAdminToken()`

```javascript
async function getAdminToken()
// 向 POST /api/auth/login 發送 seed 管理員帳號（admin@hexschool.com / 12345678）
// 回傳 JWT token 字串
```

使用時機：需要 admin 權限的測試 `beforeAll`。

### `registerUser(overrides = {})`

```javascript
async function registerUser({ email?, password?, name? } = {})
// 向 POST /api/auth/register 發送請求
// email 預設為唯一隨機值（test-<timestamp>-<random>@example.com）
// 回傳 { token, user }
```

使用時機：需要普通用戶 token 的測試。每次呼叫建立不同帳號，避免衝突。

## bcrypt 加速設定

`src/database.js` 在 `NODE_ENV === 'test'` 時，seed 管理員密碼使用 `bcrypt.hashSync(password, 1)` 僅 1 round。

但測試中 `registerUser()` 呼叫的是 `POST /api/auth/register`，該路由固定使用 10 rounds。若發現測試速度慢（尤其多次 `registerUser()`），可考慮在 `vitest.config.js` 設置 `process.env.NODE_ENV = 'test'` 並在 register route 也讀取此設定。

## 撰寫新測試步驟

1. **建立測試檔**（若新功能）：`tests/<feature>.test.js`
2. **引入 setup**：
   ```javascript
   const { app, request, getAdminToken, registerUser } = require('./setup');
   ```
3. **準備前置資料**（使用 `beforeAll`）：
   ```javascript
   describe('Feature API', () => {
     let token;
     let resourceId;

     beforeAll(async () => {
       const { token: t } = await registerUser();
       token = t;
     });
   ```
4. **撰寫測試案例**，驗證回應結構：
   ```javascript
   it('should do something', async () => {
     const res = await request(app)
       .post('/api/your-endpoint')
       .set('Authorization', `Bearer ${token}`)
       .send({ field: 'value' });

     // 驗證 HTTP 狀態碼
     expect(res.status).toBe(201);
     // 驗證統一回應格式
     expect(res.body).toHaveProperty('data');
     expect(res.body).toHaveProperty('error', null);
     expect(res.body).toHaveProperty('message');
     // 驗證業務邏輯欄位
     expect(res.body.data).toHaveProperty('id');
   });
   ```
5. **將測試檔加入 `vitest.config.js` 的 `sequence.files` 陣列**，並放在正確的順序位置。

## 常見陷阱

### 1. 資料庫狀態在測試間共享

測試不會重置資料庫。若 `auth.test.js` 建立了 email `auth-test-xxx@example.com`，這筆資料在後續所有測試都存在。

**影響**：`adminOrders.test.js` 的 `beforeAll` 建立的訂單會影響訂單計數。設計測試時不要假設表格只有特定筆數。

### 2. 購物車測試用 `session_id` 避免污染

`cart.test.js` 使用 `sessionId = 'test-session-' + Date.now()`，確保與其他測試的 session 不衝突。

### 3. 訂單測試依賴購物車狀態

`orders.test.js` 的 `beforeAll` 建立訂單後，購物車被清空。後續「空購物車建立訂單」的 failure test 依賴這個狀態。請勿在該 describe 中插入額外加入購物車的操作。

### 4. 管理員 seed 在測試環境

`database.js` 只在管理員 email 不存在時才 seed。若資料庫已存在（前次測試留下），管理員帳號不會重複建立，`getAdminToken()` 應始終可用。

## 執行指令

```bash
# 執行所有測試
npm test

# 執行特定測試檔（vitest 支援）
npx vitest run tests/auth.test.js

# 觀察模式（開發時）
npx vitest
```
