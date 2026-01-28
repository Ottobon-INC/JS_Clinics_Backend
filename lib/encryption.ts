import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;

function getKey(): Buffer {
    const secret = process.env.ENCRYPTION_KEY;
    if (!secret) {
        throw new Error('ENCRYPTION_KEY is not defined');
    }
    // If the key is hex, parse it. Otherwise use it directly (though 32 hex chars = 16 bytes, we strictly need 32 bytes for aes-256)
    // My generated key is 32 bytes -> 64 hex chars. 
    // Buffer.from(hex, 'hex') gives 32 bytes.
    return Buffer.from(secret, 'hex');
}

export function encrypt(text: string): string {
    if (!text) return text;

    const iv = crypto.randomBytes(IV_LENGTH);
    const key = getKey();

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

export function decrypt(text: string): string {
    if (!text) return text;

    try {
        const parts = text.split(':');
        if (parts.length !== 3) {
            // Assuming it's legacy/plain text if doesn't match format
            return text;
        }

        const [ivHex, tagHex, encryptedHex] = parts;

        const iv = Buffer.from(ivHex, 'hex');
        const tag = Buffer.from(tagHex, 'hex');
        const key = getKey();

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);

        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error('Decryption failed:', error);
        // Return original text if decryption fails (fallback for plaintext migration)
        return text;
    }
}
