import Taro from '@tarojs/taro';
import { ScrollView, Text, View } from '@tarojs/components';
import { useEffect } from 'react';

import './index.scss';

const USER_PARAGRAPHS = [
  '1. 账号与报名：您需要使用真实有效的信息完成注册与登录，并妥善保管登录凭证。报名赛事时请如实填写个人信息，因信息不实导致的报名失效或入场受阻由您自行承担。',
  '2. 赛事规则：报名即视为您已阅读并同意所报名赛事的竞赛规程与赛程安排。组委会有权依据天气、场地等客观因素合理调整赛程与对阵，并将在赛事相关页面及时公告。',
  '3. 取消报名：在报名截止时间前，您可以自行取消报名。候补名单中的选手在获得参赛资格时，系统将通过消息通知您，请您留意并及时确认。',
  '4. 参赛资格：报名提交成功后，以最终确认名单为准。存在身份冒用、违规重复报名等行为时，组委会有权取消相应参赛资格。',
  '5. 平台仅提供赛事组织与信息发布的便捷渠道，实际赛事服务由承办方负责，双方的权利义务以各赛事单独发布的规则为准。',
];

const PRIVACY_PARAGRAPHS = [
  '1. 信息收集范围：为完成账号登录与赛事报名，我们会收集您的手机号、昵称、性别及头像信息。这些信息仅在为您提供服务所必需的范围内进行收集。',
  '2. 信息使用用途：我们使用您的个人信息用于身份认证、报名参赛、赛程通知以及保障平台安全运行。我们不会将您的个人信息用于与提供服务无关的用途。',
  '3. 信息存储：我们将在中华人民共和国境内存储您的个人信息，并采取合理的安全保护措施防止信息泄露、篡改或丢失。',
  '4. 信息共享：除法律法规规定或取得您单独同意外，我们不会向第三方提供您的个人信息。赛事承办方仅在组织赛事所必需的最小范围内获取相关报名信息。',
  '5. 您的权利：您有权查询、更正或删除您的个人信息，也可以通过本页面底部的联系方式与我们取得联系，我们将在合理期限内响应您的请求。',
  '6. 联系方式：如对本隐私政策有任何疑问，您可以通过平台内的客服渠道或邮件与我们取得联系，我们将尽快给予答复。',
];

export default function AgreementPage() {
  const type = Taro.getCurrentInstance().router?.params?.type ?? 'user';
  const isPrivacy = type === 'privacy';
  const title = isPrivacy ? '隐私政策' : '用户协议';
  const paragraphs = isPrivacy ? PRIVACY_PARAGRAPHS : USER_PARAGRAPHS;

  useEffect(() => {
    void Taro.setNavigationBarTitle({ title });
  }, [title]);

  return (
    <ScrollView scrollY className="agreement-scroll">
      <View className="agreement-body">
        <Text className="agreement-body__title">{title}</Text>
        {paragraphs.map((paragraph, index) => (
          <View key={index} className="agreement-body__paragraph">
            {paragraph}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
