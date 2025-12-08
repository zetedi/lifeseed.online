export async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export async function createBlock(
  previousHash: string,
  data: object,
  timestamp: number
): Promise<string> {
  const payload = JSON.stringify(data) + previousHash + timestamp;
  return await sha256(payload);
}