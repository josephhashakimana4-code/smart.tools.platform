const Payment = require("../models/Payment");
const { isFlutterwaveConfigured, flutterwaveRequest, verifyFlutterwaveWebhook, verifyFlutterwaveAmount } = require("../utils/flutterwave");
const { fulfillGatewayPayment } = require("../utils/paymentFulfillment");

async function flutterwaveWebhook(req, res) {
  if (!isFlutterwaveConfigured()) return res.status(503).json({ message: "Flutterwave webhook is not configured." });
  if (!verifyFlutterwaveWebhook(req.get("verif-hash"))) {
    return res.status(401).json({ message: "Invalid Flutterwave webhook signature." });
  }

  const event = req.body || {};
  if (event.event !== "charge.completed" || !event.data?.id) return res.json({ received: true });

  try {
    const verification = await flutterwaveRequest(`/transactions/${encodeURIComponent(event.data.id)}/verify`);
    const transaction = verification.data || {};
    if (transaction.status !== "successful") return res.json({ received: true });

    const payment = await Payment.findOne({ gateway: "flutterwave", providerSessionId: transaction.tx_ref });
    if (!payment) return res.json({ received: true });
    if (String(transaction.currency || "").toUpperCase() !== "RWF" ||
      !verifyFlutterwaveAmount(transaction.amount, payment.amount)) {
      return res.status(400).json({ message: "Flutterwave transaction does not match the pending payment." });
    }

    await fulfillGatewayPayment(payment, {
      captureId: String(transaction.id),
      customerId: String(transaction.customer?.id || ""),
      receiptNumber: String(transaction.flw_ref || transaction.id)
    }, `flutterwave-${transaction.id}`);
    return res.json({ received: true });
  } catch (error) {
    return res.status(500).json({ message: "Unable to process Flutterwave webhook." });
  }
}

module.exports = flutterwaveWebhook;
