const express = require('express');
const crypto = require('crypto');
const https = require('https');
const querystring = require('querystring');
const db = require('../database');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getConfig() {
  const isStaging = (process.env.ECPAY_ENV || 'staging') !== 'production';
  return {
    merchantId: process.env.ECPAY_MERCHANT_ID || '3002607',
    hashKey: process.env.ECPAY_HASH_KEY || 'pwFHCqoQZGmho4w6',
    hashIV: process.env.ECPAY_HASH_IV || 'EkRm7iFT261dpevs',
    checkoutUrl: isStaging
      ? 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5'
      : 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5',
    queryUrl: isStaging
      ? 'https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5'
      : 'https://payment.ecpay.com.tw/Cashier/QueryTradeInfo/V5',
  };
}

/**
 * 產生 ECPay CheckMacValue（SHA256，符合 PHP urlencode 規則）
 */
function genCheckMacValue(params, hashKey, hashIV) {
  const sorted = Object.keys(params)
    .filter(k => k !== 'CheckMacValue')
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  const raw = 'HashKey=' + hashKey + '&'
    + sorted.map(k => k + '=' + params[k]).join('&')
    + '&HashIV=' + hashIV;

  // 符合 PHP urlencode：先 encodeURIComponent，再轉小寫，補回不應編碼的字元
  const encoded = encodeURIComponent(raw)
    .toLowerCase()
    .replace(/%21/g, '!')
    .replace(/%28/g, '(')
    .replace(/%29/g, ')')
    .replace(/%2a/g, '*')
    .replace(/%2d/g, '-')
    .replace(/%2e/g, '.')
    .replace(/%5f/g, '_')
    .replace(/%20/g, '+');

  return crypto.createHash('sha256').update(encoded).digest('hex').toUpperCase();
}

/**
 * 將 order_no 轉為 ECPay MerchantTradeNo（去除連字號，最多 20 碼，純英數字）
 */
function toTradeNo(orderNo) {
  return orderNo.replace(/-/g, '').substring(0, 20);
}

/**
 * 透過 MerchantTradeNo 找回訂單
 */
function findOrderByTradeNo(merchantTradeNo) {
  return db.prepare(
    "SELECT * FROM orders WHERE REPLACE(order_no, '-', '') = ?"
  ).get(merchantTradeNo);
}

// ─── POST /api/ecpay/checkout ─────────────────────────────────────────────────
/**
 * 建立付款表單參數，回傳 { action, fields } 給前端
 * 前端自行建立 <form> 並 submit 到 ECPay
 */
