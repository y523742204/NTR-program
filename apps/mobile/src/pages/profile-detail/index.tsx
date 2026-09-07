import Taro from '@tarojs/taro';
import { Button, Image, Input, Text, View } from '@tarojs/components';
import { useState } from 'react';
import {
  PLAYER_LEVELS,
  type AuthUserResponse,
  type AvatarUploadResponse,
  type PlayerLevel,
} from '@ntr/shared';

import { apiRequest, apiUploadFile, resolveApiAssetUrl } from '../../services/api';
import { getAuthSession, saveAuthUser } from '../../services/auth-session';
import { getCurrentRedirectRoute, isProfileOnboarding } from '../../services/redirect-route';

import './index.scss';

type Gender = 'MALE' | 'FEMALE';

export default function ProfileDetailPage() {
  const [user] = useState(() => getAuthSession()?.user ?? null);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '');
  const [name, setName] = useState(user?.name ?? '');
  const [gender, setGender] = useState<Gender | null>(user?.gender ?? null);
  const [level, setLevel] = useState<PlayerLevel | null>(user?.level ?? null);
  const [saving, setSaving] = useState(false);

  async function chooseAvatar() {
    try {
      const res = await Taro.chooseImage({ count: 1, sizeType: ['compressed'] });
      const filePath = res.tempFilePaths[0];
      if (!filePath) return;
      const data = await apiUploadFile<AvatarUploadResponse>({ path: '/auth/avatar', filePath });
      setAvatarUrl(data.avatarUrl);
    } catch (err) {
      void Taro.showToast({
        title: (err as { message?: string }).message ?? '头像上传失败',
        icon: 'none',
      });
    }
  }

  async function save() {
    if (!name.trim()) {
      void Taro.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }
    setSaving(true);
    try {
      const user = await apiRequest<AuthUserResponse>({
        path: '/auth/me',
        method: 'PATCH',
        data: { name: name.trim(), gender, level, avatarUrl: avatarUrl || null },
      });
      saveAuthUser(user);
      void Taro.showToast({ title: '保存成功', icon: 'success' });
      if (isProfileOnboarding()) {
        void Taro.reLaunch({ url: getCurrentRedirectRoute() || '/pages/index/index' });
      } else {
        void Taro.navigateBack();
      }
    } catch (err) {
      void Taro.showToast({
        title: (err as { message?: string }).message ?? '保存失败',
        icon: 'none',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="ntr-page profile-detail">
      <View className="ntr-card ntr-card--padded">
        <View className="ntr-field">
          <View className="ntr-field__label">头像</View>
          <View className="profile-detail-avatar-wrap" onClick={() => void chooseAvatar()}>
            <View className="ntr-avatar profile-detail-avatar">
              {avatarUrl ? (
                <Image src={resolveApiAssetUrl(avatarUrl)} mode="aspectFill" />
              ) : (
                <Text>{name ? name.slice(0, 1) : '?'}</Text>
              )}
            </View>
            <Text className="profile-detail-avatar__hint">点击选择头像</Text>
          </View>
        </View>

        <View className="ntr-field">
          <View className="ntr-field__label">昵称</View>
          <Input
            className="ntr-input"
            placeholder="请输入昵称"
            placeholderClass="ntr-input__placeholder"
            value={name}
            maxlength={20}
            onInput={(e) => setName(e.detail.value)}
          />
        </View>

        <View className="ntr-field">
          <View className="ntr-field__label">性别</View>
          <View className="ntr-seg">
            <View
              className={`ntr-seg__item ${gender === 'MALE' ? 'ntr-seg__item--active' : ''}`}
              onClick={() => setGender('MALE')}
            >
              男
            </View>
            <View
              className={`ntr-seg__item ${gender === 'FEMALE' ? 'ntr-seg__item--active' : ''}`}
              onClick={() => setGender('FEMALE')}
            >
              女
            </View>
          </View>
        </View>

        <View className="ntr-field">
          <View className="ntr-field__label">等级</View>
          <View className="profile-detail-levels">
            {PLAYER_LEVELS.map((item) => (
              <View
                key={item}
                className={`profile-detail-level ${level === item ? 'profile-detail-level--active' : ''}`}
                onClick={() => setLevel(level === item ? null : item)}
              >
                {item}
              </View>
            ))}
          </View>
        </View>
      </View>

      <Button
        className="ntr-btn ntr-btn--primary profile-detail-save"
        disabled={saving}
        onClick={() => void save()}
      >
        保存
      </Button>
    </View>
  );
}
