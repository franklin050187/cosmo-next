import { normalizeForSignature } from "./normalize-ship";

export async function computeShipSignatureClient(decodedShip: unknown): Promise<string> {
  const normalized = normalizeForSignature(decodedShip);
  const json = JSON.stringify(normalized);
  const encoded = new TextEncoder().encode(json);
  if (!crypto?.subtle?.digest) {
    throw new Error("crypto.subtle not available (non-HTTPS or insecure context)");
  }
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray).map((b) => b.toString(16).padStart(2, "0")).join("");
}
