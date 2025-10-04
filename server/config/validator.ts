import * as dotenv from 'dotenv';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// Configuration validator for MediaVault
// Ensures all required environment variables are set with secure values

interface ConfigValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class ConfigValidator {
  private requiredVars = [
    'NODE_ENV',
    'PORT',
    'DATABASE_URL',
    'DB_USER',
    'DB_PASSWORD',
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'FILESYSTEM_MASTER_KEY',
    'JWT_SECRET',
    'SESSION_SECRET',
  ];

  private sensitivePatterns = [
    { pattern: /postgres:postgres/, message: 'Default PostgreSQL credentials detected' },
    { pattern: /password|secret|123|admin/i, message: 'Weak password pattern detected' },
    { pattern: /localhost.*:.*@/, message: 'Credentials in DATABASE_URL should use environment variables' },
  ];

  private securityChecks = [
    { key: 'SECURE_COOKIES', expected: 'true', message: 'Secure cookies must be enabled in production' },
    { key: 'AUTH_DISABLED', expected: 'false', message: 'Authentication must not be disabled in production' },
    { key: 'SKIP_AUTH', expected: 'false', message: 'Authentication bypass must be disabled' },
    { key: 'NO_AUTH', expected: 'false', message: 'No-auth mode must be disabled' },
  ];

  validate(): ConfigValidation {
    const result: ConfigValidation = {
      valid: true,
      errors: [],
      warnings: [],
    };

    // Load environment variables
    dotenv.config();

    // Check NODE_ENV
    const nodeEnv = process.env.NODE_ENV;
    if (!nodeEnv) {
      result.errors.push('NODE_ENV is not set');
      result.valid = false;
    }

    // Check required variables
    for (const varName of this.requiredVars) {
      if (!process.env[varName]) {
        result.errors.push(`Required environment variable ${varName} is not set`);
        result.valid = false;
      }
    }

    // Check for default/weak credentials
    if (process.env.DB_USER === 'postgres') {
      result.warnings.push('Using postgres superuser is not recommended - create a dedicated database user');
    }

    if (process.env.DB_PASSWORD) {
      // Check password strength
      const password = process.env.DB_PASSWORD;
      if (password.length < 12) {
        result.errors.push('Database password must be at least 12 characters long');
        result.valid = false;
      }

      // Check for common weak patterns
      if (password.toLowerCase() === 'postgres' || password === 'password' || password === 'admin') {
        result.errors.push('Database password contains weak/default value');
        result.valid = false;
      }
    }

    // Validate security keys
    this.validateSecurityKey('FILESYSTEM_MASTER_KEY', 64, result); // 32 bytes hex = 64 chars
    this.validateSecurityKey('JWT_SECRET', 32, result, true); // Base64, min 32 chars
    this.validateSecurityKey('SESSION_SECRET', 32, result, true); // Base64, min 32 chars

    // Check security settings for production
    if (nodeEnv === 'production') {
      for (const check of this.securityChecks) {
        if (process.env[check.key] !== check.expected) {
          result.errors.push(`${check.message} (${check.key} must be ${check.expected})`);
          result.valid = false;
        }
      }

      // Additional production checks
      if (process.env.SECURE_COOKIES !== 'true') {
        result.errors.push('SECURE_COOKIES must be true in production');
        result.valid = false;
      }

      if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === 'http://localhost') {
        result.warnings.push('CORS_ORIGIN should be set to production domain');
      }
    }

    // Check for sensitive data patterns
    const envContent = this.getEnvFileContent();
    if (envContent) {
      for (const check of this.sensitivePatterns) {
        if (check.pattern.test(envContent)) {
          result.warnings.push(check.message);
        }
      }
    }

    // Validate PBKDF2 iterations
    const iterations = parseInt(process.env.PBKDF2_ITERATIONS || '0');
    if (iterations < 600000) {
      result.warnings.push('PBKDF2_ITERATIONS should be at least 600000 (OWASP 2023 recommendation)');
    }

