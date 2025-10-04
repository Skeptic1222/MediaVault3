#!/usr/bin/env node

/**
 * MediaVault - Secure Credential Generator
 *
 * Generates cryptographically secure random credentials for MediaVault deployment
 * Run with: node scripts/generate-credentials.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('🔐 MediaVault Secure Credential Generator\n');

// Generate secure random values
const credentials = {
  SESSION_SECRET: crypto.randomBytes(32).toString('base64'),
  FILESYSTEM_MASTER_KEY: crypto.randomBytes(32).toString('hex'),
  JWT_SECRET: crypto.randomBytes(32).toString('base64'),
  DB_PASSWORD: crypto.randomBytes(24).toString('base64').replace(/[+/=]/g, ''),
};

console.log('✅ Generated secure credentials:\n');
console.log('SESSION_SECRET=' + credentials.SESSION_SECRET);
console.log('FILESYSTEM_MASTER_KEY=' + credentials.FILESYSTEM_MASTER_KEY);
console.log('JWT_SECRET=' + credentials.JWT_SECRET);
console.log('DB_PASSWORD=' + credentials.DB_PASSWORD);

console.log('\n📋 Copy these values to your .env file');
console.log('\n⚠️  IMPORTANT:');
console.log('   - Never commit these values to version control');
console.log('   - Store them securely (1Password, Azure Key Vault, etc.)');
console.log('   - Regenerate for each deployment environment');
console.log('   - Enable Windows Credential Store for production\n');

// Optionally write to a secure file
const envPath = path.join(__dirname, '..', '.env.generated');
const envContent = `# MediaVault - Generated Credentials
# Generated: ${new Date().toISOString()}
# WARNING: This file contains sensitive data. Delete after copying to .env

SESSION_SECRET=${credentials.SESSION_SECRET}
FILESYSTEM_MASTER_KEY=${credentials.FILESYSTEM_MASTER_KEY}
JWT_SECRET=${credentials.JWT_SECRET}
DB_PASSWORD=${credentials.DB_PASSWORD}

# Next steps:
# 1. Copy these values to your .env file
# 2. Delete this file: rm .env.generated
# 3. Update DATABASE_URL with the DB_PASSWORD above
# 4. Set SECURE_COOKIES=true for production
# 5. Set AUTH_DISABLED=false
# 6. Configure Google OAuth credentials
`;

fs.writeFileSync(envPath, envContent, { mode: 0o600 });
console.log(`📝 Credentials also saved to: ${envPath}`);
console.log('   Delete this file after copying to .env\n');
