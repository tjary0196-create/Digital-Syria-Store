// api/shamcash/create-invoice.js
// ينشئ فاتورة دفع جديدة بحالة "pending" ويرجع تفاصيلها للواجهة

const { db } = require("../../lib/firebaseAdmin"); // عدّل المسار حسب مكان إعداد firebase-admin عندك
const admin = require("firebase-admin");

const INVOICE_EXPIRY_MINUTES = 30;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "Method not allowed" });
  }

  try {
    const { uid, amount, currency = "USD" } = req.body;

    if (!uid || !amount || Number(amount) <= 0) {
      return res.status(400).json({ status: "error", message: "بيانات الطلب غير مكتملة" });
    }

    // نقرأ إعدادات الدفع من لوحة التحكم (settings/payment) بدل ما نعتمد فقط على
    // متغير البيئة، هيك الأدمن فيه يعطّل الطريقة أو يبدّل رقم الحساب من الداشبورد
    // مباشرة بدون أي Redeploy. متغير البيئة SHAMCASH_DESTINATION_ACCOUNT بيضل
    // موجود بس كخيار احتياطي (fallback) إذا الحقل فاضي بلوحة التحكم.
    const settingsSnap = await db.collection("settings").doc("payment").get();
    const settings = settingsSnap.exists ? settingsSnap.data() : {};

    const shamcashEnabled = settings.shamcashEnabled !== false; // افتراضياً مفعّل إذا ما تحدد
    if (!shamcashEnabled) {
      return res.status(403).json({ status: "error", message: "طريقة الدفع عبر شام كاش غير متاحة حالياً" });
    }

    const destinationAccount = (settings.cash && String(settings.cash).trim())
      || process.env.SHAMCASH_DESTINATION_ACCOUNT;

    if (!destinationAccount) {
      return res.status(500).json({ status: "error", message: "لم يتم ضبط حساب شام كاش الوجهة" });
    }

    const now = admin.firestore.Timestamp.now();
    const expiresAt = admin.firestore.Timestamp.fromMillis(
      now.toMillis() + INVOICE_EXPIRY_MINUTES * 60 * 1000
    );

    const orderRef = db.collection("shamcash_orders").doc();

    const orderData = {
      uid,
      amount: Number(amount),
      currency,
      destinationAccount,
      status: "pending", // pending | paid | expired | cancelled
      createdAt: now,
      expiresAt,
      transferNumber: null,
    };

    await orderRef.set(orderData);

    return res.status(200).json({
      status: "success",
      data: {
        orderId: orderRef.id,
        destinationAccount,
        amount: orderData.amount,
        currency,
        expiresAt: expiresAt.toMillis(),
      },
    });
  } catch (err) {
    console.error("create-invoice error:", err);
    return res.status(500).json({ status: "error", message: "حدث خطأ أثناء إنشاء الفاتورة" });
  }
};
