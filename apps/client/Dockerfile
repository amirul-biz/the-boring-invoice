# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace package files
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Copy full workspace source
COPY . .

# Accept API URL as a build-time argument (baked into the Angular bundle)
ARG NG_APP_API_URL
ENV NG_APP_API_URL=$NG_APP_API_URL

# Build the Angular client with Nx (defaults to production configuration)
RUN npx nx build client

# Stage 2: Production with Nginx
FROM nginx:alpine AS production

# Copy custom Nginx config from build context (workspace root)
COPY apps/client/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built SPA assets
COPY --from=builder /app/dist/apps/client/browser /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
