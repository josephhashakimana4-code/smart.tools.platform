# PayPal Checkout Setup

The site now supports PayPal for one-time plans and monthly or yearly subscriptions. PayPal credentials stay in the server environment; they are not entered in the admin dashboard.

## Add the PayPal app credentials

1. In PayPal Developer Dashboard, create a REST app for the merchant account that should receive the site's checkout payments.
2. For sandbox use, add the sandbox app's client ID and secret to the server environment and set `PAYPAL_API_BASE_URL=https://api-m.sandbox.paypal.com`.
3. For live checkout, use the live app credentials and set `PAYPAL_API_BASE_URL=https://api-m.paypal.com`.
4. Set `APP_BASE_URL` to the exact public website origin, for example `https://yourdomain.com`.

Set these environment variables in Render (or your hosting provider):

```text
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_API_BASE_URL=https://api-m.sandbox.paypal.com
PAYPAL_WEBHOOK_ID=...
```

Never put the client secret in browser code, the admin form, or a public repository.

## Register the webhook

Create a webhook for this HTTPS listener:

```text
https://yourdomain.com/api/business/webhooks/paypal
```

Subscribe it to these event types:

- `PAYMENT.CAPTURE.COMPLETED`
- `PAYMENT.CAPTURE.REFUNDED`
- `PAYMENT.SALE.REFUNDED`
- `BILLING.SUBSCRIPTION.ACTIVATED`
- `BILLING.SUBSCRIPTION.CANCELLED`
- `BILLING.SUBSCRIPTION.PAYMENT.FAILED`
- `BILLING.SUBSCRIPTION.SUSPENDED`
- `PAYMENT.SALE.COMPLETED`
- `PAYMENT.SALE.DENIED`

Copy the webhook ID (not the app client ID) into `PAYPAL_WEBHOOK_ID`, then restart or redeploy the service. Webhook signatures are verified with PayPal before payment records or entitlements are changed.

## How checkout behaves

- One-time plans use PayPal Orders and capture payment on the return to the pricing page.
- Monthly and yearly plans create a PayPal product and billing plan on first use, then send the buyer to approve a subscription.
- Once PayPal and its webhook are configured, PayPal becomes the site's only customer checkout method. Stripe remains available only until PayPal setup is complete.
- A buyer's plan is activated only after the site confirms a completed payment or an active subscription with a matching payment amount.
- If an admin cancels a PayPal subscription, the PayPal subscription is cancelled immediately. Stripe subscriptions retain their existing end-of-period cancellation behavior.
- The admin dashboard's PayPal email and payment-link fields are for manual payment instructions only. They do not configure API checkout.

PayPal checkout payments go to the merchant account connected to the REST app. Ad network and affiliate earnings remain controlled by each provider's payout settings; the website cannot redirect those provider payouts into PayPal.
