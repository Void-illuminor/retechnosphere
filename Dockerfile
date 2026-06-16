# reTechnoSphere — single image that builds the client and runs the world server.
FROM node:22-slim

WORKDIR /app

# Install all deps (build needs the dev tooling), then build, then drop dev deps.
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production
ENV DATA_DIR=/data
# Railway (and most hosts) inject PORT at runtime; the server falls back to 8787.
EXPOSE 8787

# Persist the world by mounting a volume at /data (Railway Volumes / docker -v).
CMD ["npm", "start"]
