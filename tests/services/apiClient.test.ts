import { apiRequest } from '../../services/apiClient';

describe('apiRequest', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('returns data on success', async () => {
    const payload = { hello: 'world' };
    global.fetch = jest.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    ) as unknown as typeof fetch;

    const result = await apiRequest<typeof payload>('https://example.com/test');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(payload);
      expect(result.status).toBe(200);
    }
  });

  it('returns structured error on HTTP failure', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve(
        new Response('oops', {
          status: 500,
          headers: { 'Content-Type': 'text/plain' },
        })
      )
    ) as unknown as typeof fetch;

    const result = await apiRequest('https://example.com/error');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.code).toBe('HTTP_ERROR');
      expect(result.message).toContain('500');
    }
  });

  it('retries and succeeds after transient failure', async () => {
    const responses = [
      new Response('service down', { status: 503 }),
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ];

    global.fetch = jest.fn(() => Promise.resolve(responses.shift()!)) as unknown as typeof fetch;

    const result = await apiRequest<{ ok: boolean }>('https://example.com/retry', {
      retries: 1,
      retryDelayMs: 0,
    });

    expect((global.fetch as jest.Mock).mock.calls.length).toBe(2);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ ok: true });
    }
  });

  it('times out and reports timeout code', async () => {
    jest.useFakeTimers();

    global.fetch = jest.fn((_, init) =>
      new Promise((_, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('Aborted');
          error.name = 'AbortError';
          reject(error);
        });
      })
    ) as unknown as typeof fetch;

    const promise = apiRequest('https://example.com/slow', { timeoutMs: 5, retries: 0 });

    jest.runOnlyPendingTimers();

    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('TIMEOUT');
    }
  });
});
