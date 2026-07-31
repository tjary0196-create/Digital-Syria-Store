// api/apiSources/sync.js
// بروكسي سيرفر-لسيرفر لسحب المنتجات من أي مصدر API خارجي (زي Action Cash).
// السبب: متصفح المستخدم بيتحجب بقيود CORS لما يحاول يتصل مباشرة بمعظم
// الـ APIs الخارجية، والسيرفر (Vercel Function) ما عنده هالقيد أبداً.
// كمان بيسمح نحط الترويسة الصحيحة (api-token) بمكان واحد موثوق.

const { admin, db } = require("../../lib/firebaseAdmin");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "Method not allowed" });
  }

  try {
    // ── تحقق إن الطالب أدمن فعلاً (منع أي حدا يستخدم هالبروكسي كبوابة
    // مفتوحة لأي رابط عشوائي) ──
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) {
      return res.status(401).json({ status: "error", message: "غير مصرح" });
    }

    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch (err) {
      return res.status(401).json({ status: "error", message: "جلسة غير صالحة" });
    }

    const adminDoc = await db.collection("admins").doc(decoded.uid).get();
    if (!adminDoc.exists) {
      return res.status(403).json({ status: "error", message: "هذا الحساب ليس أدمن" });
    }

    // ── الطلب الفعلي للمصدر الخارجي ──
    const { url, token } = req.body;
    if (!url || typeof url !== "string" || !url.startsWith("https://")) {
      return res.status(400).json({ status: "error", message: "رابط API غير صالح" });
    }

    const headers = {};
    if (token) headers["api-token"] = token;

    const upstream = await fetch(url, { headers });
    const text = await upstream.text();

    let json;
    try {
      json = JSON.parse(text);
    } catch (err) {
      return res.status(502).json({
        status: "error",
        message: "المصدر رجّع رداً غير صالح (مش JSON)، تأكد من الرابط والتوكن",
      });
    }

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        status: "error",
        message: json.message || `المصدر رجّع خطأ (${upstream.status})`,
        upstream: json,
      });
    }

    return res.status(200).json({ status: "success", data: json });
  } catch (err) {
    console.error("apiSources/sync error:", err);
    return res.status(500).json({ status: "error", message: "حدث خطأ أثناء الاتصال بالمصدر" });
  }
};
