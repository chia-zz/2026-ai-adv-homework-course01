# 綠界 ECPay 金流串接

## User Story

作為**已登入的購物用戶**，我希望在訂單詳情頁點擊「前往付款」後能跳轉至綠界付款頁面完成刷卡，並在付款後自動回到訂單頁面看到最新狀態，以便完成整個購物流程。

## Spec

### 背景限制

本專案運行於本地端，無法接收綠界 Server Notify（`ReturnURL` 為 server-to-server POST，外部無法連入 localhost）。  
因此付款結果確認採雙軌架構：

- **主軌**：`OrderResultURL`——付款後由使用者瀏覽器 form POST 回本地 server，本地端可正常接收
- **備援**：`POST /api/ecpay/query`——主動呼叫綠界 Query API，讓使用者手動確認

### 新增 API 端點

| 方法 | 路徑 | 認證 | 說明 |
|------|------|------|------|
| POST | `/api/ecpay/checkout` | JWT | 產生 AIO 表單參數（含 CheckMacValue），回傳 `{ action, fields }` |
| POST | `/api/ecpay/result` | 無 | OrderResultURL：瀏覽器 POST，驗證 MAC → 更新訂單 → redirect |
| POST | `/api/ecpay/return` | 無 | ReturnURL dummy，回傳 `1\|OK` |
| POST | `/api/ecpay/query` | JWT | 主動查詢綠界 QueryTradeInfo/V5 |

### CheckMacValue 規則

1. 移除 `CheckMacValue`，對其他參數按 key 字母序排序
2. 組合：`HashKey=xxx&Key1=Val1&...&HashIV=xxx`
3. `encodeURIComponent` → 轉小寫 → 還原 `! ( ) * - . _`，空格轉 `+`
4. SHA256 → 大寫

### 訂單狀態更新邏輯

- `RtnCode === '1'` → `paid`
- 其他（含 `10200047` 訂單不存在、`10200095` 處理中）→ 維持 `pending`，不強制設為 `failed`

### 前端流程

1. 訂單詳情頁點擊「前往付款（綠界）」
2. `POST /api/ecpay/checkout` 取得 `action` 與 `fields`
3. 動態建立隱藏 `<form method="POST">` 並 auto-submit → 跳轉綠界
4. 付款後綠界 form POST 至 `/api/ecpay/result` → 驗證 → redirect `/orders/:id?payment=success`
5. 備援：點擊「查詢付款結果」→ `POST /api/ecpay/query` → 顯示最新狀態

## Tasks

- [x] 建立 `src/routes/ecpayRoutes.js`（4 個端點 + `genCheckMacValue` + `toTradeNo` helper）
- [x] 在 `app.js` 掛載 `/api/ecpay` 路由
- [x] 更新 `views/pages/order-detail.ejs`：移除模擬付款按鈕，新增真實付款按鈕
- [x] 更新 `public/js/pages/order-detail.js`：`payWithEcpay()` + `queryEcpay()` 函式
- [x] 更新 `docs/FEATURES.md`、`docs/ARCHITECTURE.md`、`docs/CHANGELOG.md`
