import { createHash, randomBytes } from "node:crypto";

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

export function randomBase58(length: number): string {
  let result = "";
  const random = randomBytes(length);
  for (let i = 0; i < length; i += 1) {
    result += BASE58_ALPHABET[random[i] % BASE58_ALPHABET.length];
  }
  return result;
}
