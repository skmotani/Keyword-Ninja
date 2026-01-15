const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
const BACKUP_DIR = path.join(process.cwd(), 'data-init');

console.log('🔍 Checking data directory...');
console.log('   DATA_DIR:', DATA_DIR);
console.log('   BACKUP_DIR:', BACKUP_DIR);

// Check if data directory is empty or missing critical files
function needsInit() {
    const testFile = path.join(DATA_DIR, 'clients.json');
    if (!fs.existsSync(testFile)) {
        console.log('   clients.json not found - needs initialization');
        return true;
    }
    console.log('   clients.json exists - data already initialized');
    return false;
}

// Copy all files from backup to data
function copyData() {
    if (!fs.existsSync(BACKUP_DIR)) {
        console.log('⚠️ No backup directory found at:', BACKUP_DIR);
        return false;
    }

    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const files = fs.readdirSync(BACKUP_DIR);
    console.log(`📦 Copying ${files.length} items from backup...`);

    files.forEach(file => {
        const srcPath = path.join(BACKUP_DIR, file);
        const destPath = path.join(DATA_DIR, file);

        const stat = fs.statSync(srcPath);
        if (stat.isDirectory()) {
            // Copy directory recursively
            copyDir(srcPath, destPath);
        } else {
            // Copy file
            fs.copyFileSync(srcPath, destPath);
        }
        console.log(`   ✓ ${file}`);
    });

    return true;
}

function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    const files = fs.readdirSync(src);
    files.forEach(file => {
        const srcPath = path.join(src, file);
        const destPath = path.join(dest, file);
        const stat = fs.statSync(srcPath);
        if (stat.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    });
}

// Main
if (needsInit()) {
    if (copyData()) {
        console.log('✅ Data initialized successfully!');
    } else {
        console.log('⚠️ Could not initialize data - backup not found');
    }
} else {
    console.log('📁 Data directory already has data - skipping initialization');
}
