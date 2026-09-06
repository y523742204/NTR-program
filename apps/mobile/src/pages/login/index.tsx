import Taro from '@tarojs/taro';
import { Button, Text, View } from '@tarojs/components';
import { useState } from 'react';
import type { AuthSessionResponse } from '@ntr/shared';

import { apiRequest } from '../../services/api';
import { saveAuthSession } from '../../services/auth-session';
import { getCurrentRedirectRoute, getProfileOnboardingUrl } from '../../services/redirect-route';
import { isHomeTabRoute, switchHomeTab } from '../../services/tab-navigation';

import './index.scss';

export default function LoginPage() {
  const [agreed, setAgreed] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function loginWithPhone(e: { detail: { errMsg: string; code?: string } }) {
    const { errMsg, code } = e.detail;
    if (errMsg !== 'ok') {
      if (errMsg.includes('fail')) void Taro.showToast({ title: '请重试获取手机号', icon: 'none' });
      return;
    }
    if (!agreed) {
      void Taro.showToast({ title: '请先同意用户协议与隐私政策', icon: 'none' });
      return;
    }
    setSubmitting(true);
    try {
      const loginCode = (await Taro.login()).code;
      const res = await apiRequest<AuthSessionResponse>({
        path: '/auth/wechat-phone-login',
        method: 'POST',
        data: { loginCode, phoneCode: code },
      });
      saveAuthSession(res);
      const redirect = getCurrentRedirectRoute() || '/pages/index/index';
      if (res.user.profileCompleted === false) {
        void Taro.reLaunch({ url: getProfileOnboardingUrl(redirect) });
        return;
      }
      if (isHomeTabRoute(redirect)) {
        void switchHomeTab(redirect);
        return;
      }
      if (getCurrentRedirectRoute()) {
        void Taro.redirectTo({ url: redirect });
        return;
      }
      void Taro.reLaunch({ url: redirect });
    } catch (err) {
      void Taro.showToast({
        title: (err as { message?: string }).message ?? '登录失败',
        icon: 'none',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View className="ntr-page login-page">
      <View className="login-brand">
        <Text className="login-brand__ntr">NTR</Text>
        <View className="login-brand__tagline">单打网球赛事平台</View>
      </View>

      <View className="login-agreement" onClick={() => setAgreed((v) => !v)}>
        <View
          className={`login-agreement__checkbox ${agreed ? 'login-agreement__checkbox--checked' : ''}`}
        />
        <Text>
          我已阅读并同意
          <Text
            className="login-agreement__link"
            onClick={(e) => {
              e.stopPropagation();
              void Taro.navigateTo({ url: '/pages/agreement/index?type=user' });
            }}
          >
            《用户协议》
          </Text>
          <Text className="login-agreement__sep">|</Text>
          <Text
            className="login-agreement__link"
            onClick={(e) => {
              e.stopPropagation();
              void Taro.navigateTo({ url: '/pages/agreement/index?type=privacy' });
            }}
          >
            《隐私政策》
          </Text>
        </Text>
      </View>

      <Button
        className="ntr-btn ntr-btn--primary login-btn"
        openType="getPhoneNumber"
        disabled={submitting}
        onGetPhoneNumber={(event) => void loginWithPhone(event)}
      >
        微信手机号登录
      </Button>
    </View>
  );
}
