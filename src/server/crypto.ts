/**
 * crypto.ts — Cifrado AES-256-GCM para datos sensibles en reposo (M-02)
 *
 * Requiere la variable de entorno PAYLOAD_ENCRYPTION_KEY con exactamente
 * 64 caracteres hexadecimales (= 32 bytes / 256 bits).
 *
 * Para generar una clave segura:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * El formato cifrado almacenado es:
 *   enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>
 *
 * Los valores que NO empiecen con "enc:v1:" se tratan como texto plano
 * (compatibilidad con registros anteriores al cifrado).
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const PREFIX    = 'enc:v1:';

function getKey(): Buffer {
  const hex = process.env.PAYLOAD_ENCRYPTION_KEY?.trim();
  if (!hex || hex.length !== 64) {
    throw new Error(
      '[crypto] PAYLOAD_ENCRYPTION_KEY debe ser exactamente 64 caracteres hexadecimales (32 bytes). ' +
      'Genera una con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Cifra un string y devuelve el token almacenable.
 * Devuelve null si el input es null/undefined.
 */
export function encrypt(plaintext: string | null | undefined): string | null {
  if (plaintext == null) return null;
  const key = getKey();
  const iv  = randomBytes(12); // 96 bits — recomendado para GCM
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag    = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/**
 * Descifra un token generado por encrypt().
 * Si el valor no tiene el prefijo "enc:v1:" lo devuelve tal cual
 * (compatibilidad con registros en texto plano previos al cifrado).
 * Devuelve null si el input es null/undefined.
 */
export function decrypt(token: string | null | undefined): string | null {
  if (token == null) return null;
  if (!token.startsWith(PREFIX)) return token; // texto plano legacy
  const key = getKey();
  const parts = token.slice(PREFIX.length).split(':');
  if (parts.length !== 3) throw new Error('[crypto] Token cifrado con formato inválido');
  const [ivHex, authTagHex, ciphertextHex] = parts;
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, 'hex')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}
