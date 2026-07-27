// lib/shamcash.js
// دوال مساعدة للتواصل مع ShamCash API
// المفتاح لازم يكون بمتغيرات البيئة على Vercel: SHAMCASH_API_TOKEN و SHAMCASH_ACCOUNT_ID

const API_BASE = "https://api.shamcash-api.com/v1";

async function shamcashGet(path, params = {}) {
  const token = process.env.SHAMCASH_API_TOKEN;
  if (!token) {
    throw new Error("SHAMCASH_API_TOKEN غير موجود بمتغيرات البيئة");
  }

  const url = new URL(`${API_BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const payload = await response.json();

  if (!response.ok || payload.status !== "success") {
    const err = new Error(payload.message || "ShamCash API request failed");
    err.code = payload.code || "UNKNOWN_ERROR";
    throw err;
  }

  return payload.data;
}

// يرجع قائمة الحسابات المرتبطة
async function getAccounts() {
  return shamcashGet("/accounts");
}

// يرجع الأرصدة لحساب معيّن
async function getBalances(accountId) {
  return shamcashGet("/balances", { account_id: accountId });
}

// يرجع حركات حساب معيّن ضمن فترة زمنية
async function getTransactions(accountId, { startAt, endAt, limit = 50 } = {}) {
  return shamcashGet("/transactions", {
    account_id: accountId,
    start_at: startAt,
    end_at: endAt,
    limit,
  });
}

/**
 * يحاول إيجاد حركة تطابق طلب دفع معيّن.
 * بيدور على تطابق بالمبلغ + رقم العملية إذا كان الحقل موجود بالاستجابة.
 * ملاحظة: أسماء الحقول (reference/note/id...) لازم تتأكد منها من استجابة حقيقية
 * وتعدّل عليها بالـ candidateFields تحت حسب الداتا الفعلية.
 */
function findMatchingTransaction(transactions, { expectedAmount, transferNumber, tolerance = 0.01 }) {
  const candidateFields = ["id", "reference", "reference_id", "note", "memo", "operation_number", "tx_id"];

  return transactions.find((tx) => {
    const amountMatches =
      typeof tx.amount === "number" && Math.abs(tx.amount - expectedAmount) <= tolerance;

    if (!amountMatches) return false;

    if (!transferNumber) return true; // إذا ما في رقم عملية، المطابقة بالمبلغ بس (أقل أماناً)

    return candidateFields.some((field) => {
      const value = tx[field];
      return value !== undefined && String(value).trim() === String(transferNumber).trim();
    });
  });
}

module.exports = {
  getAccounts,
  getBalances,
  getTransactions,
  findMatchingTransaction,
};
