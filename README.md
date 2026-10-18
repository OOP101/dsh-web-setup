# dsh-web-setup

DeepSeek Harness（dsh web）环境搭建记录与维护工具箱。

本仓库记录 2026-10-18 在 Windows 上搭建 DeepSeek Harness 网页端（`dsh web`）环境的完整过程：安装了哪些插件、踩到的三个兼容性问题及修复方案，并提供后续更新维护所需的一键脚本。重新安装插件或插件升级后，运行本仓库的脚本即可恢复全部本地补丁。

## 环境信息

| 项目 | 值 |
|---|---|
| 操作系统 | Windows 10/11（Git Bash / PowerShell） |
| Node | v22（dsh 全局安装于 npm 全局目录） |
| dsh 版本 | @deepseek-ai/dsh 0.2.x（CLI） |
| Profile | web（`C:\Users\<你>\.dsh\profiles\web`） |
| 服务地址 | http://127.0.0.1:3080 |

## 已安装插件

| 插件 | 来源 | 作用 |
|---|---|---|
| dsh-provider-hub@0.3.2 | npm | 50 家服务商预设（腾讯混元、小米 MiMo、火山方舟等），填 Key 一键写入官方 llm-pi-ai 路由与凭据，热注册无需重启 |
| dsh-worktable@0.0.0 | github:Aisland-SJL/dsh-worktable | 工作台插件（无 dsh.bundle，以普通依赖安装） |
| dsh-opencode-zen | github:xiaozhe7772222/dsh-opencode-zen | OpenCode Zen 免费档模型接入（零 Key，字面量 `public` 认证）。**注：2026-10-18 起上游将免费档限制为仅 OpenCode 客户端可用，该路由调用返回 403，详见问题 4** |

### 安装命令

```sh
dsh plugin install dsh-provider-hub --profile web
dsh plugin install github:Aisland-SJL/dsh-worktable --profile web
dsh plugin install github:xiaozhe7772222/dsh-opencode-zen --profile web
# 每次安装后需重启 dsh web 才会加载插件层
```

## 三个兼容性问题与修复

以下补丁均落在 `~/.dsh/profiles/web/node_modules/` 内，**pnpm 重装/更新插件会将其覆盖**，届时运行 `scripts/apply-zen-patches.mjs` 一键恢复。

### 问题 1：dsh-opencode-zen 缺少声明的补丁文件

- 现象：dsh web 启动即崩溃，报 `failed to read overlay ...\dsh-opencode-zen\cordis.patch.yml: ENOENT`。
- 原因：该 GitHub 包在 package.json 的 `dsh.bundle.patch` 声明了 `./cordis.patch.yml`，但包内没有这个文件。
- 修复：手动补写标准 insert 条目（见 `patches/dsh-opencode-zen/cordis.patch.yml`）。

### 问题 2：适配器接口代差（prepareCall）

- 现象：对话运行报 `registration.adapter.prepareCall is not a function`。
- 原因：本机 dsh-llm 0.2.x 要求适配器实现 `prepareCall(provider, model, signal)` 并返回 `{ model, stream(options) }` 绑定句柄；该插件的 `OpenCodeZenAdapter` 只有旧接口（`resolveModel` + `async *stream`）。
- 修复：在 `OpenCodeZenAdapter` 类内补写垫片（见 `patches/dsh-opencode-zen/fix-prepareCall.md`）。

### 问题 3：插件内置模型清单过期

- 现象：对话报 `HTTP 410 ModelDeprecated`（mimo-v2.5-free → v2.6）或 `HTTP 400 Model is unavailable`（hy3-free 等已下线）。
- 原因：OpenCode Zen 免费档模型池滚动更新，插件内硬编码的 MODELS 数组过期。
- 修复：以 `public` 凭据请求 `https://opencode.ai/zen/v1/models` 获取当前免费模型，更新 MODELS 数组（`scripts/apply-zen-patches.mjs` 已内置自动同步）。

### 问题 4：免费档被上游限制在 OpenCode 客户端内使用（2026-10-18 实测，未解决）

