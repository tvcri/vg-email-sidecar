# Node current LTS (24.x)
FROM node:24-slim

ENV NODE_ENV=production

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

USER node

# PIN webhook listener (only active when VG_ENROLL_SIDECAR_KEY is set).
# Requires HTTP_HOST=0.0.0.0 in .env to be reachable from outside the container.
EXPOSE 8125

# Runtime files are bind mounts, not baked into the image:
#   .env                  -> /app/.env
#   vg-mailer-sa-key.json -> /app/vg-mailer-sa-key.json (or set GMAIL_SA_KEY_PATH)
CMD ["node", "src/index.js"]
