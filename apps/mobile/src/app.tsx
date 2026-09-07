import Taro from '@tarojs/taro';
import type { AuthSessionResponse } from '@ntr/shared';
import type { PropsWithChildren } from 'react';

import { API_BASE_URL } from './services/api';
import { saveAuthSession } from './services/auth-session';
import '@taroify/icons/index.css';
import './app.scss';

interface DevSwitchAccountInput {
  userId?: string;
  phone?: string;
  name?: string;
  role?: string;
}

type DevSwitchAccount = (data: DevSwitchAccountInput, page?: string) => void;

declare const wx: { switchAccount?: DevSwitchAccount } | undefined;

function defineDevSwitchAccount() {
  if (process.env.NODE_ENV === 'production' && process.env.TARO_APP_ENABLE_DEV_LOGIN !== '1') {
    return;
  }
  const switchAccount: DevSwitchAccount = (data, page = '/pages/profile/index') => {
    void Taro.request({
      url: `${API_BASE_URL}/auth/dev-login`,
      method: 'POST',
      data,
      success(res) {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          console.error('切换失败', res.statusCode, res.data);
          return;
        }
        saveAuthSession(res.data as AuthSessionResponse);
        void Taro.reLaunch({ url: page });
      },
      fail(err) {
        console.error('切换失败', err.errMsg);
      },
    });
  };
  const devGlobal = globalThis as typeof globalThis & {
    switchAccount?: DevSwitchAccount;
  };
  devGlobal.switchAccount = switchAccount;
  if (typeof wx !== 'undefined') {
    try {
      wx.switchAccount = switchAccount;
    } catch {
      // 部分宿主环境不允许扩展 wx，保留 globalThis 挂载即可。
    }
  }
}

defineDevSwitchAccount();

function App({ children }: PropsWithChildren) {
  return children;
}

export default App;
