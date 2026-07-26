// Keep game startup reliable across browsers.
// 1. Force the existing plain-JSON fallback instead of waiting on CompressionStream.
// 2. Do not write the long challenge payload into the address bar during local play.
//    The generated share URL remains available through the share buttons.
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

try {
  const nativeReplaceState = history.replaceState.bind(history);
  history.replaceState = (state, title, url) => {
    const nextUrl = typeof url === 'string' ? url : url?.toString?.();
    if (nextUrl?.startsWith('#challenge=')) {
      return nativeReplaceState(state, title, `${location.pathname}${location.search}`);
    }
    return nativeReplaceState(state, title, url);
  };
} catch {
  // Continue with the browser's native history implementation.
}
