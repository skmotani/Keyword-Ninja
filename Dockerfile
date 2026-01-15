# Use Node.js official image
FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy all source files
COPY . .

# Copy data folder to backup location (before volume mounts over it)
RUN mkdir -p /app/data-init && cp -r /app/data/* /app/data-init/ || true

# Generate Prisma client
RUN npx prisma generate

# Build Next.js
RUN npm run build

# Make start script executable
RUN chmod +x /app/scripts/start.sh

# Expose port
EXPOSE 5000

# Use custom start script
CMD ["/bin/sh", "/app/scripts/start.sh"]
