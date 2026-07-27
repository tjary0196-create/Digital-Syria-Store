// api/shamcash/verify.js
// يتحقق من إتمام التحويل عبر ShamCash API ويحدّث حالة الطلب + رصيد المستخدم
// + يحدّث عدّادات إحصاء يومية/شهرية بشكل ذري (atomic) ضمن نفس المعاملة —
//   هيك لوحة التحكم بتعرض الإحصاء بقراءة مستند واحد صغير بدل ما تمسح كل سجل shamcash_orders.

const { db } = require("../../lib/firebaseAdmin");
const admin = require("firebase-admin");
const { getTransactions, findMatchingTransaction } = require("../../lib/shamcash");

const SHAMCASH_ACCOUNT_ID = process.env.SHAMCASH_ACCOUNT_ID; // الـ id تبع الحساب المرتبط (طلعه من GET /accounts مرة وحطه بالـ env)

function dayKeyOf(date) { return date.toISOString().slice(0, 10); }   // 2026-07-27
function monthKeyOf(date) { return date.toISOString().slice(0, 7); }  // 2026-07

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "Method not allowed" });
  }

  try {
    // transferNumber هون هو نفسه referenceCode اللي ظهر للمستخدم لما أنشأ الفاتورة —
    // منطلب منه يكتبه بخانة "ملاحظة/سبب التحويل" بشام كاش حتى تنضبط المطابقة التلقائية.
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

    // المطابقة تتم بعملة الطلب الفعلية (order.amount / order.currency) اللي انضبطت
    // مسبقاً بـ create-invoice.js حسب إعدادات لوحة التحكم — مش دايماً دولار.
    const match = findMatchingTransaction(transactions, {
      expectedAmount: order.amount,
      transferNumber,
    });

    if (!match) {
      return res.status(200).json({
        status: "pending",
        message: "لسا ما لقينا الحركة، جرّب بعد دقيقة أو تأكد من كتابة كود التحويل صح بخانة الملاحظة",
      });
    }

    const paidAt = admin.firestore.Timestamp.now();
    const dayKey = dayKeyOf(paidAt.toDate());
    const monthKey = monthKeyOf(paidAt.toDate());
    // الرصيد دايماً بالدولار (amountUSD) بغض النظر عن عملة التحويل الفعلية، لأنو
    // هيك نظام المحفظة بالمتجر مبني أصلاً (وحدة الرصيد الأساسية = USD).
    const amountUSD = Number(order.amountUSD || order.amount || 0);

    // تأكيد الطلب + إضافة الرصيد للمستخدم + تحديث عدّادات الإحصاء، كله بمعاملة واحدة (atomic)
    await db.runTransaction(async (t) => {
      const userRef = db.collection("users").doc(order.uid);
      const dailyStatsRef = db.collection("shamcash_daily_stats").doc(dayKey);
      const monthlyStatsRef = db.collection("shamcash_monthly_stats").doc(monthKey);

      const userSnap = await t.get(userRef);
      const currentBalance = userSnap.exists ? userSnap.data().balance || 0 : 0;

      t.update(orderRef, {
        status: "paid",
        transferNumber,
        matchedTransactionId: match.id || null,
        paidAt,
      });

      t.set(userRef, { balance: currentBalance + amountUSD }, { merge: true });

      t.set(dailyStatsRef, {
        date: dayKey,
        count: admin.firestore.FieldValue.increment(1),
        totalUSD: admin.firestore.FieldValue.increment(amountUSD),
      }, { merge: true });

      t.set(monthlyStatsRef, {
        month: monthKey,
        count: admin.firestore.FieldValue.increment(1),
        totalUSD: admin.firestore.FieldValue.increment(amountUSD),
      }, { merge: true });
    });

    return res.status(200).json({ status: "success", data: { paid: true } });
  } catch (err) {
    console.error("verify error:", err);
    return res.status(500).json({ status: "error", message: "حدث خطأ أثناء التحقق من الدفع" });
  }
};