    // Check file permissions on .env file
    this.checkFilePermissions(result);

    return result;
  }

  private validateSecurityKey(
    keyName: string,
    minLength: number,
    result: ConfigValidation,
    isBase64: boolean = false
  ): void {
    const value = process.env[keyName];
    if (!value) {
      result.errors.push(`${keyName} is not set`);
      result.valid = false;
      return;
    }

    if (value.length < minLength) {
      result.errors.push(`${keyName} is too short (minimum ${minLength} characters)`);
      result.valid = false;
    }

    // Check for placeholder values
    if (value.includes('GENERATE') || value.includes('CHANGE_THIS')) {
      result.errors.push(`${keyName} contains placeholder value - must be regenerated`);
      result.valid = false;
    }

    // Check entropy
    if (isBase64) {
      try {
        const decoded = Buffer.from(value, 'base64');
        if (decoded.length < 32) {
          result.warnings.push(`${keyName} should be at least 256 bits (32 bytes)`);
        }
      } catch {
        result.errors.push(`${keyName} is not valid base64`);
        result.valid = false;
      }
    }
  }

  private getEnvFileContent(): string | null {
    try {
      const envPath = path.join(process.cwd(), '.env');
      return fs.readFileSync(envPath, 'utf-8');
    } catch {
      return null;
    }
  }

  private checkFilePermissions(result: ConfigValidation): void {
    try {
      const envPath = path.join(process.cwd(), '.env');
      const stats = fs.statSync(envPath);

      // On Windows, check if file is not readable by everyone
      if (process.platform === 'win32') {
        // Windows file permissions are complex, just warn
        result.warnings.push('Ensure .env file permissions are restricted to current user only');
      } else {
        // Unix-like systems
        const mode = stats.mode & parseInt('777', 8);
        if (mode & parseInt('044', 8)) {
          result.warnings.push('.env file is readable by other users - restrict permissions with: chmod 600 .env');
        }
      }
    } catch {
      // File doesn't exist or can't be accessed
    }
  }

  generateSecureCredentials(): void {
    console.log('\n=== Generating Secure Credentials ===\n');

    console.log('# Database Password (32 characters):');
    const dbPassword = crypto.randomBytes(24).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
    console.log(`DB_PASSWORD=${dbPassword}\n`);

    console.log('# Filesystem Master Key (32 bytes hex):');
    const masterKey = crypto.randomBytes(32).toString('hex');
    console.log(`FILESYSTEM_MASTER_KEY=${masterKey}\n`);

    console.log('# JWT Secret (256-bit base64):');
    const jwtSecret = crypto.randomBytes(32).toString('base64');
    console.log(`JWT_SECRET=${jwtSecret}\n`);

    console.log('# Session Secret (256-bit base64):');
    const sessionSecret = crypto.randomBytes(32).toString('base64');
    console.log(`SESSION_SECRET=${sessionSecret}\n`);

    console.log('Add these to your .env file and keep them secure!');
  }
}

// Run validation if called directly
const isMainModule = import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`;
if (isMainModule) {
  const validator = new ConfigValidator();

  // Check for --generate flag
  if (process.argv.includes('--generate')) {
    validator.generateSecureCredentials();
    process.exit(0);
  }

  const result = validator.validate();

  console.log('\n=== MediaVault Configuration Validation ===\n');

  if (result.errors.length > 0) {
    console.error('❌ ERRORS:');
    result.errors.forEach(error => console.error(`  - ${error}`));
    console.log('');
  }

  if (result.warnings.length > 0) {
    console.warn('⚠️  WARNINGS:');
    result.warnings.forEach(warning => console.warn(`  - ${warning}`));
    console.log('');
  }

  if (result.valid) {
    console.log('✅ Configuration is valid!');
    process.exit(0);
  } else {
    console.error('❌ Configuration validation failed!');
    console.log('\nRun with --generate flag to generate secure credentials:');
    console.log('  npx ts-node server/config/validator.ts --generate');
    process.exit(1);
  }
}