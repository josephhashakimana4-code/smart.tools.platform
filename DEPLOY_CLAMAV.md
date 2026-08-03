Production ClamAV deployment

Overview

This document describes how to install and run ClamAV on a typical Linux host (Ubuntu 22.04+), and how to ensure `clamscan` is available to the Node.js app for server-side scanning.

Install on Debian/Ubuntu

```bash
sudo apt update
sudo apt install -y clamav clamav-daemon clamav-freshclam
# Update signatures immediately
sudo systemctl stop clamav-freshclam
sudo freshclam
sudo systemctl start clamav-freshclam
# Ensure the daemon is running (for clamdscan usage)
sudo systemctl enable --now clamav-daemon
```

Alternative: use a dedicated scanning container

- Run official ClamAV container and expose socket or HTTP API from a small shim.
- Pros: isolates scanning, easier to update signatures.

Runtime: ensure `clamscan` is on PATH

- The app expects `clamscan` in PATH. If using a container, ensure the scanning container provides a CLI or use an HTTP shim.
- For production hardening, ensure `NODE_ENV=production` is set and a running clamd or clamscan is available.

Behavior changes

- When `NODE_ENV=production`, missing or failing scanner causes uploads to be rejected.
- In non-production environments the scanner is optional for developer convenience.

Security notes

- Keep signature updates up-to-date via `freshclam`.
- For high scale, prefer cloud-managed scanning or a background async scanner that quarantines files immediately.
