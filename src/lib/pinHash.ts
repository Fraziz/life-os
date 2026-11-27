export async function hashLocalPin(pin: string, existingSalt?: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const salt =
      existingSalt ||
      Array.from(window.crypto.getRandomValues(new Uint8Array(8)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    const bytes = new TextEncoder().encode(`${salt}:${pin}`);
    const digest = await window.crypto.subtle.digest('SHA-256', bytes);
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `sha256:${salt}:${hex}`;
  }
  return pin;
}

export async function verifyLocalPin(pin: string, stored: string): Promise<boolean> {
  if (stored.startsWith('sha256:')) {
    const parts = stored.split(':');
    if (parts.length !== 3) return false;
    const expected = await hashLocalPin(pin, parts[1]);
    return expected === stored;
  }
  return stored === pin;
}
