import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length < KEY_LENGTH) {
    throw new Error('ENCRYPTION_KEY deve ter pelo menos 32 caracteres');
  }
  return crypto.scryptSync(key, 'salt', KEY_LENGTH);
}

export function encrypt(text: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted1 = cipher.update(text, 'utf8');
  const encrypted2 = cipher.final();
  const authTag = cipher.getAuthTag();

  const result = Buffer.concat([iv, encrypted1, encrypted2, authTag]);
  return result.toString('base64');
}

export function decrypt(encryptedText: string): string {
  const key = getKey();
  const buffer = Buffer.from(encryptedText, 'base64');

  const iv = buffer.subarray(0, IV_LENGTH);
  const authTag = buffer.subarray(buffer.length - AUTH_TAG_LENGTH);
  const encrypted = buffer.subarray(IV_LENGTH, buffer.length - AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted1 = decipher.update(encrypted);
  const decrypted2 = decipher.final();

  return Buffer.concat([decrypted1, decrypted2]).toString('utf8');
}

export function maskCPF(cpf: string): string {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return cpf;
  return `${cleaned.slice(0, 3)}.***.***-${cleaned.slice(9)}`;
}

export function maskRG(rg: string): string {
  const cleaned = rg.replace(/\D/g, '');
  if (cleaned.length < 4) return rg;
  return `${cleaned.slice(0, 2)}.***.***-${cleaned.slice(-1)}`;
}

export function maskPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 8) return phone;
  return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-****`;
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const maskedLocal = local.length > 2
    ? `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}`
    : `${local[0]}${'*'.repeat(local.length - 1)}`;
  return `${maskedLocal}@${domain}`;
}