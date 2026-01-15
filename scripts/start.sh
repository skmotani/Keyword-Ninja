#!/bin/sh
# Initialize volume with data files on first deployment

DATA_DIR="/app/data"
BACKUP_DIR="/app/data-init"

# Check if volume is empty (no clients.json means first run)
if [ ! -f "$DATA_DIR/clients.json" ]; then
    echo "📦 Volume is empty - copying initial data files..."
    
    # Copy all files from backup to volume
    if [ -d "$BACKUP_DIR" ]; then
        cp -r "$BACKUP_DIR"/* "$DATA_DIR/" 2>/dev/null || true
        echo "✅ Data files copied to volume successfully!"
        ls -la "$DATA_DIR/"
    else
        echo "⚠️ No backup data found at $BACKUP_DIR"
    fi
else
    echo "📁 Data already exists in volume - skipping initialization"
fi

# Run prisma db push
echo "🔄 Syncing database schema..."
npx prisma db push --accept-data-loss

# Start the application
echo "🚀 Starting Next.js..."
exec next start -p ${PORT:-5000} -H 0.0.0.0
