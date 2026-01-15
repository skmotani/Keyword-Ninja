# Use Node.js official image
FROM node:22-alpine

# Install OpenSSL (required by Prisma)
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy prisma schema (needed for postinstall prisma generate)
COPY prisma ./prisma/

# Install dependencies (postinstall runs prisma generate)
RUN npm ci

# Copy all remaining source files
COPY . .

# Copy data folder to backup location (before volume mounts over it)
RUN mkdir -p /app/data-init && cp -r /app/data/* /app/data-init/ 2>/dev/null || echo "No data to backup"

# Build Next.js
RUN npm run build

# Expose port
EXPOSE 8080

# Start command: init data, push schema, start app (using npx for next)
CMD ["sh", "-c", "node scripts/init-data.js && npx prisma db push --accept-data-loss && npx next start -p ${PORT:-8080} -H 0.0.0.0"]
