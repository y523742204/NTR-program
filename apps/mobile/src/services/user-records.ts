import Taro from '@tarojs/taro';

/** 打开指定用户的战绩页。 */
export function openUserRecords(userId: string): void {
  void Taro.navigateTo({ url: `/pages/my-matches/index?userId=${encodeURIComponent(userId)}` });
}
