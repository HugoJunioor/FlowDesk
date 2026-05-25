FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --no-package-lock --no-save --no-audit --no-fund
COPY server.mjs ./
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8090/health || exit 1
CMD ["node", "server.mjs"]