- 现象：对话报 `HTTP 403 FreeTierError: OpenCode's free tier can only be used from within OpenCode`。
- 实测边界：`GET /zen/v1/models` 仍返回 200，但 `POST /zen/v1/chat/completions` 一律 403，替换 User-Agent 无效——服务端按客户端身份拦截，属上游访问控制，第三方客户端无法通过改请求头绕过。
- 插件侧状态：上游仓库最新提交仅为文档更新，暂无修复方案。
- 影响：dsh-opencode-zen 路由下的模型仍显示在模型选择器中，但调用必然失败。
- 处理建议：改用 dsh-provider-hub 的官方渠道预设（腾讯混元、火山方舟、小米 MiMo 等，各平台均有新用户免费额度），或使用 DSH 原生 DeepSeek 适配器。若需彻底消除误选，可执行 `dsh plugin remove dsh-opencode-zen --profile web` 卸载后重启。

## 维护手册

### 一键恢复/更新补丁

```sh
node scripts/apply-zen-patches.mjs
# 可选参数：--dir <dsh-opencode-zen 包目录>（默认自动定位 ~/.dsh/profiles/web）
```

脚本做三件事：补写缺失的 `cordis.patch.yml`；若适配器缺 `prepareCall` 则注入垫片；从上游拉取最新免费模型清单并重写 MODELS 数组。执行后重启 `dsh web` 生效。

### 重启服务

重启脚本位于 `~/.dsh/restart-web.ps1`（本机既有文件，本仓库不重复收录）：它会结束 3080 端口旧进程并重新执行 `npx @deepseek-ai/dsh web`，日志写入 `~/.dsh/web-restart.log`。

注意事项：

- Windows 下结束 npx 父进程后，dsh 的 node 子进程可能残留并继续占用 3080 端口，重启前应确认端口已释放（`netstat -ano | findstr :3080`）。
- `dsh plugin install/remove` 之后必须重启才能加载/卸载插件层；但 provider-hub 内的"填 Key 启用服务商"是运行时热注册，无需重启。

### 常见报错速查

| 报错 | 含义 | 处理 |
|---|---|---|
| `failed to read overlay ... cordis.patch.yml` | 包缺补丁文件，profile 无法启动 | 运行 `apply-zen-patches.mjs` 补写 |
| `registration.adapter.prepareCall is not a function` | 适配器接口代差 | 运行 `apply-zen-patches.mjs` 注入垫片 |
| `HTTP 410 ModelDeprecated` / `HTTP 400 Model is unavailable` | 免费模型清单过期 | 运行 `apply-zen-patches.mjs` 同步上游清单 |
| `HTTP 403 FreeTierError` | 免费档被上游限制为仅 OpenCode 客户端可用 | 无本地绕行方案，改用 provider-hub 官方渠道预设或原生 DeepSeek |
| `HTTP 429` | 免费档 IP 限流 | 等待 30–60 秒后重试 |
| 插件列表页显示"暂时无法读取插件" | 只读清单页的 RPC 失败 | 不影响插件功能，以"设置 → Models"实际状态为准 |

## 目录结构

```
dsh-web-setup/
├── README.md                          # 本文件
├── LICENSE
├── scripts/
│   └── apply-zen-patches.mjs          # 一键恢复补丁 + 同步最新免费模型清单
├── docs/
│   └── provider-fill-guide.md         # 腾讯混元 / 火山方舟 / 小米 MiMo 自定义提供方逐字段填写值
└── patches/
    └── dsh-opencode-zen/
        ├── cordis-patch-yml-missing.md  # 问题 1：缺失补丁文件的说明与修复内容
        └── fix-prepareCall.md           # 问题 2：prepareCall 垫片说明与代码
```

## 相关资料

- dsh CLI：`@deepseek-ai/dsh`（npm）
- 插件生态索引：ai-develop.top / plugin.dshx.dev / dsh.deepseek404.com
- OpenCode Zen 免费档模型查询：`GET https://opencode.ai/zen/v1/models`（`Authorization: Bearer public`）
