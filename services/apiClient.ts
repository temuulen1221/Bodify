export type ApiErrorCode = 'HTTP_ERROR' | 'TIMEOUT' | 'NETWORK';

export type ApiRequestOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  retryStatuses?: number[];
};

export type ApiSuccess<T> = {
  ok: true;
  data: T;
  status: number;
};

export type ApiFailure = {
  ok: false;
  status?: number;
  code: ApiErrorCode;
  message: string;
  url?: string;
  body?: unknown;
};

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_RETRY_STATUSES = [429, 500, 502, 503, 504];

function appendQuery(url: string, query?: ApiRequestOptions['query']): string {
  if (!query) return url;
  const pairs = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  if (!pairs.length) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${pairs.join('&')}`;
}

function parseBody(body: unknown, headers?: Record<string, string>) {
  if (body === undefined || body === null) return undefined;
  const contentType = headers?.['Content-Type'] || headers?.['content-type'];
  if (typeof body === 'string' || body instanceof String) {
    return { payload: body as string, headers };
  }
  const json = JSON.stringify(body);
  const nextHeaders = {
    ...headers,
    'Content-Type': contentType ?? 'application/json',
  } as Record<string, string>;
  return { payload: json, headers: nextHeaders };
}

async function readResponseBody(res: Response): Promise<unknown> {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json().catch(() => undefined);
  }
  return res.text().catch(() => undefined);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function apiRequest<T>(
  url: string,
  opts: ApiRequestOptions = {}
): Promise<ApiResult<T>> {
  const {
    method = 'GET',
    headers,
    body,
    query,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = 0,
    retryDelayMs = 500,
    retryStatuses = DEFAULT_RETRY_STATUSES,
  } = opts;

  const targetUrl = appendQuery(url, query);
  const parsedBody = parseBody(body, headers);

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(targetUrl, {
        method,
        headers: parsedBody?.headers ?? headers,
        body: parsedBody?.payload,
        signal: controller.signal,
      });
      clearTimeout(timer);

      const payload = await readResponseBody(res);
      if (!res.ok) {
        if (attempt < retries && retryStatuses.includes(res.status)) {
          attempt += 1;
          await delay(retryDelayMs * attempt);
          continue;
        }
        return {
          ok: false,
          status: res.status,
          code: 'HTTP_ERROR',
          message: `Request failed with status ${res.status}`,
          url: targetUrl,
          body: payload,
        };
      }

      return {
        ok: true,
        data: payload as T,
        status: res.status,
      };
    } catch (error) {
      clearTimeout(timer);
      if ((error as Error)?.name === 'AbortError') {
        if (attempt < retries) {
          attempt += 1;
          await delay(retryDelayMs * attempt);
          continue;
        }
        return {
          ok: false,
          code: 'TIMEOUT',
          message: 'Request timed out',
          url: targetUrl,
        };
      }

      if (attempt < retries) {
        attempt += 1;
        await delay(retryDelayMs * attempt);
        continue;
      }

      return {
        ok: false,
        code: 'NETWORK',
        message: (error as Error)?.message || 'Network error',
        url: targetUrl,
      };
    }
  }
}
