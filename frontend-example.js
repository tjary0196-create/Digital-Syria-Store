// frontend-example.js
// مثال بسيط (Vanilla JS) لصفحة الدفع بشام كاش - عدّل الأنماط حسب تصميم موقعك
//
// ملاحظات مهمة بعد التحديث:
// - أرسل المبلغ دايماً بالدولار (amountUSD)، السيرفر هو يلي بيحوّله لعملة شام كاش
//   الفعلية (USD أو SYR) حسب إعدادات لوحة التحكم.
// - رجّع لك السيرفر referenceCode: كود قصير (مثال SY-4F7K2P) لازم تعرضه
//   للمستخدم وتطلب منه يكتبه بخانة "ملاحظة/سبب التحويل" بشام كاش، لأنو
//   هو أساس عملية التحقق التلقائي.
// - إذا الطريقة مطفّية من لوحة التحكم، السيرفر برجّع status 403 برسالة واضحة.

async function createShamCashInvoice(uid, amountUSD) {
  const res = await fetch("/api/shamcash/create-invoice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid, amountUSD }),
  });
  const json = await res.json();
  if (json.status !== "success") throw new Error(json.message);
  return json.data; // { orderId, destinationAccount, amount, currency, referenceCode, expiresAt }
}

async function verifyShamCashPayment(orderId, referenceCode) {
  const res = await fetch("/api/shamcash/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, transferNumber: referenceCode }),
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
// try {
//   const invoice = await createShamCashInvoice(currentUser.uid, 5);
//   // اعرض invoice.destinationAccount و invoice.amount (بعملة invoice.currency)
//   // واعرض بوضوح: "اكتب هالكود بخانة الملاحظة: " + invoice.referenceCode
//   startCountdown(invoice.expiresAt,
//     (label) => { document.getElementById("timer").textContent = label; },
//     () => { alert("انتهت مدة الفاتورة"); }
//   );
//
//   // لما يدوس المستخدم "تحققت من التحويل":
//   const result = await verifyShamCashPayment(invoice.orderId, invoice.referenceCode);
//   if (result.status === "success") {
//     alert("تم تأكيد الدفع! تمت إضافة الرصيد.");
//   } else if (result.status === "pending") {
//     alert("لسا ما توصلت الحركة، جرّب كمان شوي.");
//   } else {
//     alert(result.message);
//   }
// } catch (err) {
//   // إذا الطريقة مطفّية من لوحة التحكم، err.message رح يكون "الدفع عبر شام كاش غير متاح حالياً"
//   alert(err.message);
// }
