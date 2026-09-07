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
    navigationBarBackgroundColor: '#F2F8F4',
    navigationBarTitleText: 'NTR',
    navigationBarTextStyle: 'black',
  },
  tabBar: {
    custom: isWeapp,
    color: '#8FA89B',
    selectedColor: '#2FBF7F',
    backgroundColor: '#FFFFFF',
    borderStyle: 'white',
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
