FROM node:20-alpine

WORKDIR /app

# Install deps + su-exec for entrypoint privilege drop
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
RUN apk add --no-cache su-exec

# Create user
RUN addgroup -g 1001 -S nodejs && adduser -S nodeapp -u 1001

# Copy source + frontend
COPY --chown=nodeapp:nodejs . .

# Entrypoint: fix volume perms then drop to nodeapp
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER nodeapp
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "src/index.js"]
