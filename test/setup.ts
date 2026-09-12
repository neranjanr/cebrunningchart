import '@testing-library/jest-dom/vitest';

// Mock fetch for API routes - tests use localStorage fallback
const originalFetch = global.fetch;
global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith('/api/')) {
    // Return 401 immediately so stores fall back to localStorage
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  return originalFetch(input, init);
};
