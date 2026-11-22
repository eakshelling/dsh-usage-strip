# 用量与费用（DSH 插件）

[English](README.en.md) · [MIT License](LICENSE) · [GitHub](https://github.com/eakshelling/dsh-usage-strip) · [Release](https://github.com/eakshelling/dsh-usage-strip/releases/latest)

在 DSH Web 输入框下方增加一条紧凑的用量条，默认显示 **`总价≈¥… 今日 … tok≈¥…`**：总价优先用输入框旁内置 `tokenUsage` 读数按当前峰谷价估算，日志精确值保留在面板中；今日是本对话今天（北京时间）的 token 数与费用。点击后弹出面板，可切换「本对话 / 全部会话」，提供参照 [DeepSeek 开放平台用量页](https://platform.deepseek.com/usage) 的内容：按天趋势、按模型拆分、缓存命中/未命中/输出构成、请求数，以及 token 价格变化（当前峰谷价、下次切换时间、官方调价时间线）。

本插件只读取本机 DSH 已持久化的会话日志，并写一份本地诊断日志；不联网、不需要登录、不上传数据。费用是按官方价目做的估算，不是官方账单，也与 DeepSeek 官方没有隶属关系。

## 功能

- **紧凑条**：选中会话时显示 `总价≈¥1.46 今日 23.4K tok≈¥0.03`，并带近 7 日迷你柱状图；每 30 秒自动刷新，页面重新可见时立即刷新。没有会话时仍显示全部会话的 `今日 …`。
- **详情面板**（点击紧凑条）：
  - 范围切换：本对话 / 全部会话；本对话默认「全部」，全部会话默认「近 7 天」；
  - 时间范围：今日 / 近 7 天 / 近 30 天 / 全部；
  - 本对话「全部」顶部并排两块：**现成读数**（内置 token 数 + 按当前峰谷价和模型占比估算的费用）与**日志精确**（逐条日志按事件时价计算的费用、请求数、缓存命中率，并附今日费用）；其他范围沿用日志口径；
  - KPI：估算费用、总 tokens、请求次数、token 加权缓存命中率；
  - Token 构成（缓存命中 / 未命中输入 / 输出）；
  - 每日用量堆叠图 + 费用/有效均价曲线（可切换；均价 = 每日费用 ÷ tokens × 100 万，随峰谷与调价变化）；
  - 按模型明细（请求、命中、未命中、输出、合计、费用、占比）；
  - 价格卡片：当前时段与下次切换、Flash / Pro 的谷时与峰时价、官方调价记录。
- 主题、语言跟随 DSH；无外部依赖、无构建步骤。

## 数据口径

| 项目 | 口径 |
|---|---|
| 数据来源 | 今日、分日/分模型明细和面板“日志精确”来自本机 DSH 已持久化会话日志中的 `assistant/message.usage`（provider 真实上报值）；紧凑条总价、面板「现成读数」取自 DSH 内置 `tokenUsage` projection（与输入框旁内置用量胶囊同源） |
| 范围 | 默认当前会话；面板可切换本机全部已保存会话（含子代理会话）；不含其他客户端、API Key 或网页端用量 |
| 日界 | 北京时间（UTC+8） |
| tokens | 紧凑条总价与面板现成读数使用内置 projection 的 `uncachedInputTokens` + `cacheReadTokens` + `cacheWriteTokens` + `outputTokens`（已含推理 token，不重复计）；今日与 7/30 天等范围按日志口径统计 |
| 今日 | 本对话今天（北京时间）的 `assistant/message.usage` 合计；跨日自动归零重计 |
| 总价/现成费用 | 内置 token 数 × 当前峰谷价与日志模型占比估算，不追溯历史调价；紧凑条显示 `≈`，日志精确值在面板第二块 |
| 精确费用 | 逐条日志按事件发生日的官方价目计价；不是官方账单 |
| 峰谷 | 工作日 9:00–12:00、14:00–18:00 为高峰（2 倍价）；2026-08-17 起生效，2026-08-23 起周末全天谷价，2026-09-19 起法定节假日全天谷价 |
| 分叉/重启 | 每次都从事件 0 读取，并跳过最后一个 `session/end-seed` 之前的继承前缀；`inheritedEventCount` 只记录到诊断日志，不作为起点，避免重启后跳过 seed |

## 安装

已发布到 npm：`npm install dsh-usage-strip`（或 `pnpm add dsh-usage-strip`）。也可以使用 [Release 附件](https://github.com/eakshelling/dsh-usage-strip/releases/latest/download/dsh-usage-strip.tgz)（`dsh-usage-strip.tgz`，版本 `1.3.2`），或下面的本地目录安装方式。插件市场条目待仓库满足收录条件后提交。

本地开发目录仍可直接安装，方式二选一：

1. 由 DSH 的插件管理安装本目录（`plugin_manager` 的 `install_bundle`，target 为本目录绝对路径），随后在 Plugins 中启用；
2. 在 **Plugins → Add plugin** 中选择本目录。

安装后刷新页面；若客户端 bundle 未加载，重启 DSH。插件行 id 为 `dsh-usage-strip`。

## 价格维护

价目与节假日清单在 [`pricing.js`](pricing.js)：

- `PRICE_VERSIONS`：按生效日排列的谷时价，峰时价自动 ×2；
- `PRICE_CHANGES`：面板展示的官方调价记录；
- `HOLIDAYS_2026`：法定节假日（全天谷价）；每年 11 月国务院公布次年安排后需补充次年日期。

官方价目来源：<https://api-docs.deepseek.com/zh-cn/quick_start/pricing>。

## 限制

- 只统计本机 DSH 会话，不覆盖其他客户端；费用为估算，不替代平台账单。
- 紧凑条只出现在已选中会话的输入框下方；空白首页（尚未选择会话）不显示。
- 本对话面板默认「全部」，即该会话从第一条已持久化消息到现在的累计值；新建会话尚未落盘时显示「本对话统计中…」，不会回退成全部会话数字。
- 紧凑条「今日」统计本对话今天（北京时间）的用量；今日无用量时显示 0，总价仍正常。
- 「全部」范围的图表只画最近 90 天，KPI 与模型合计仍覆盖全部；更早的日期折叠。
- 2026-08-17 之前没有峰谷定价，历史费用按当时谷价近似。
- 分叉会话继承的父历史被跳过；若父会话日志已被删除，该部分会少计。
- 本地日志数量增长后，进程内首次统计可能需要一点时间；之后只重读变化的会话。
- 服务路由仅监听回环并校验同源；本机其他进程仍可读取聚合后的用量数据（不含任何凭据）。
- 不追加 session 事件、不写会话文件、不改变模型可见内容（无工具、无提示词）；只写 `%DSH_HOME%\logs\dsh-usage-strip.log` 诊断日志。

## 诊断日志

每次扫描、读取会话、seed 截断和路由请求都会追加到：

```text
%DSH_HOME%\logs\dsh-usage-strip.log
```

默认 `DSH_HOME` 为 `C:\Users\<user>\.dsh`。日志为 JSONL，字段包括时间、事件、sessionId、`eventCount`、`inheritedEventCount`、`readFrom`（固定为 0）、`eventsRead`、`seedSeen`、折叠后的 token/cost、路由状态。达到约 1 MB 时轮转为 `.log.1`，最多保留两份。

日志不包含提示词、消息正文、模型输出或凭据；可随时删除。重启后仍是 0 时，先看最近 `session` 行的 `eventsRead`/`seedSeen`，再看 `route` 行。

## 隐私与免责声明

- 只读本机 DSH 已持久化的会话日志；不联网、不上传数据、不写入会话、不新增模型可见内容。
- 仅写本地诊断日志 `%DSH_HOME%\logs\dsh-usage-strip.log`（及轮转文件）；不含消息内容或凭据，可随时删除。
- 费用按官方价目估算，不是官方账单；与 DeepSeek 官方没有隶属关系。
- 路由仅监听回环地址并校验同源；本机其他进程仍可读取聚合后的用量数据（不含任何凭据）。
- 市场安装时，DSH 会按插件包声明的 `dsh.bundle` 加载；本插件不包含遥测或第三方追踪。

## 开发与测试

```powershell
node --check host.js
node --check client.js
node --check aggregate.js
node --check pricing.js
node test/pricing.test.mjs
node test/aggregate.test.mjs
node test/payload.test.mjs
node test/read-session.test.mjs
node test/local-audit.mjs   # 直接读本机会话日志，核对聚合结果（含每会话明细，开发用）
```

服务接口：`GET /dsh-usage/api.json?days=1|7|30|0[&session=<id>]`（仅回环、同源、只读）。不带 `session` 时为全部会话；带 `session` 时只统计该会话，未知 id 返回 404。

## 排障

- 紧凑条没出现：先刷新页面。客户端 bundle 的注册信息可在 `GET /dsh-usage/api.json` 的 `meta.client` 中查看（`registered: true` 表示 Host 的客户端模块图已收录本插件）；若仍为 `false`，重启 DSH。
- 面板显示「用量不可用」：确认 Host 端 `sessionPersistence` 与 `webServer` 已挂载（Web / Desktop 版默认都有）。
- 数字为空或偏小：会话日志尚未落盘（新建会话刚产生用量时需要一次落盘），或会话格式不被当前版本读取；接口的 `warnings` 会给出计数。重启后归零时查看 `%DSH_HOME%\logs\dsh-usage-strip.log` 的 `session`/`route` 行（`readFrom: 0`、`seedSeen`、`eventsRead`）。

## 文件

| 文件 | 作用 |
|---|---|
| `host.js` | Host 插件实现：读取会话、聚合、HTTP 路由 |
| `index.js` | 兼容入口：转导出 `host.js`（供测试/本地工具直接导入） |
| `aggregate.js` | 纯函数：事件折叠、分桶、范围汇总 |
| `pricing.js` | 价目版本、峰谷/节假日规则、调价时间线 |
| `client.js` | 浏览器半侧：紧凑条、弹出面板、图表、样式与词典 |
| `locale/*.json` | 插件管理页显示元数据与详情文档入口 |
| `icon.svg` / `assets/icon-180.png` | 插件图标；PNG 供插件市场使用 |
| `LICENSE` | MIT 许可证 |
| `README.md` / `README.en.md` | 中文 / 英文说明 |

## License

[MIT](LICENSE) © 2026 eakshelling
