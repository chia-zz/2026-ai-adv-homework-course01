const { createApp, ref, onMounted } = Vue;

createApp({
  setup() {
    if (!Auth.requireAuth()) return {};

    const el = document.getElementById('app');
    const orderId = el.dataset.orderId;
    const paymentResult = ref(el.dataset.paymentResult || null);

    const order = ref(null);
    const loading = ref(true);
    const paying = ref(false);
    const querying = ref(false);

    const statusMap = {
      pending: { label: '待付款', cls: 'bg-apricot/20 text-apricot' },
      paid: { label: '已付款', cls: 'bg-sage/20 text-sage' },
      failed: { label: '付款失敗', cls: 'bg-red-100 text-red-600' },
    };

    const paymentMessages = {
      success: { text: '付款成功！感謝您的購買。', cls: 'bg-sage/10 text-sage border border-sage/20' },
      failed: { text: '付款失敗，請重試或改用其他付款方式。', cls: 'bg-red-50 text-red-600 border border-red-100' },
      cancel: { text: '付款已取消。', cls: 'bg-apricot/10 text-apricot border border-apricot/20' },
    };

    /**
     * 向綠界建立付款表單，並自動 submit 到綠界付款頁面。
     * 付款完成後，綠界會透過使用者瀏覽器 POST 到 /api/ecpay/result，
     * 後端驗證並更新狀態後，redirect 回訂單詳情頁。
     */
    async function payWithEcpay() {
      if (!order.value || paying.value) return;
      paying.value = true;
      try {
        const res = await apiFetch('/api/ecpay/checkout', {
          method: 'POST',
          body: JSON.stringify({ orderId: order.value.id })
        });

        // 建立隱藏表單並自動送出到綠界
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = res.data.action;
        form.style.display = 'none';

        Object.entries(res.data.fields).forEach(function ([key, value]) {
          var input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = value;
          form.appendChild(input);
        });

        document.body.appendChild(form);
        form.submit();
      } catch (e) {
        Notification.show(e?.data?.message || '前往付款失敗，請重試', 'error');
        paying.value = false;
      }
      // 不 reset paying = false，因為頁面即將跳轉
    }

    /**
     * 主動向綠界 Query API 查詢付款結果（備援用途）。
     * 適用於 OrderResultURL 未能回呼時，讓使用者手動確認。
     */
    async function queryEcpay() {
      if (!order.value || querying.value) return;
      querying.value = true;
      try {
        const res = await apiFetch('/api/ecpay/query', {
          method: 'POST',
          body: JSON.stringify({ orderId: order.value.id })
        });

        order.value = res.data.order;
        const rtnCode = res.data.ecpay.RtnCode;

        if (rtnCode === '1') {
          paymentResult.value = 'success';
          Notification.show('付款成功！', 'success');
        } else {
          // 提示查詢結果，但不強制改為失敗（可能只是還沒付款）
          Notification.show('目前尚未收到付款，如已付款請稍後再試。', 'error');
        }
      } catch (e) {
        Notification.show(e?.data?.message || '查詢失敗，請稍後再試', 'error');
      } finally {
        querying.value = false;
      }
    }

    onMounted(async function () {
      try {
        const res = await apiFetch('/api/orders/' + orderId);
        order.value = res.data;
      } catch (e) {
        Notification.show('載入訂單失敗', 'error');
      } finally {
        loading.value = false;
      }
    });

    return {
      order, loading, paying, querying,
      paymentResult, statusMap, paymentMessages,
      payWithEcpay, queryEcpay
    };
  }
}).mount('#app');
