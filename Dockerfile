FROM node:20-alpine

WORKDIR /app

# Install deps first (layer cache friendly)
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Create user, data dir, and chown BEFORE copying source
RUN addgroup -g 1001 -S nodejs && adduser -S nodeapp -u 1001
RUN mkdir -p /data && chown -R nodeapp:nodejs /data

# Copy source code
COPY --chown=nodeapp:nodejs . .

USER nodeapp

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "src/index.js"]
