import { Image, Text, View } from '@tarojs/components';

import { resolveApiAssetUrl } from '../../services/api';
import { openUserRecords } from '../../services/user-records';

interface UserAvatarProps {
  userId?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  className?: string;
}

/** 统一头像：有头像显示图片，否则显示昵称首字；带 userId 时可点击进入战绩页。 */
export default function UserAvatar({ userId, name, avatarUrl, className }: UserAvatarProps) {
  const label = (name?.trim() || '?').slice(0, 1);
  return (
    <View
      className={`ntr-avatar${className ? ` ${className}` : ''}`}
      onClick={(event) => {
        if (!userId) return;
        event.stopPropagation();
        openUserRecords(userId);
      }}
    >
      {avatarUrl ? (
        <Image src={resolveApiAssetUrl(avatarUrl)} mode="aspectFill" />
      ) : (
        <Text>{label}</Text>
      )}
    </View>
  );
}
