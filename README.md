# Smart Tools Platform

Node.js and Express application for online tools, file conversion, user accounts, and administration.

## Requirements

- Node.js 20 or later
- MongoDB for persistent application data

## Local Setup

```sh
npm install
cp .env.example .env
npm start
```

Set `MONGO_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `ADMIN_PASSWORD` in `.env` before running the application. Use unique secrets outside local development.

## Verification

```sh
npm test
node verify-production-ready.js
npm audit --omit=dev
```

Deployment requirements and the complete launch checklist are in [PRODUCTION_README.md](PRODUCTION_README.md), [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md), and [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md).