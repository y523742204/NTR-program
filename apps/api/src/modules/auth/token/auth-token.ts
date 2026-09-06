import { createHash, randomBytes } from 'node:crypto';

/** 创建只返回一次给客户端的高熵不透明会话令牌。 */
export function createSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/** 单向散列令牌，避免数据库泄漏后直接暴露有效登录态。 */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** 从标准 Bearer 请求头提取不透明令牌。 */
export function parseBearerToken(authorization?: string): string | null {
  const match = authorization?.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
}
