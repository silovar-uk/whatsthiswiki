// Some browser/OS combinations can stall while creating a compressed share URL.
// Keep game startup reliable by forcing the existing plain-JSON fallback path.
try {
  if ('CompressionStream' in globalThis) {
    Object.defineProperty(globalThis, 'CompressionStream', {
      value: undefined,
      configurable: true,
      writable: true
    });
  }
} catch {
  try {
    globalThis.CompressionStream = undefined;
  } catch {
    // The app still has its own compression fallback.
  }
}
