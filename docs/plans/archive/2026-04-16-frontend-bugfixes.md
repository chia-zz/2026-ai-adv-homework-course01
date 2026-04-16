# 前端購物車 Badge 與導覽連結修正

## User Story

作為**購物用戶**，我希望 header 上的購物車數字能正確反映我加入的商品總數量（而非品項種類數），且「商品列表」連結能直接帶我到首頁的商品區塊，以便更直覺地掌握購物狀態。

## Spec

### 問題描述

1. **Header badge 數字錯誤**：`header-init.js` 使用 `items.length`（品項種類數），而非 `Σ item.quantity`（實際購買總數）
2. **商品詳情頁加入購物車後 badge +1 固定**：`product-detail.js` 不論使用者選幾件，badge 都只加 1
3. **購物車頁數量變動不同步 badge**：`cart.js` 的 `updateQuantity` 與 `handleDelete` 完成後未更新 badge
4. **「商品列表」導覽連結指向根路徑 `/`**：應改為 `/#products`，直接錨點至首頁商品列表區塊

### 修正方案

| 檔案 | 修正內容 |
|------|---------|
| `public/js/header-init.js` | `items.length` → `items.reduce((sum, i) => sum + i.quantity, 0)` |
| `public/js/pages/product-detail.js` | badge 增量由 `+1` 改為 `+quantity.value` |
| `public/js/pages/cart.js` | 新增 `updateCartBadge()` 函式；`updateQuantity` 與 `handleDelete` 成功後呼叫 |
| `views/partials/header.ejs` | `href="/"` 改為 `href="/#products"` |

### Badge 數字定義

統一為「購物車內所有商品的**數量總和**」，而非「品項種類數」。

## Tasks

- [x] 修正 `header-init.js`：badge 改用 reduce 計算總數量
- [x] 修正 `product-detail.js`：加入購物車後 badge 加上實際選取數量
- [x] 修正 `cart.js`：新增 `updateCartBadge()`，在數量更新與刪除後呼叫
- [x] 修正 `header.ejs`：商品列表連結改為 `/#products`
- [x] 更新 `docs/CHANGELOG.md`
