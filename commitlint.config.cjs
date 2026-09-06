module.exports = {
  extends: ['@commitlint/config-conventional'],
  prompt: {
    scopes: [
      { name: 'mobile', value: 'mobile' },
      { name: 'api', value: 'api' },
      { name: 'shared', value: 'shared' },
      { name: 'config', value: 'config' },
      { name: 'deps', value: 'deps' },
      { name: 'repo', value: 'repo' },
      { name: 'docs', value: 'docs' },
    ],
    customScopesAlign: 'bottom',
    allowCustomScopes: true,
    allowEmptyScopes: true,
  },
};
