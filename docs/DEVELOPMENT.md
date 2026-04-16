# 開發規範

## 模組系統

本專案使用 **CommonJS**（`require` / `module.exports`）。

**例外**：`vitest.config.js` 使用 ESM（`import { defineConfig } from 'vitest/config'`），因為 vitest 設定檔需要 ESM。

所有 `src/` 下的檔案、`app.js`、`server.js`、`swagger-config.js` 皆為 CommonJS。

## 命名規則

### Request Body 欄位 vs 回應/DB 欄位

| 情境 | 命名格式 | 範例 |
|------|----------|------|
| Request body 欄位 | camelCase | `productId`, `recipientName`, `recipientEmail` |
| 回應 data 欄位 | snake_case（與 DB 欄位一致） | `product_id`, `order_no`, `created_at` |
| DB 欄位 | snake_case | `user_id`, `password_hash`, `total_amount` |
| JS 變數/函式 | camelCase | `orderItems`, `generateOrderNo`, `dualAuth` |
| Route 檔案 | camelCase + Routes 後綴 | `cartRoutes.js`, `adminProductRoutes.js` |
| Middleware 檔案 | camelCase + Middleware 後綴 | `authMiddleware.js`, `sessionMiddleware.js` |

### UUID 主鍵

所有表格的 `id` 欄位使用 UUID v4（`uuid` 套件）：
```javascript
const { v4: uuidv4 } = require('uuid');
const id = uuidv4();
```

## 統一回應格式

所有 API 回應必須遵循此結構，**不得偏離**：

```javascript
// 成功
res.json({
  data: { ... },
  error: null,
  message: '成功'
});

// 失敗
res.status(4xx).json({
  data: null,
  error: 'ERROR_CODE',
  message: '錯誤描述（中文）'
});
```

Error code 使用全大寫底線格式：`VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `CART_EMPTY`, `STOCK_INSUFFICIENT`, `INVALID_STATUS`。

## better-sqlite3 注意事項

`better-sqlite3` 是**同步** API，不需要 `async/await`。路由 handler 直接呼叫：

```javascript
// 正確
router.get('/', (req, res) => {
  const result = db.prepare('SELECT ...').all();
  res.json({ data: result, error: null, message: '成功' });
});

// 不需要（也不應該）這樣寫
router.get('/', async (req, res) => {
  const result = await db.prepare('SELECT ...').all(); // 錯誤，.all() 不回傳 Promise
});
```

Transaction 使用 `db.transaction(() => { ... })()`：
```javascript
const doWork = db.transaction(() => {
  db.prepare('INSERT ...').run(...);
  db.prepare('UPDATE ...').run(...);
});
doWork(); // 執行，任一步驟失敗則回滾
```

## 環境變數

| 變數 | 用途 | 必要 | 預設值 |
|------|------|------|--------|
| `JWT_SECRET` | JWT 簽名密鑰 | **必要**（缺少則伺服器拒絕啟動） | 無 |
| `PORT` | 伺服器監聽埠 | 否 | `3001` |
| `FRONTEND_URL` | CORS 允許的來源 | 否 | `http://localhost:3001` |
| `ADMIN_EMAIL` | Seed 管理員帳號 email | 否 | `admin@hexschool.com` |
| `ADMIN_PASSWORD` | Seed 管理員密碼 | 否 | `12345678` |
| `ECPAY_MERCHANT_ID` | ECPay 商店代號（金流預留） | 否 | `3002607`（測試值） |
| `ECPAY_HASH_KEY` | ECPay HashKey（金流預留） | 否 | （測試值） |
| `ECPAY_HASH_IV` | ECPay HashIV（金流預留） | 否 | （測試值） |
| `ECPAY_ENV` | ECPay 環境（`staging` / `production`） | 否 | `staging` |
| `NODE_ENV` | 執行環境，影響 bcrypt rounds | 否 | 無（非 `test` 時用 10 rounds） |

> `NODE_ENV=test` 時，`seedAdminUser()` 使用 `bcrypt.hashSync(password, 1)`（1 round）加速測試。

## 新增 API 路由步驟

1. **在 `src/routes/` 建立或修改路由檔**，遵循現有格式：
   ```javascript
   const express = require('express');
   const db = require('../database');
   const router = express.Router();

   // 若需認證：
   const authMiddleware = require('../middleware/authMiddleware');
   router.use(authMiddleware); // 或在個別路由上套用

   router.get('/', (req, res) => { ... });

   module.exports = router;
   ```

2. **在 `app.js` 掛載路由**：
   ```javascript
   app.use('/api/your-prefix', require('./src/routes/yourRoutes'));
   ```
   路由掛載順序：API 路由必須在 pageRoutes 和 404 handler 之前。

3. **為路由加上 JSDoc OpenAPI 標注**（見下方說明），以便 `npm run openapi` 產生文件。

4. **撰寫對應測試**（見 `docs/TESTING.md`）。

## 新增 Middleware 步驟

1. 在 `src/middleware/` 建立新檔案：
   ```javascript
   function yourMiddleware(req, res, next) {
     // 處理邏輯
     // 若失敗：return res.status(4xx).json({ data: null, error: '...', message: '...' });
     next();
   }
   module.exports = yourMiddleware;
   ```

2. 在需要的路由檔中引入並使用：
   ```javascript
   const yourMiddleware = require('../middleware/yourMiddleware');
   router.use(yourMiddleware); // 或 router.get('/', yourMiddleware, handler)
   ```

## JSDoc OpenAPI 標注格式

所有 API 端點使用 JSDoc 格式標注，由 `swagger-jsdoc` 讀取產生 OpenAPI spec。標注放在路由 handler 定義**上方**：

```javascript
/**
 * @openapi
 * /api/your-endpoint:
 *   post:
 *     summary: 端點說明
 *     tags: [TagName]
 *     security:
 *       - bearerAuth: []      # 需要 JWT
 *       - sessionId: []       # 需要 X-Session-Id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [field1]
 *             properties:
 *               field1:
 *                 type: string
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                 error:
 *                   type: string
 *                   nullable: true
 *                 message:
 *                   type: string
 *       400:
 *         description: 參數錯誤
 */
router.post('/', (req, res) => { ... });
```

現有的 security scheme 定義在 `swagger-config.js`：
- `bearerAuth`：HTTP Bearer JWT
- `sessionId`：`X-Session-Id` header（apiKey 類型）

產生 OpenAPI 文件：`npm run openapi`（輸出至 `openapi.json`）。

## 計畫歸檔流程

1. **命名格式**：`YYYY-MM-DD-<feature-name>.md`（例：`2026-04-16-order-payment.md`）
2. **存放位置**：開發中放在 `docs/plans/`，完成後移至 `docs/plans/archive/`
3. **計畫文件結構**：
   ```markdown
   # <功能名稱>

   ## User Story
   作為 <角色>，我希望 <行為>，以便 <目的>

   ## Spec
   - 技術規格細節
   - API 端點設計
   - 資料庫異動

   ## Tasks
   - [ ] 任務 1
   - [ ] 任務 2
   - [ ] 撰寫測試
   ```
4. **功能完成後**：
   - 移動計畫檔至 `docs/plans/archive/`
   - 更新 `docs/FEATURES.md`（功能行為描述）
   - 更新 `docs/CHANGELOG.md`（新增版本記錄）
