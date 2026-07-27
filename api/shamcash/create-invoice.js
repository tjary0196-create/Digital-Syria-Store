// api/shamcash/create-invoice.js
// ينشئ فاتورة دفع جديدة بحالة "pending" ويرجع تفاصيلها للواجهة
// يقرأ إعدادات الدفع من settings/payment (المُدارة من لوحة التحكم):
//   - shamcashEnabled: تفعيل/إخفاء الطريقة بالكامل
//   - shamcashCurrency: العملة الفعلية لحساب شام كاش ("USD" أو "SYR")
//   - cash: رقم/حساب شام كاش الوجهة
//   - exchangeRate: سعر صرف الدولار (يُستخدم فقط لتحويل USD -> SYR عند إنشاء الفاتورة)

const { db } = require("../../lib/firebaseAdmin"); // عدّل المسار حسب مكان إعداد firebase-admin عندك
const admin = require("firebase-admin");

const INVOICE_EXPIRY_MINUTES = 30;
const DEFAULT_EXCHANGE_RATE = 15000;

// كود تحويل قصير وسهل الكتابة، بدون أحرف/أرقام ملتبسة (0/O ، 1/I..)
function generateReferenceCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `SY-${code}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "Method not allowed" });
  }

  try {
    // amountUSD: المبلغ اللي المستخدم بده يشحنه، دايماً بالدولار (نفس وحدة رصيد المحفظة بالمتجر)
    const { uid, amountUSD } = req.body;

    if (!uid || !amountUSD || Number(amountUSD) <= 0) {
      return res.status(400).json({ status: "error", message: "بيانات الطلب غير مكتملة" });
    }

    const settingsSnap = await db.collection("settings").doc("payment").get();
    const settings = settingsSnap.exists ? settingsSnap.data() : {};

    if (settings.shamcashEnabled === false) {
      return res.status(403).json({ status: "error", message: "الدفع عبر شام كاش غير متاح حالياً" });
    }

    const destinationAccount = settings.cash;
    if (!destinationAccount) {
      return res.status(500).json({ status: "error", message: "لم يتم ضبط حساب شام كاش الوجهة من لوحة التحكم" });
    }

    const currency = settings.shamcashCurrency === "SYR" ? "SYR" : "USD";
    const exchangeRate = Number(settings.exchangeRate) > 0 ? Number(settings.exchangeRate) : DEFAULT_EXCHANGE_RATE;

    const amountUSDNum = Number(amountUSD);
    // amount: المبلغ بنفس عملة حساب شام كاش الفعلي — هو اللي رح تتحقق منه المطابقة مع الحركة الحقيقية
    const amount = currency === "SYR" ? Math.round(amountUSDNum * exchangeRate) : amountUSDNum;

    // نجيب بيانات المستخدم مرة وحدة ونخزّنها مع الطلب (denormalize) لتفادي قراءات إضافية
    // لاحقاً بلوحة التحكم عند عرض سجل التحويلات (كل صف كان لازم يطلب مستند مستخدم منفصل).
    const userSnap = await db.collection("users").doc(uid).get();
    const userData = userSnap.exists ? userSnap.data() : {};

    const now = admin.firestore.Timestamp.now();
    const expiresAt = admin.firestore.Timestamp.fromMillis(
      now.toMillis() + INVOICE_EXPIRY_MINUTES * 60 * 1000
    );

    const orderRef = db.collection("shamcash_orders").doc();
    const referenceCode = generateReferenceCode();

    const orderData = {
      uid,
      userName: userData.displayName || userData.name || null,
      userPhone: userData.phone || null,
      amount,               // بعملة شام كاش (currency) — يُستخدم بالمطابقة مع الحركة الفعلية
      currency,
      amountUSD: amountUSDNum, // بالدولار دائماً — يُستخدم عند إضافة الرصيد للمستخدم والإحصاء
      destinationAccount,
      referenceCode,         // الكود اللي لازم المستخدم يكتبه بخانة "ملاحظة/سبب التحويل" بشام كاش
      status: "pending",     // pending | paid | expired | cancelled
      createdAt: now,
      expiresAt,
      transferNumber: null,
      matchedTransactionId: null,
      paidAt: null,
    };

    await orderRef.set(orderData);

    return res.status(200).json({
      status: "success",
      data: {
        orderId: orderRef.id,
        destinationAccount,
        amount,
        currency,
        referenceCode,
        expiresAt: expiresAt.toMillis(),
      },
    });
  } catch (err) {
    console.error("create-invoice error:", err);
    return res.status(500).json({ status: "error", message: "حدث خطأ أثناء إنشاء الفاتورة" });
  }
};
