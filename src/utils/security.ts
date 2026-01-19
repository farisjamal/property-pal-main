import CryptoJS from 'crypto-js';
import bcrypt from 'bcryptjs';



const ENCRYPTION_SECRET = import.meta.env.VITE_ENCRYPTION_KEY;

if (!ENCRYPTION_SECRET) {
    throw new Error("FATAL: VITE_ENCRYPTION_KEY is required. Application cannot start without encryption key. Please set VITE_ENCRYPTION_KEY in your .env file.");
}

/**
 * Encrypts sensitive data using AES (Advanced Encryption Standard).
 * This ensures that even if the database is leaked, the data remains unreadable.
 */
export const encryptData = (text: string): string => {
    if (!text) return '';
    return CryptoJS.AES.encrypt(text, ENCRYPTION_SECRET).toString();
};

/**
 * Decrypts AES ciphertext back to plain text.
 * Used when authorized users need to view the data.
 */
export const decryptData = (ciphertext: string): string => {
    if (!ciphertext) return '';
    try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_SECRET);
        return bytes.toString(CryptoJS.enc.Utf8);
    } catch (error) {
        console.error("Decryption failed:", error);
        return ciphertext; // Return original if failure (or handle gracefull)
    }
};

/**
 * Hashes a Security PIN using Bcrypt.
 * Uses a salt cost of 10.
 * The resulting hash is irreversible.
 */
export const hashPin = async (pin: string): Promise<string> => {
    if (!pin) return '';
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(pin, salt);
};
