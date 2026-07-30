// lib/firebaseAdmin.js
// يهيّئ firebase-admin مرة وحدة فقط (Vercel بيعيد استخدام نفس الـ instance
// بين استدعاءات الـ function المتتالية على نفس الـ cold start)، ويصدّر
// db (Firestore) لاستخدامه بباقي ملفات api/*.js

const admin = require("firebase-admin");

if (!admin.apps.length) {
  const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!rawKey) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY غير موجود بمتغيرات البيئة. " +
      "أضفه من Vercel → Environment Variables بمحتوى ملف الـ JSON الكامل من Firebase (Service Accounts)."
    );
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(rawKey);
  } catch (err) {
    throw new Error(
      "تعذر قراءة FIREBASE_SERVICE_ACCOUNT_KEY كـ JSON صحيح. تأكد إنك نسخت محتوى الملف كامل بدون أي تعديل."
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

module.exports = { admin, db };
