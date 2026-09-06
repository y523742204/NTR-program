const isWeapp = process.env.TARO_ENV === 'weapp';

export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/activity-detail/index',
    'pages/my-matches/index',
    'pages/signup-records/index',
    'pages/profile/index',
    'pages/login/index',
    'pages/agreement/index',
    'pages/profile-detail/index',
    'pages/activity-create/index',
    'pages/activity-manage/index',
    'pages/admin-users/index',
  ],
  lazyCodeLoading: 'requiredComponents',
  ...(isWeapp ? { componentFramework: 'glass-easel' as const } : {}),
  window: {
    backgroundTextStyle: 'dark',
    navigationBarBackgroundColor: '#0A0F0D',
    navigationBarTitleText: 'NTR',
    navigationBarTextStyle: 'white',
  },
  tabBar: {
    custom: isWeapp,
    color: '#68857A',
    selectedColor: '#35E69C',
    backgroundColor: '#0A0F0D',
    borderStyle: 'black',
    list: [
      { pagePath: 'pages/index/index', text: '赛事' },
      { pagePath: 'pages/profile/index', text: '我的' },
    ],
  },
  permission: {
    'scope.userLocation': {
      desc: '用于选择活动地点',
    },
  },
  requiredPrivateInfos: ['chooseLocation'],
});
