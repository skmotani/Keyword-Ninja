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
RUN mkdir -p /app/data-init && cp -r /app/data/* /app/data-init/ 2>/dev/null || echo "No data to backup"

# Generate Prisma client
RUN npx prisma generate

# Build Next.js
RUN npm run build

# Expose port
EXPOSE 8080

# Start command: init data, push schema, start app
CMD ["sh", "-c", "node scripts/init-data.js && npx prisma db push --accept-data-loss && next start -p ${PORT:-8080} -H 0.0.0.0"]
