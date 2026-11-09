# Flutterwave Rwanda MoMo setup

This website uses Flutterwave's Rwanda Mobile Money charge flow for **one-time payments in RWF**. Customers enter the mobile number linked to their wallet and approve the request on Flutterwave's authorization page. The site activates a plan only after server-side transaction verification.

## Server configuration

Set these environment variables in the hosting dashboard (for Render, open the service's Environment page):

- `APP_BASE_URL`: the public HTTPS URL of this site.
- `FLW_SECRET_KEY`: Flutterwave's server-side secret key. Keep it in the host's secret environment settings; never place it in frontend code or the admin dashboard.
- `FLW_SECRET_HASH`: the webhook secret hash configured in Flutterwave.

Use Flutterwave test credentials while setting up. Before accepting real payments, complete Flutterwave's merchant onboarding and enable Rwanda Mobile Money on the live account. Replace the test key with the live secret key through the hosting environment, then redeploy.

## Webhook

In Flutterwave, configure a V3 webhook URL at:

`https://YOUR-DOMAIN/api/business/webhooks/flutterwave`

Set the webhook secret hash to the same value as `FLW_SECRET_HASH`, enable successful charge notifications, and save. The endpoint checks the `verif-hash` header, then asks Flutterwave to verify the transaction before marking the site payment paid. Do not use the admin's PayPal email or MoMo payout reference as a webhook secret.

## Enable MoMo for a product

In Admin → Monetization → Plan Manager, set a positive **Rwanda MoMo one-time price (RWF)** on an active plan whose interval is **One-time**. Save the plan. The public checkout will then show Rwanda Mobile Money and filter the plan selector to eligible one-time products. Recurring monthly and yearly plans remain on PayPal or Stripe.

In Admin → Business Settings, save your Rwanda MTN or MPS account name and phone as an internal payout reference. Customer charges are collected by the Flutterwave merchant account; this reference does not cause a payout or automatic transfer to that MoMo number. A Flutterwave transfer would need separate payout configuration and explicit authorization. Issue MoMo charge refunds in the Flutterwave merchant dashboard; this site's refund button currently supports PayPal and Stripe only.

## Identify the PayPal and ad payout accounts

- Website PayPal checkout uses the PayPal merchant account represented by `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and `PAYPAL_WEBHOOK_ID` on the server. The saved PayPal email in Business Settings is only a label and the site does not verify account ownership.
- AdSense, PropellerAds, Adsterra, and affiliate networks send earnings to payout settings inside their own provider accounts. Configure and verify those destinations in each provider account. Saving an ad tag or MoMo reference in this site's dashboard does not change the provider's payout destination or prove the provider has approved the account.
- External payouts in the dashboard are manual records. Only the provider's own account statements can confirm that the money was sent.
