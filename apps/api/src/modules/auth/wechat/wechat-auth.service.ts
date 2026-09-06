import { BadGatewayException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface WechatErrorResponse {
  errcode?: number;
  errmsg?: string;
}

interface CodeSessionResponse extends WechatErrorResponse {
  openid?: string;
  session_key?: string;
}

interface AccessTokenResponse extends WechatErrorResponse {
  access_token?: string;
  expires_in?: number;
}

interface PhoneResponse extends WechatErrorResponse {
  phone_info?: { phoneNumber?: string };
}

const ACCESS_TOKEN_REFRESH_BUFFER_SECONDS = 300;

@Injectable()
export class WechatAuthService {
  private accessTokenCache?: { value: string; expiresAt: number };
  private accessTokenRequest?: Promise<string>;

  constructor(private readonly config: ConfigService) {}

  /** 使用一次性登录凭证换取 openid 与会话密钥。 */
  async exchangeLoginCodeWithSessionKey(
    loginCode: string,
  ): Promise<{ openId: string; sessionKey: string }> {
    const result = await this.requestCodeSession(loginCode);
    if (result.errcode || !result.openid || !result.session_key) {
      throw this.invalidLoginCodeError(result);
    }
    return { openId: result.openid, sessionKey: result.session_key };
  }

  /** 携带微信原始错误码，便于区分 code 无效(40029)与已被使用(40163)等场景。 */
  private invalidLoginCodeError(result: CodeSessionResponse): UnauthorizedException {
    const detail = result.errcode
      ? `（微信错误码 ${result.errcode}${result.errmsg ? `: ${result.errmsg}` : ''}）`
      : '';
    return new UnauthorizedException(`微信登录凭证无效或已过期${detail}`);
  }

  /** 使用手机号动态凭证从微信服务端换取已验证手机号。 */
  async exchangePhoneCode(phoneCode: string): Promise<string> {
    const accessToken = await this.getAccessToken();
    const url = new URL('https://api.weixin.qq.com/wxa/business/getuserphonenumber');
    url.searchParams.set('access_token', accessToken);
    const result = await this.requestJson<PhoneResponse>(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: phoneCode }),
    });
    const phone = result.phone_info?.phoneNumber;
    if (result.errcode || !phone) {
      throw new UnauthorizedException('手机号授权凭证无效或已过期');
    }
    return phone;
  }

  /** 复用有效的稳定版接口令牌，并合并并发刷新请求。 */
  async getAccessToken(forceRefresh = false): Promise<string> {
    if (forceRefresh) this.accessTokenCache = undefined;
    if (this.accessTokenCache && this.accessTokenCache.expiresAt > Date.now()) {
      return this.accessTokenCache.value;
    }
    if (this.accessTokenRequest) return this.accessTokenRequest;

    const request = this.refreshAccessToken();
    this.accessTokenRequest = request;
    try {
      return await request;
    } finally {
      if (this.accessTokenRequest === request) this.accessTokenRequest = undefined;
    }
  }

  /** 从微信获取稳定版接口令牌，并提前五分钟失效本地缓存。 */
  private async refreshAccessToken(): Promise<string> {
    const result = await this.requestJson<AccessTokenResponse>(
      new URL('https://api.weixin.qq.com/cgi-bin/stable_token'),
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'client_credential',
          appid: this.getAppId(),
          secret: this.getAppSecret(),
          force_refresh: false,
        }),
      },
    );
    if (result.errcode || !result.access_token || !result.expires_in) {
      throw new BadGatewayException('暂时无法连接微信授权服务');
    }
    const lifetime = Math.max(
      result.expires_in - ACCESS_TOKEN_REFRESH_BUFFER_SECONDS,
      ACCESS_TOKEN_REFRESH_BUFFER_SECONDS,
    );
    this.accessTokenCache = {
      value: result.access_token,
      expiresAt: Date.now() + lifetime * 1000,
    };
    return result.access_token;
  }

  /** 统一处理微信网络异常，避免向客户端泄漏上游响应细节。 */
  private async requestJson<T>(url: URL, init: RequestInit): Promise<T> {
    try {
      const response = await fetch(url, init);
      if (!response.ok) throw new Error(`Wechat HTTP ${response.status}`);
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof BadGatewayException)
        throw error;
      throw new BadGatewayException('暂时无法连接微信授权服务');
    }
  }

  private async requestCodeSession(loginCode: string): Promise<CodeSessionResponse> {
    const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
    url.search = new URLSearchParams({
      appid: this.getAppId(),
      secret: this.getAppSecret(),
      js_code: loginCode,
      grant_type: 'authorization_code',
    }).toString();
    return this.requestJson<CodeSessionResponse>(url, { method: 'GET' });
  }

  private getAppId(): string {
    return this.config.getOrThrow<string>('WECHAT_APP_ID');
  }

  private getAppSecret(): string {
    return this.config.getOrThrow<string>('WECHAT_APP_SECRET');
  }
}
