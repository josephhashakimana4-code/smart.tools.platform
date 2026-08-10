# Stripe production setup

The checkout implementation uses Stripe Checkout and does not expose any
merchant secret to the browser.

1. In Stripe, activate your account and enable the payment methods you want to
   offer. Prices are created from the active plan values in the application.
2. Set these Render environment variables:

   ```text
   APP_BASE_URL=https://your-custom-domain.example
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   RESEND_API_KEY=re_...
   EMAIL_FROM=receipts@your-production-domain.example
   ```

3. In Stripe Workbench, add a webhook endpoint:

   ```text
   https://your-custom-domain.example/api/business/webhooks/stripe
   ```

   Subscribe it to `checkout.session.completed`, `invoice.paid`,
   `invoice.payment_failed`, `customer.subscription.updated`,
   `customer.subscription.deleted`, and `charge.refunded`.

4. Deploy, then run a Stripe test-mode checkout before replacing the test keys
   with live keys. A successful event marks the payment paid and creates the
   entitled API key only once.

5. Do not use live payment credentials in local files, Git, browser code, or
   the admin settings form. Store them exclusively in Render environment
   variables.

## Release checks

- `APP_BASE_URL` exactly matches the public HTTPS domain.
- Webhook delivery shows HTTP 200 in Stripe.
- A paid checkout creates a `Payment` with `status: paid`.
- The checkout return page displays the API key after webhook fulfillment.
- A cancelled checkout remains pending and creates no API entitlement.
