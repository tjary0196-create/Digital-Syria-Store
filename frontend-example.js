// frontend-example.js
// مثال بسيط (Vanilla JS) لصفحة الدفع بشام كاش - عدّل الأنماط حسب تصميم موقعك

async function createShamCashInvoice(uid, amount) {
  const res = await fetch("/api/shamcash/create-invoice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid, amount }),
  });
  const json = await res.json();
  if (json.status !== "success") throw new Error(json.message);
  return json.data; // { orderId, destinationAccount, amount, currency, expiresAt }
}

async function verifyShamCashPayment(orderId, transferNumber) {
  const res = await fetch("/api/shamcash/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, transferNumber }),
  });
  return res.json(); // { status: 'success' | 'pending' | 'error', ... }
}

function startCountdown(expiresAtMillis, onTick, onExpire) {
  const interval = setInterval(() => {
    const remaining = expiresAtMillis - Date.now();
    if (remaining <= 0) {
      clearInterval(interval);
      onExpire();
      return;
    }
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    onTick(`${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`);
  }, 1000);
  return interval;
}

// مثال استخدام كامل:
//
// const invoice = await createShamCashInvoice(currentUser.uid, 5);
// // اعرض invoice.destinationAccount و invoice.amount للمستخدم
// // شغّل العداد:
// startCountdown(invoice.expiresAt,
//   (label) => { document.getElementById("timer").textContent = label; },
//   () => { alert("انتهت مدة الفاتورة"); }
// );
//
// // لما يدوس المستخدم "إتمام الطلب":
// const transferNumber = document.getElementById("transferNumberInput").value;
// const result = await verifyShamCashPayment(invoice.orderId, transferNumber);
// if (result.status === "success") {
//   alert("تم تأكيد الدفع! تمت إضافة الرصيد.");
// } else if (result.status === "pending") {
//   alert("لسا ما توصلت الحركة، جرّب كمان شوي.");
// } else {
//   alert(result.message);
// }
