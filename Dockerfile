FROM node:24-bookworm-slim

ENV NODE_ENV=production

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       clamav \
       clamav-freshclam \
       ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev; \
    else \
      npm install --omit=dev; \
    fi

COPY . .

# Download the latest ClamAV signatures during image build.
# If the mirror is temporarily unavailable, the existing database
# from the base packages is retained and runtime verification handles it.
RUN freshclam --stdout --verbose || true

RUN clamscan --version

EXPOSE 10000

CMD ["npm", "start"]
