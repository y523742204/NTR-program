import Taro from '@tarojs/taro';

import { getAuthToken } from './auth-session';

export const API_BASE_URL = (process.env.NTR_API_BASE_URL || 'http://127.0.0.1:3100').replace(
  /\/$/,
  '',
);

interface ApiErrorBody {
  message?: string | string[];
}

function getApiErrorMessage(body: unknown): string {
  if (!body || typeof body !== 'object') return '服务暂时不可用';
  const rawMessage = (body as ApiErrorBody).message;
  return (Array.isArray(rawMessage) ? rawMessage[0] : rawMessage) || '服务暂时不可用';
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
  }
}

export async function apiRequest<T>(options: {
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data?: unknown;
  timeout?: number;
}): Promise<T> {
  const token = getAuthToken();
  const response = await Taro.request<T | ApiErrorBody>({
    url: `${API_BASE_URL}${options.path}`,
    method: options.method ?? 'GET',
    data: options.data,
    timeout: options.timeout,
    header: {
      'content-type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new ApiError(getApiErrorMessage(response.data), response.statusCode);
  }

  return response.data as T;
}

export async function apiUploadFile<T>(options: { path: string; filePath: string }): Promise<T> {
  const token = getAuthToken();
  const response = await Taro.uploadFile({
    url: `${API_BASE_URL}${options.path}`,
    filePath: options.filePath,
    name: 'file',
    header: token ? { Authorization: `Bearer ${token}` } : {},
  });
  let body: unknown;
  try {
    body = JSON.parse(response.data) as unknown;
  } catch {
    throw new ApiError('服务返回了无法识别的数据', response.statusCode);
  }
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new ApiError(getApiErrorMessage(body), response.statusCode);
  }
  return body as T;
}

export function resolveApiAssetUrl(path?: string | null): string {
  if (!path) return '';
  if (/^(?:https?:|wxfile:|blob:|data:)/.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}
