// api/shamcash/verify.js
// يتحقق من إتمام التحويل عبر ShamCash API ويحدّث حالة الطلب + رصيد المستخدم

const { db } = require("../../lib/firebaseAdmin");
const admin = require("firebase-admin");
const { getTransactions, findMatchingTransaction } = require("../../lib/shamcash");

const SHAMCASH_ACCOUNT_ID = process.env.SHAMCASH_ACCOUNT_ID; // الـ id تبع الحساب المرتبط (طلعه من GET /accounts مرة وحطه بالـ env)

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "Method not allowed" });
  }

  try {
    const { orderId, transferNumber } = req.body;

    if (!orderId || !transferNumber) {
      return res.status(400).json({ status: "error", message: "بيانات ناقصة" });
    }

    const orderRef = db.collection("shamcash_orders").doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return res.status(404).json({ status: "error", message: "الطلب غير موجود" });
    }

    const order = orderSnap.data();

    if (order.status === "paid") {
      return res.status(200).json({ status: "success", data: { alreadyPaid: true } });
    }

    if (order.status === "cancelled") {
      return res.status(400).json({ status: "error", message: "تم إلغاء هذا الطلب" });
    }

    const now = admin.firestore.Timestamp.now();
    if (now.toMillis() > order.expiresAt.toMillis()) {
      await orderRef.update({ status: "expired" });
      return res.status(400).json({ status: "error", message: "انتهت صلاحية الفاتورة، أنشئ فاتورة جديدة" });
    }

    // نجيب حركات الحساب من وقت إنشاء الطلب لهلق
    const startAt = order.createdAt.toDate().toISOString();
    const transactions = await getTransactions(SHAMCASH_ACCOUNT_ID, { startAt });

    const match = findMatchingTransaction(transactions, {
      expectedAmount: order.amount,
      transferNumber,
    });

    if (!match) {
      return res.status(200).json({
        status: "pending",
        message: "لسا ما لقينا الحركة، جرّب بعد دقيقة أو تأكد من رقم عملية التحويل",
      });
    }

    // تأكيد الطلب + إضافة الرصيد للمستخدم ضمن معاملة واحدة (atomic)
    await db.runTransaction(async (t) => {
      const userRef = db.collection("users").doc(order.uid);
      const userSnap = await t.get(userRef);
      const currentBalance = userSnap.exists ? userSnap.data().balance || 0 : 0;

      t.update(orderRef, {
        status: "paid",
        transferNumber,
        matchedTransactionId: match.id || null,
        paidAt: admin.firestore.Timestamp.now(),
      });

      t.set(
        userRef,
        { balance: currentBalance + order.amount },
        { merge: true }
      );
    });

    return res.status(200).json({ status: "success", data: { paid: true } });
  } catch (err) {
    console.error("verify error:", err);
    return res.status(500).json({ status: "error", message: "حدث خطأ أثناء التحقق من الدفع" });
  }
};
