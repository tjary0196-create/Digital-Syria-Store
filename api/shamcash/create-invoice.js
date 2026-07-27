// api/shamcash/create-invoice.js
// ينشئ فاتورة دفع جديدة بحالة "pending" ويرجع تفاصيلها للواجهة

const { db } = require("../../lib/firebaseAdmin"); // عدّل المسار حسب مكان إعداد firebase-admin عندك
const admin = require("firebase-admin");

const SHAMCASH_DESTINATION_ACCOUNT = process.env.SHAMCASH_DESTINATION_ACCOUNT; // رقم الحساب يلي بيحول له الزبون
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

    if (!SHAMCASH_DESTINATION_ACCOUNT) {
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
      destinationAccount: SHAMCASH_DESTINATION_ACCOUNT,
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
        destinationAccount: SHAMCASH_DESTINATION_ACCOUNT,
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
