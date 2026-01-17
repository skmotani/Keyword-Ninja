const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
const BACKUP_DIR = path.join(process.cwd(), 'data-init');

// Files that should ALWAYS be synced from repo (code-defined configs)
// These are not user-editable and should reflect the latest code
const ALWAYS_SYNC_FILES = [
    'dashboard_queries.json',
    'dashboard_query_groups.json',
];

console.log('🔍 Checking data directory...');
console.log('   DATA_DIR:', DATA_DIR);
console.log('   BACKUP_DIR:', BACKUP_DIR);

// Check if data directory is empty or missing critical files
function needsFullInit() {
    const testFile = path.join(DATA_DIR, 'clients.json');
    if (!fs.existsSync(testFile)) {
        console.log('   clients.json not found - needs full initialization');
        return true;
    }
    console.log('   clients.json exists - data already initialized');
    return false;
}

// Sync files that should always come from code (not user-editable)
function syncCodeDefinedFiles() {
    if (!fs.existsSync(BACKUP_DIR)) {
        console.log('⚠️ No backup directory for sync');
        return;
    }

    console.log('🔄 Syncing code-defined config files...');

    ALWAYS_SYNC_FILES.forEach(file => {
        const srcPath = path.join(BACKUP_DIR, file);
        const destPath = path.join(DATA_DIR, file);

        if (fs.existsSync(srcPath)) {
            fs.copyFileSync(srcPath, destPath);
            console.log(`   ✓ Synced: ${file}`);
        } else {
            console.log(`   ⚠ Not found in backup: ${file}`);
        }
    });
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
if (needsFullInit()) {
    if (copyData()) {
        console.log('✅ Data initialized successfully!');
    } else {
        console.log('⚠️ Could not initialize data - backup not found');
    }
} else {
    console.log('📁 Data directory already has data - syncing config files only');
    syncCodeDefinedFiles();
}

