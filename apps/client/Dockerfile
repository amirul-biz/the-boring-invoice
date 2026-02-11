# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Accept API URL as build argument
ARG NG_APP_API_URL
ENV NG_APP_API_URL=$NG_APP_API_URL

# Build the Angular app
RUN npx nx build client --prod

# Stage 2: Production with Nginx
FROM nginx:alpine AS production

# Copy custom nginx config
COPY apps/client/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built application
COPY --from=builder /app/dist/apps/client/browser /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
