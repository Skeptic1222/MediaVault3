import { describe, it, expect, beforeEach } from 'vitest';
import { cryptoService } from '../../server/services/cryptoService';
import crypto from 'crypto';

describe('CryptoService', () => {
  let testData: Buffer;
  let testPassphrase: string;

  beforeEach(() => {
    testData = Buffer.from('This is sensitive test data that should be encrypted');
    testPassphrase = 'test-passphrase-123';
  });

  describe('Buffer Encryption', () => {
    it('should encrypt buffer successfully', () => {
      const encrypted = cryptoService.encryptBuffer(testData, testPassphrase);

      expect(encrypted).toBeDefined();
      expect(encrypted).toBeInstanceOf(Buffer);
      expect(encrypted.length).toBeGreaterThan(testData.length);
    });

    it('should produce different ciphertext for same data with different passphrases', () => {
      const encrypted1 = cryptoService.encryptBuffer(testData, 'passphrase1');
      const encrypted2 = cryptoService.encryptBuffer(testData, 'passphrase2');

      expect(encrypted1).not.toEqual(encrypted2);
    });

    it('should produce different ciphertext on each encryption (random IV and salt)', () => {
      const encrypted1 = cryptoService.encryptBuffer(testData, testPassphrase);
      const encrypted2 = cryptoService.encryptBuffer(testData, testPassphrase);

      expect(encrypted1).not.toEqual(encrypted2);
    });
  });

  describe('Buffer Decryption', () => {
    it('should decrypt data successfully with correct passphrase', () => {
      const encrypted = cryptoService.encryptBuffer(testData, testPassphrase);
      const decrypted = cryptoService.decryptBuffer(encrypted, testPassphrase);

      expect(decrypted).toEqual(testData);
      expect(decrypted.toString()).toBe(testData.toString());
    });

    it('should fail to decrypt with wrong passphrase', () => {
      const encrypted = cryptoService.encryptBuffer(testData, testPassphrase);

      expect(() => {
        cryptoService.decryptBuffer(encrypted, 'wrong-passphrase');
      }).toThrow('Decryption failed');
    });

    it('should fail to decrypt with tampered ciphertext', () => {
      const encrypted = cryptoService.encryptBuffer(testData, testPassphrase);

      // Tamper with the encrypted data (after salt, iv, and tag)
      const tamperedData = Buffer.from(encrypted);
      tamperedData[tamperedData.length - 1] = tamperedData[tamperedData.length - 1] ^ 0xFF;

      expect(() => {
        cryptoService.decryptBuffer(tamperedData, testPassphrase);
      }).toThrow('Decryption failed');
    });

    it('should fail to decrypt with invalid buffer length', () => {
      const invalidBuffer = Buffer.alloc(10); // Too short

      expect(() => {
        cryptoService.decryptBuffer(invalidBuffer, testPassphrase);
      }).toThrow('Invalid encrypted buffer length');
    });
  });

  describe('String Encryption', () => {
    it('should encrypt string successfully', () => {
      const testString = 'Hello, World!';
      const encrypted = cryptoService.encryptString(testString, testPassphrase);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(testString);
    });

    it('should decrypt string successfully', () => {
      const testString = 'Hello, World!';
      const encrypted = cryptoService.encryptString(testString, testPassphrase);
      const decrypted = cryptoService.decryptString(encrypted, testPassphrase);

      expect(decrypted).toBe(testString);
    });

    it('should handle Unicode characters', () => {
      const unicodeString = '你好世界 🌍 Привет мир';
      const encrypted = cryptoService.encryptString(unicodeString, testPassphrase);
      const decrypted = cryptoService.decryptString(encrypted, testPassphrase);

      expect(decrypted).toBe(unicodeString);
    });

    it('should handle empty string', () => {
      const emptyString = '';
      const encrypted = cryptoService.encryptString(emptyString, testPassphrase);
      const decrypted = cryptoService.decryptString(encrypted, testPassphrase);

      expect(decrypted).toBe(emptyString);
    });
  });

  describe('Key Derivation', () => {
    it('should derive consistent key from same passphrase and salt', () => {
      const salt = crypto.randomBytes(32);
      const key1 = cryptoService.deriveKey(testPassphrase, salt);
      const key2 = cryptoService.deriveKey(testPassphrase, salt);

      expect(key1).toEqual(key2);
    });

    it('should derive different keys from different passphrases', () => {
      const salt = crypto.randomBytes(32);
      const key1 = cryptoService.deriveKey('passphrase1', salt);
      const key2 = cryptoService.deriveKey('passphrase2', salt);

      expect(key1).not.toEqual(key2);
    });

    it('should derive different keys with different salts', () => {
      const salt1 = crypto.randomBytes(32);
      const salt2 = crypto.randomBytes(32);
      const key1 = cryptoService.deriveKey(testPassphrase, salt1);
      const key2 = cryptoService.deriveKey(testPassphrase, salt2);

      expect(key1).not.toEqual(key2);
    });

    it('should derive 32-byte key', () => {
      const salt = crypto.randomBytes(32);
      const key = cryptoService.deriveKey(testPassphrase, salt);

      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
    });

    it('should generate random salts', () => {
      const salt1 = cryptoService.generateSalt();
      const salt2 = cryptoService.generateSalt();

      expect(salt1).not.toEqual(salt2);
      expect(salt1.length).toBe(32);
      expect(salt2.length).toBe(32);
    });
  });

  describe('SHA-256 Hash Generation', () => {
    it('should generate consistent hash for same input', () => {
      const hash1 = cryptoService.generateSHA256(testData);
      const hash2 = cryptoService.generateSHA256(testData);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different inputs', () => {
      const hash1 = cryptoService.generateSHA256(Buffer.from('data1'));
      const hash2 = cryptoService.generateSHA256(Buffer.from('data2'));

      expect(hash1).not.toBe(hash2);
    });

    it('should generate 64-character hex hash', () => {
      const hash = cryptoService.generateSHA256(testData);

      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('Password Hashing', () => {
    const testPassword = 'MySecurePassword123!';

    it('should hash passwords', () => {
      const hashed = cryptoService.hashPassword(testPassword);

      expect(hashed).toBeDefined();
      expect(hashed).toContain(':');
      expect(hashed).not.toBe(testPassword);
    });

    it('should verify correct passwords', () => {
      const hashed = cryptoService.hashPassword(testPassword);
      const isValid = cryptoService.verifyPassword(testPassword, hashed);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect passwords', () => {
      const hashed = cryptoService.hashPassword(testPassword);
      const isValid = cryptoService.verifyPassword('WrongPassword', hashed);

      expect(isValid).toBe(false);
    });

    it('should produce different hashes for same password', () => {
      const hashed1 = cryptoService.hashPassword(testPassword);
      const hashed2 = cryptoService.hashPassword(testPassword);

      expect(hashed1).not.toBe(hashed2);
    });
  });

  describe('UUID Generation', () => {
    it('should generate valid UUID v4', () => {
      const uuid = cryptoService.generateUUID();

      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate unique UUIDs', () => {
      const uuid1 = cryptoService.generateUUID();
      const uuid2 = cryptoService.generateUUID();

      expect(uuid1).not.toBe(uuid2);
    });
  });

  describe('Secure Password Generation', () => {
    it('should generate password of specified length', () => {
      const password = cryptoService.generateSecurePassword(20);

      expect(password).toHaveLength(20);
    });

    it('should generate different passwords', () => {
      const password1 = cryptoService.generateSecurePassword(32);
      const password2 = cryptoService.generateSecurePassword(32);

      expect(password1).not.toBe(password2);
    });

    it('should generate password with default length', () => {
      const password = cryptoService.generateSecurePassword();

      expect(password).toHaveLength(32);
    });
  });

  describe('Constant Time Comparison', () => {
    it('should return true for identical strings', () => {
      const str = 'test-string-123';
      expect(cryptoService.constantTimeCompare(str, str)).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(cryptoService.constantTimeCompare('string1', 'string2')).toBe(false);
    });

    it('should return false for strings of different lengths', () => {
      expect(cryptoService.constantTimeCompare('short', 'much longer string')).toBe(false);
    });
  });

  describe('Encryption/Decryption Round-trip', () => {
    it('should correctly encrypt and decrypt large data', () => {
      const largeData = Buffer.alloc(1024 * 100, 'A'); // 100KB of 'A'
      const encrypted = cryptoService.encryptBuffer(largeData, testPassphrase);
      const decrypted = cryptoService.decryptBuffer(encrypted, testPassphrase);

      expect(decrypted).toEqual(largeData);
    }, 30000); // 30 second timeout for large data encryption

    it('should handle empty data', () => {
      const emptyData = Buffer.alloc(0);
      const encrypted = cryptoService.encryptBuffer(emptyData, testPassphrase);
      const decrypted = cryptoService.decryptBuffer(encrypted, testPassphrase);

      expect(decrypted).toEqual(emptyData);
    });

    it('should handle special characters in passphrase', () => {
      const specialPassphrase = 'p@$$w0rd!#%^&*()_+{}[]|:;<>?,./~`';
      const encrypted = cryptoService.encryptBuffer(testData, specialPassphrase);
      const decrypted = cryptoService.decryptBuffer(encrypted, specialPassphrase);

      expect(decrypted).toEqual(testData);
    });
  });
});
