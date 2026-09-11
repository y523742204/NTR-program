# NTR 小程序 UI 设计规范

本文件是小程序端（`apps/mobile`）唯一的设计事实来源。所有页面、组件与新增样式必须遵循本规范；设计令牌定义在 `apps/mobile/src/app.scss` 的 `page { --ntr-* }`，JS 侧颜色常量定义在 `apps/mobile/src/constants/theme.ts`。

## 一、设计原则

1. **单一光源**：所有阴影都由顶部向下投射，禁止多方向、彩色阴影。
2. **高对比中性底 + 清新绿主色**：中性表面承载内容，绿色只用于主操作、选中态与正反馈。
3. **块面而非胶囊**：圆角克制，卡片用大圆角，控件用小圆角；标签为小方块，不使用全圆胶囊。
4. **层级靠留白与阴影，不靠边框堆叠**：优先使用间距、背景层次区分区块。
5. **触手可及**：可点击区域不小于 88rpx 高；次要操作用文字按钮。
6. **状态可辨**：主 / 危险 / 警示 / 次要 状态必须有稳定且唯一的颜色语义。

## 二、颜色令牌

| 令牌                | 值                     | 用途                           |
| ------------------- | ---------------------- | ------------------------------ |
| `--ntr-bg`          | `#f4f5f7`              | 页面底色                       |
| `--ntr-surface`     | `#ffffff`              | 卡片 / 输入 / 主表面           |
| `--ntr-surface-2`   | `#eef0f2`              | 次级表面（分段控件底、头像底） |
| `--ntr-surface-3`   | `#e4e7ea`              | 三级表面（滑轨背景）           |
| `--ntr-line`        | `#e3e6ea`              | 分割线、边框                   |
| `--ntr-primary`     | `#1f9d66`              | 主色：主按钮、选中态、正反馈   |
| `--ntr-primary-hi`  | `#178a58`              | 主色加深（渐变、强调文字）     |
| `--ntr-primary-dim` | `rgba(31,157,102,0.1)` | 主色淡化底                     |
| `--ntr-accent`      | `#178a58`              | 强调色（与 primary-hi 一致）   |
| `--ntr-danger`      | `#e5484d`              | 危险 / 删除 / 失败             |
| `--ntr-warn`        | `#d97706`              | 警示 / 待处理                  |
| `--ntr-text`        | `#16181d`              | 主文本                         |
| `--ntr-text-2`      | `#3f4650`              | 次文本                         |
| `--ntr-text-3`      | `#626a75`              | 辅助 / 占位文本                |

> 语义色禁止散落硬编码。组件属性（`confirmColor`、`Switch.color`、`Slider.activeColor` 等）必须引用 `THEME_COLOR.PRIMARY / DANGER / SURFACE_3`；修改令牌时两者必须同步。

## 三、字体

- 字体族：`-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif`。
- 基础字号 `28px`，基础行高 `1.5`。
- 字号阶梯（rpx）：`20 / 22 / 24 / 26 / 28 / 30 / 32 / 34 / 36 / 44 / 80`。
  - 说明文字 / 标签：22–24
  - 正文 / 表单项：26–30
  - 小标题：30–32（字重 700）
  - 卡片标题 / 大标题：34–36（字重 800）
  - 数据强调 / 空状态图标：44 / 80
- 数字一律加 `font-variant-numeric: tabular-nums`（或用 `.ntr-num`），避免跳动。

## 四、间距、圆角与阴影

- 间距阶梯（rpx）：`8 / 12 / 16 / 20 / 24 / 28 / 32 / 40 / 48`。
- 页面内边距：`24rpx`；区块间距 `.ntr-section` 为 `24rpx`；卡片内边距 `.ntr-card--padded` 为 `24rpx`。
- 圆角：`--ntr-radius-sm 12` / `--ntr-radius-md 18` / `--ntr-radius-lg 24` / `--ntr-radius-max 999`。卡片用 `lg`，按钮 / 输入用 `md`，标签用 `8`。
- 阴影：
  - `--ntr-shadow-sm`：小控件、选中态
  - `--ntr-shadow-card`：卡片
  - `--ntr-shadow-float`：浮层
  - `--ntr-shadow-primary`：主按钮

## 五、组件规范

| 类名                                                                | 说明                                                                   |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `.ntr-page`                                                         | 页面容器，含安全区底部留白                                             |
| `.ntr-card` / `.ntr-card--padded`                                   | 卡片 / 带内边距卡片                                                    |
| `.ntr-section` / `.ntr-section-title`                               | 区块与标题（标题带主色渐变竖条）                                       |
| `.ntr-btn` + `--primary` `--ghost` `--danger` `--sm`                | 按钮：高度 88rpx，主按钮用主色渐变 + 主色阴影                          |
| `.ntr-tag` + `--primary` `--accent` `--muted` `--danger` `--warn`   | 小方块标签，圆角 8rpx                                                  |
| `.ntr-seg` / `.ntr-seg__item--active`                               | 分段控件，选中项为白底 + 轻阴影                                        |
| `.ntr-field` / `.ntr-field__label` / `.ntr-input` / `.ntr-textarea` | 表单                                                                   |
| `.ntr-row`                                                          | 列表行                                                                 |
| `.ntr-avatar`                                                       | 头像（88rpx 圆形，图片 `aspectFill`）                                  |
| `.ntr-empty`                                                        | 空状态 / 加载态                                                        |
| `.ntr-hover` / `.ntr-hover-fade`                                    | 按压反馈：位移 + 阴影，不用纯透明度                                    |
| `UserAvatar`（`components/user-avatar`）                            | 统一头像组件：有图显图、无图显首字，带 `userId` 时点击进入该用户战绩页 |

规则：

- 图标优先使用 TDesign（`@taroify/icons`）；仅在 TDesign 无对应能力时才使用其他方案。
- 组件属性中的颜色必须引用 `THEME_COLOR`，禁止写死十六进制。
- 弹窗确认按钮：主操作 `THEME_COLOR.PRIMARY`，危险操作 `THEME_COLOR.DANGER`。

## 六、交互与性能

- 弹窗使用 `Taro.showModal`；确认色遵循本文语义色。
- 轻反馈使用 `Taro.showToast`，成功 `icon: 'success'`，其余 `icon: 'none'`。
- Tab / 筛选切换不得重复请求相同数据，需按数据新鲜度缓存并合并并发请求；写操作后定向刷新或失效缓存。
- 有界重型内容（赛局、头像列表、复杂表单）首屏后延迟预渲染，切换用显示状态而非反复卸载重建，并保持稳定 `key`。
- 数据无界时必须分页或虚拟列表。
- `useEffect` 依赖必须稳定；Hook 返回的回调需 `useCallback` 包裹，避免编辑态被反复回填。

## 七、自检清单

- [ ] 未新增硬编码颜色，颜色均来自令牌或 `THEME_COLOR`
- [ ] 使用既有 `.ntr-*` 组件类，未重复造轮子
- [ ] 图标优先 TDesign
- [ ] 字号、间距、圆角取自本文阶梯
- [ ] 可点击区域充足，按压有反馈
- [ ] Tab / 筛选无重复请求与重复挂载
- [ ] 新增头像统一使用 `UserAvatar`，用户头像可点击进入战绩页
