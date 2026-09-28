import { ApiErrorBody } from '../types';

const DEFAULT_API_BASE_URL = 'http://localhost:3000';

let apiBaseUrl = import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: ApiErrorBody,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function configureApi(baseUrl: string): void {
  apiBaseUrl = baseUrl.replace(/\/$/, '');
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...init?.headers,
    },
  });

  const body = await readJson(response);

  if (!response.ok) {
    const errorBody = body as ApiErrorBody | undefined;
    const message = Array.isArray(errorBody?.message)
      ? errorBody.message.join(', ')
      : errorBody?.message ?? `API request failed with status ${response.status}`;

    throw new ApiError(response.status, message, errorBody);
  }

  return body as T;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError(response.status, 'The server returned an invalid JSON response.');
  }
}