router.post('/checkout', authMiddleware, (req, res) => {
  const { orderId } = req.body;
  if (!orderId) {
    return res.status(400).json({ data: null, error: 'VALIDATION_ERROR', message: 'orderId 為必填' });
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
    .get(orderId, req.user.userId);
  if (!order) {
    return res.status(404).json({ data: null, error: 'NOT_FOUND', message: '訂單不存在' });
  }
  if (order.status !== 'pending') {
    return res.status(400).json({ data: null, error: 'INVALID_STATUS', message: '此訂單已付款或已失敗，無法重新付款' });
  }

  const config = getConfig();
  const baseUrl = process.env.BASE_URL || 'http://localhost:3001';

  // MerchantTradeDate：yyyy/MM/dd HH:mm:ss
  const now = new Date();
  const p = n => String(n).padStart(2, '0');
  const tradeDate = `${now.getFullYear()}/${p(now.getMonth() + 1)}/${p(now.getDate())} ${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;

  // ItemName：品項名稱 x 數量，多品項以 # 分隔
  const items = db.prepare(
    'SELECT product_name, quantity FROM order_items WHERE order_id = ?'
  ).all(order.id);
  const itemName = items.map(i => `${i.product_name} x${i.quantity}`).join('#');

  const fields = {
    MerchantID: config.merchantId,
    MerchantTradeNo: toTradeNo(order.order_no),
    MerchantTradeDate: tradeDate,
    PaymentType: 'aio',
    TotalAmount: order.total_amount,
    TradeDesc: '花漾生活',
    ItemName: itemName,
    ReturnURL: `${baseUrl}/api/ecpay/return`,         // Server Notify（本地收不到，但必填）
    OrderResultURL: `${baseUrl}/api/ecpay/result`,    // 付款後由使用者瀏覽器 POST 到這裡（本地可收到）
    ClientBackURL: `${baseUrl}/orders/${order.id}`,   // 取消付款時的返回網址
    ChoosePayment: 'Credit',
    EncryptType: 1,
  };

  fields.CheckMacValue = genCheckMacValue(fields, config.hashKey, config.hashIV);

  res.json({
    data: { action: config.checkoutUrl, fields },
    error: null,
    message: '成功'
  });
});

// ─── POST /api/ecpay/result ───────────────────────────────────────────────────
/**
 * ECPay 付款完成後，透過使用者瀏覽器 form POST 回呼此 endpoint（OrderResultURL）
 * 本地端可以正常收到此請求。
 * 驗證 CheckMacValue → 更新訂單狀態 → redirect 至訂單詳情頁
 */
router.post('/result', (req, res) => {
  const config = getConfig();
  const params = req.body;
  const { CheckMacValue, MerchantTradeNo, RtnCode } = params;

  // 驗證 CheckMacValue
  const paramsWithoutMac = Object.fromEntries(
    Object.entries(params).filter(([k]) => k !== 'CheckMacValue')
  );
  const expected = genCheckMacValue(paramsWithoutMac, config.hashKey, config.hashIV);
  if (expected !== CheckMacValue) {
    return res.status(400).send('CheckMacValue 驗證失敗');
  }

  const order = findOrderByTradeNo(MerchantTradeNo);
  if (!order) {
    return res.status(404).send('訂單不存在');
  }

  // 只對 pending 訂單更新狀態
  if (order.status === 'pending') {
    const newStatus = RtnCode === '1' ? 'paid' : 'failed';
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(newStatus, order.id);
  }

  const paymentParam = RtnCode === '1' ? 'success' : 'failed';
  res.redirect(`/orders/${order.id}?payment=${paymentParam}`);
});

// ─── POST /api/ecpay/return ───────────────────────────────────────────────────
/**
 * ECPay Server Notify（本地端收不到，但 ReturnURL 為必填）
 * 若未來部署到線上，此處理即為正式的 server-to-server 回呼。
 */
router.post('/return', (req, res) => {
  res.send('1|OK');
});

// ─── POST /api/ecpay/query ────────────────────────────────────────────────────
/**
 * 主動向綠界 Query API 查詢付款狀態，並更新訂單。
 * 用於 OrderResultURL 無法觸達時的備援查詢。
 */
router.post('/query', authMiddleware, (req, res) => {
  const { orderId } = req.body;
  if (!orderId) {
    return res.status(400).json({ data: null, error: 'VALIDATION_ERROR', message: 'orderId 為必填' });
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
    .get(orderId, req.user.userId);
  if (!order) {
    return res.status(404).json({ data: null, error: 'NOT_FOUND', message: '訂單不存在' });
  }

  const config = getConfig();
  const timeStamp = Math.floor(Date.now() / 1000);
  const queryParams = {
    MerchantID: config.merchantId,
    MerchantTradeNo: toTradeNo(order.order_no),
    TimeStamp: timeStamp,
  };
  queryParams.CheckMacValue = genCheckMacValue(queryParams, config.hashKey, config.hashIV);

  const postData = querystring.stringify(queryParams);
  const url = new URL(config.queryUrl);

  const reqOptions = {
    hostname: url.hostname,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  const ecpayReq = https.request(reqOptions, (ecpayRes) => {
    let raw = '';
    ecpayRes.on('data', chunk => { raw += chunk; });
    ecpayRes.on('end', () => {
      const result = querystring.parse(raw);
      const rtnCode = result.RtnCode;

      // 只有明確成功 (RtnCode=1) 才更新；其餘狀態維持 pending，讓使用者再試
      if (rtnCode === '1' && order.status === 'pending') {
        db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('paid', order.id);
      }

      const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
      res.json({
        data: {
          order: updatedOrder,
          ecpay: { RtnCode: rtnCode, RtnMsg: result.RtnMsg }
        },
        error: null,
        message: '查詢成功'
      });
    });
  });

  ecpayReq.on('error', () => {
    res.status(500).json({ data: null, error: 'ECPAY_ERROR', message: '查詢綠界 API 失敗' });
  });

  ecpayReq.write(postData);
  ecpayReq.end();
});

module.exports = router;
