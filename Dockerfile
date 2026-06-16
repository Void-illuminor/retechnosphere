# reTechnoSphere — single image that builds the client and runs the world server.
FROM node:22-slim

WORKDIR /app

# Install all deps (build needs the dev tooling), then build, then drop dev deps.
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production
ENV PORT=8787
ENV DATA_DIR=/data
EXPOSE 8787

# Persist the world here (mount a volume at /data in production).
VOLUME ["/data"]

CMD ["npm", "start"]
