# Smart Tools Hub Deployment

This site is a Node.js Express app that serves the frontend and backend from one server. It needs an online MongoDB database.

## Recommended Setup

Use:
- Render for hosting the Node.js website.
- MongoDB Atlas for the online database.
- A custom domain after the site is live.

## 1. Create MongoDB Atlas Database

1. Go to MongoDB Atlas and create a free cluster.
2. Create a database user and password.
3. Add network access for Render. For a quick first launch, allow `0.0.0.0/0`, then tighten it later if needed.
4. Copy the connection string.
5. Replace the username, password, and database name with your real values.

Example:

```text
mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/toolsdb?retryWrites=true&w=majority
```

## 2. Deploy on Render

1. Upload this project to GitHub.
2. In Render, create a new Web Service from the repository.
3. Set Root Directory to `backend`.
4. Set Build Command to `npm install`.
5. Set Start Command to `npm start`.
6. Add environment variables:

```text
NODE_ENV=production
MONGO_URI=your MongoDB Atlas connection string
ADMIN_PASSWORD=your strong private admin password
```

Render will give you a public URL like:

```text
https://smart-tools-hub.onrender.com
```

## 3. Seed Tools Online

After the first deployment, run the seed script once using the Render shell:

```bash
node seedTools.js
```

This creates or updates the tools in the online MongoDB database.

## 4. Admin Dashboard

Current live preview links:

```text
Website: https://cautious-telegram-7vg6prpxg76qhwxpp-5000.app.github.dev/
Admin: https://cautious-telegram-7vg6prpxg76qhwxpp-5000.app.github.dev/admin
```

Login with the `ADMIN_PASSWORD` environment variable you set on Render.

Use the dashboard to add:
- PayPal receiving email and checkout link.
- Real affiliate links per tool.
- Real sponsor ads and ad network scripts.
- SEO blog posts and business leads.

## 5. Custom Domain

In Render, open the web service settings and add your domain. Then update your domain DNS records using the values Render gives you.

## Notes

Uploaded/generated files in `backend/converted` are temporary on many free hosts. For long-term file storage, use a persistent disk or cloud storage later.
