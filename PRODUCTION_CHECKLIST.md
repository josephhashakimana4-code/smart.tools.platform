Production deployment checklist

- Obtain SSL certificate and configure HTTPS (or use platform-managed TLS)
- Configure domain DNS and point to hosting (Render/Cloudflare/Netlify/etc.)
- Enable CDN/WAF (Cloudflare, Fastly) and configure WAF rules
- Store secrets in platform secret store (Render secrets, AWS Secrets Manager)
- Set `NODE_ENV=production` and remove test-only responses
- Review and tighten CSP; remove 'unsafe-inline' where possible
- Turn on Sentry (set `SENTRY_DSN`) or another monitoring service
- Configure backups for your database and test restores
- Configure monitoring/alerting for errors, latency, and unusual traffic
- Run security scans (Dependabot, `npm audit`) and fix critical issues
- Review admin RBAC and enable 2FA for admin accounts
