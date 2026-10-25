/**
 * Utilidades para generación y verificación de TOTP (Time-Based One-Time Password)
 * compatible con Google Authenticator / Authy, implementado en TypeScript puro.
 */

// Decodificador de Base32
function base32Decode(base32: string): Uint8Array {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = base32.toUpperCase().replace(/[\s-]/g, "").replace(/=+$/, "");
  const length = cleaned.length;
  const bytes = new Uint8Array(Math.floor((length * 5) / 8));
  let val = 0;
  let bits = 0;
  let index = 0;

  for (let i = 0; i < length; i++) {
    const char = cleaned[i];
    const charValue = alphabet.indexOf(char);
    if (charValue === -1) {
      throw new Error(`Carácter Base32 inválido: ${char}`);
    }
    val = (val << 5) | charValue;
    bits += 5;
    if (bits >= 8) {
      bytes[index++] = (val >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }
  return bytes;
}

// Algoritmo SHA-1 puro en JS
function sha1(message: Uint8Array): Uint8Array {
  const h0 = 0x67452301;
  const h1 = 0xefcdab89;
  const h2 = 0x98badcfe;
  const h3 = 0x10325476;
  const h4 = 0xc3d2e1f0;

  const l = message.length;
  const bitLen = l * 8;
  const paddingLen = (56 - ((l + 1) % 64) + 64) % 64;
  const words = new Uint32Array(Math.ceil((l + 1 + paddingLen + 8) / 4));

  for (let i = 0; i < l; i++) {
    words[i >>> 2] |= message[i] << (24 - (i % 4) * 8);
  }
  words[l >>> 2] |= 0x80 << (24 - (l % 4) * 8);

  words[words.length - 1] = bitLen & 0xffffffff;
  words[words.length - 2] = (bitLen / 0x100000000) & 0xffffffff;

  let a = h0, b = h1, c = h2, d = h3, e = h4;
  const w = new Uint32Array(80);

  const leftRotate = (x: number, n: number) => (x << n) | (x >>> (32 - n));

  for (let i = 0; i < words.length; i += 16) {
    for (let j = 0; j < 16; j++) {
      w[j] = words[i + j];
    }
    for (let j = 16; j < 80; j++) {
      w[j] = leftRotate(w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16], 1);
    }

    let tempA = a, tempB = b, tempC = c, tempD = d, tempE = e;

    for (let j = 0; j < 80; j++) {
      let f = 0;
      let k = 0;
      if (j < 20) {
        f = (tempB & tempC) | (~tempB & tempD);
        k = 0x5a827999;
      } else if (j < 40) {
        f = tempB ^ tempC ^ tempD;
        k = 0x6ed9eba1;
      } else if (j < 60) {
        f = (tempB & tempC) | (tempB & tempD) | (tempC & tempD);
        k = 0x8f1bbcdc;
      } else {
        f = tempB ^ tempC ^ tempD;
        k = 0xca62c1d6;
      }

      const temp = (leftRotate(tempA, 5) + f + tempE + k + w[j]) | 0;
      tempE = tempD;
      tempD = tempC;
      tempC = leftRotate(tempB, 30) | 0;
      tempB = tempA;
      tempA = temp;
    }

    a = (a + tempA) | 0;
    b = (b + tempB) | 0;
    c = (c + tempC) | 0;
    d = (d + tempD) | 0;
    e = (e + tempE) | 0;
  }

  const result = new Uint8Array(20);
  for (let i = 0; i < 5; i++) {
    const val = [a, b, c, d, e][i];
    result[i * 4] = (val >>> 24) & 0xff;
    result[i * 4 + 1] = (val >>> 16) & 0xff;
    result[i * 4 + 2] = (val >>> 8) & 0xff;
    result[i * 4 + 3] = val & 0xff;
  }
  return result;
}

// HMAC-SHA-1
function hmacSha1(key: Uint8Array, message: Uint8Array): Uint8Array {
  let formattedKey = key;
  if (key.length > 64) {
    formattedKey = sha1(key);
  }

  const padKey = new Uint8Array(64);
  padKey.set(formattedKey);

  const oPad = new Uint8Array(64);
  const iPad = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    oPad[i] = padKey[i] ^ 0x5c;
    iPad[i] = padKey[i] ^ 0x36;
  }

  const innerMessage = new Uint8Array(64 + message.length);
  innerMessage.set(iPad);
  innerMessage.set(message, 64);
  const innerHash = sha1(innerMessage);

  const outerMessage = new Uint8Array(64 + innerHash.length);
  outerMessage.set(oPad);
  outerMessage.set(innerHash, 64);

  return sha1(outerMessage);
}

/**
 * Genera el código OTP basado en contador (HOTP)
 */
export function generateHOTP(secretBase32: string, counter: number): string {
  const key = base32Decode(secretBase32);

  // El contador debe ser un entero de 8 bytes big-endian
  const counterBytes = new Uint8Array(8);
  let tmp = counter;
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = tmp & 0xff;
    tmp = Math.floor(tmp / 256);
  }

  const hmac = hmacSha1(key, counterBytes);

  // Truncado Dinámico (Dynamic Truncation)
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = code % 1000000;
  return otp.toString().padStart(6, "0");
}

/**
 * Genera el código TOTP actual para una clave secreta
 */
export function generateTOTP(secretBase32: string): string {
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / 30);
  return generateHOTP(secretBase32, counter);
}

/**
 * Verifica si un código ingresado es válido para la clave secreta actual
 * @param secretBase32 Clave en formato Base32
 * @param code Código de 6 dígitos ingresado por el usuario
 * @param window Rango de tiempo permitido en intervalos de 30s (por defecto 1 = +-30s para desfase de reloj)
 */
export function verifyTOTP(secretBase32: string, code: string, window = 1): boolean {
  const epoch = Math.floor(Date.now() / 1000);
  const currentCounter = Math.floor(epoch / 30);

  const cleanCode = code.trim();
  if (cleanCode.length !== 6 || isNaN(Number(cleanCode))) {
    return false;
  }

  for (let i = -window; i <= window; i++) {
    const expectedCode = generateHOTP(secretBase32, currentCounter + i);
    if (expectedCode === cleanCode) {
      return true;
    }
  }
  return false;
}

/**
 * Genera una nueva clave secreta en formato Base32 (16 caracteres)
 */
export function generateSecret(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let result = "";
  for (let i = 0; i < 16; i++) {
    const rand = Math.floor(Math.random() * alphabet.length);
    result += alphabet[rand];
  }
  return result;
}
