import { defineConfig, type UserConfigExport } from '@tarojs/cli';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const taroEnv = process.env.TARO_ENV ?? 'weapp';
const mobileVersion = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8')) as {
  version: string;
};
const appVersion = mobileVersion.version;
const tdesignRoot = resolve(__dirname, '../node_modules/tdesign-miniprogram/miniprogram_dist');
const miniprogramNpmRoot = resolve(__dirname, `../dist/${taroEnv}/miniprogram_npm`);
const rootTdesignDirectories = [
  'badge',
  'cell',
  'common',
  'icon',
  'image',
  'loading',
  'mixins',
  'overlay',
  'stepper',
  'sticky',
  'tab-bar',
  'tab-bar-item',
  'tab-panel',
  'tabs',
  'toast',
];

function getTdesignCopyPatterns(outputRoot: string, directories: string[]) {
  return [
    ...directories.map((directory) => ({
      from: resolve(tdesignRoot, directory),
      to: resolve(outputRoot, `tdesign-miniprogram/${directory}`),
    })),
    {
      from: resolve(tdesignRoot, 'miniprogram_npm/tslib'),
      to: resolve(outputRoot, 'tslib'),
    },
  ];
}

const config: UserConfigExport = {
  projectName: 'ntr-mobile',
  date: '2026-07-02',
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2,
  },
  sourceRoot: 'src',
  outputRoot: `dist/${taroEnv}`,
  copy: {
    patterns:
      taroEnv === 'weapp' ? getTdesignCopyPatterns(miniprogramNpmRoot, rootTdesignDirectories) : [],
    options: {},
  },
  framework: 'react',
  defineConstants: {
    'process.env.NTR_API_BASE_URL': JSON.stringify(
      process.env.NTR_API_BASE_URL || 'http://127.0.0.1:3100',
    ),
    'process.env.TARO_APP_ENABLE_DEV_LOGIN': JSON.stringify(
      process.env.TARO_APP_ENABLE_DEV_LOGIN === '1' || process.env.NODE_ENV !== 'production'
        ? '1'
        : '',
    ),
    'process.env.TARO_APP_VERSION': JSON.stringify(appVersion),
  },
  compiler: {
    type: 'webpack5',
    prebundle: {
      enable: false,
    },
  },
  cache: {
    enable: false,
  },
  mini: {
    postcss: {
      pxtransform: {
        enable: true,
        config: {},
      },
      cssModules: {
        enable: false,
        config: {
          namingPattern: 'module',
          generateScopedName: '[name]__[local]___[hash:base64:5]',
        },
      },
    },
  },
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
    output: {
      filename: 'js/[name].[hash:8].js',
      chunkFilename: 'js/[name].[chunkhash:8].js',
    },
    miniCssExtractPluginOption: {
      ignoreOrder: true,
      filename: 'css/[name].[hash].css',
      chunkFilename: 'css/[name].[chunkhash].css',
    },
  },
};

export default defineConfig<'webpack5'>(() => config);
