async function sendPaymentReceipt(payment, apiKey) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return false;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [payment.customerEmail],
      subject: `Payment confirmed — ${payment.planSlug}`,
      text: `Your Smart Tools Hub payment of ${payment.currency} ${payment.amount} is confirmed. Receipt: ${payment.receiptNumber || payment.reference}.${apiKey ? ` Your API key: ${apiKey}` : ""}`
    })
  });
  return response.ok;
}

module.exports = { sendPaymentReceipt };
