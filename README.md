# dsh-web-setup

> **⚠️ 临时存储说明**
> 本仓库是一次环境搭建过程的临时记录，用于在换机、重装或排错时快速复现当时的配置与结论。
> 内容会随 dsh 版本、上游插件和第三方平台政策变化而失效，**不作为长期维护的开源项目**，也不保证命令与文档长期适用。
> 需要长期依赖的配置请以本机实际状态和官方文档为准。

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
| dsh-worktable@0.4.0 | github:Aisland-SJL/dsh-worktable **子包 01_content** | 工作台插件。根包不是插件，必须装 `#path:/01_content`，详见问题 5 |
| dshmarket@1.66.x | npm | 可视化插件市场，站内浏览、搜索、一键安装社区插件 |
| better-dsh-session-deletetool@0.5.3 | github:Lzcdebear/better-dsh-session-deletetool | 会话真正删除（非归档），支持批量；家族树受 `sessionQuery` 限制，详见问题 6 |
| @liustack/modsearch@5.10.7 | npm（经市场安装） | 通过插件市场自行安装 |
| beauticode-dsh@1.0.30 | npm（经市场安装） | 通过插件市场自行安装 |

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

### 问题 4：免费档被上游限制在 OpenCode 客户端内使用（2026-10-18 实测，未解决，插件已卸载）

- 现象：对话报 `HTTP 403 FreeTierError: OpenCode's free tier can only be used from within OpenCode`。
- 实测边界：`GET /zen/v1/models` 仍返回 200，但 `POST /zen/v1/chat/completions` 一律 403，替换 User-Agent 无效——服务端按客户端身份拦截，属上游访问控制，第三方客户端无法通过改请求头绕过。
- 插件侧状态：上游仓库最新提交仅为文档更新，暂无修复方案。
- 影响：dsh-opencode-zen 路由下的模型仍显示在模型选择器中，但调用必然失败。
- 处理建议：改用 dsh-provider-hub 的官方渠道预设（腾讯混元、火山方舟、小米 MiMo 等，各平台均有新用户免费额度），或使用 DSH 原生 DeepSeek 适配器。若需彻底消除误选，可执行 `dsh plugin remove dsh-opencode-zen --profile web` 卸载后重启。

### 问题 5：集合仓库的根包不是插件（dsh-worktable）

- 现象：安装 `github:Aisland-SJL/dsh-worktable` 后，界面显示「已安装，未生效」，并提示"这是集合仓库的根包，本身不是插件"。
- 原因：该仓库是多包集合，根目录只是索引 + 文档：
  | 目录 | 内容 |
  |---|---|
  | `00_index` | 仅 README 索引 |
  | `01_content` | **可安装的插件包**（含 `cordis.patch.yml`、`dsh.plugin.json`） |
  | `02_process` | PRD、调研、工作日志 |
  | `04_test` | 测试脚本 |
- 修复：安装子包而不是根包：
  ```sh
  dsh plugin remove dsh-worktable --profile web
  dsh plugin install "github:Aisland-SJL/dsh-worktable#path:/01_content" --profile web
  ```
  安装后包版本为 0.4.0，`engines` 声明兼容 `0.2.0-rc.2`，重启后生效。
- 通用经验：遇到"已安装，未生效"先看提示里的子包路径，`#path:/子目录` 是 pnpm 对 git 源子目录的固定写法。

### 问题 6：会话删除工具（better-dsh-session-deletetool）的两处限制

**现象一：批量删除对话框显示「读取失败：HTTP 200」。**

- 已排除项：`GET /catalog`、`GET /inspect`（逐个会话）、`POST /delete-batch`（空参数安全测试）、方法校验全部实测正常，返回结构与状态码均符合预期。
- 文案来源：插件客户端在响应不是合法 JSON 或缺少 `ok: true` 时，会把错误编码为 `HTTP <状态码>`（`client.js` 的 `failureOf()`），因此该提示表示"收到了 HTTP 200，但内容不是插件数据"，典型成因为页面为旧版本加载或浏览器缓存回退。
- 处置：`Ctrl + Shift + R` 强制刷新后重开对话框；仍复现则用开发者工具确认该请求的 URL、状态码与响应体。
- 状态：根因未最终确认，此处仅记录已排除项与判断依据。

**现象二：家族树（子智能体 / 派生对话）读不到数据。**

- `GET /inspect` 返回 `ok: true`，但携带警告：`sessionQuery 服务不可用，子智能体目录没有读到`。
- 影响：只能列出根会话，子智能体与派生对话无法展开，`descendants` 恒为 0。
- 原因：插件依赖的 `sessionQuery` 服务在当前 dsh 版本未暴露，属插件与 0.2.x 的版本差异，非配置错误。
- 处置：普通根会话删除不受影响；若必须按家族树删除，需要为插件补一层会话查询兼容，或等待插件适配当前 dsh 版本。

### 问题 7：缓存清理与多端共存的边界

实测数据：

| 位置 | 实测大小 | 能否直接删除 |
|---|---|---|
| `%LOCALAPPDATA%\npm-cache`（npm 缓存） | 约 4 KB | 可以，但几乎没有收益 |
| `%LOCALAPPDATA%\pnpm\store`（pnpm 全局存储） | 约 750 MB | **不可以** |

- pnpm store 不能手删：profile 的 `node_modules` 通过硬链接指向 store，删除 store 后已装插件的文件随之消失，表现为"模块找不到"。需要清理时使用 `pnpm store prune`（仅移除未被引用的版本）。
- web 与 desktop 是两个独立 profile（`.dsh\profiles\web`、`.dsh\profiles\desktop`），依赖各自安装、互不影响；但共享 `~/.dsh` 下的会话、凭据与 settings，因此两端看到的是同一批会话与同一份 API Key。
- 桌面客户端只支持从 npm registry 安装插件，不支持 GitHub 源：`dsh-worktable`、`dsh-opencode-zen`、`better-dsh-session-deletetool` 这类 git 源插件在 desktop profile 无法安装。
- 换端不等于清理：保留 web profile 即可，需要桌面端时在 desktop profile 另行安装 npm 源插件（`dsh plugin install <包名> --profile desktop`）。

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
| 插件显示"已安装，未生效" | 装的是集合仓库根包，不是插件 | 按提示改装子包：`github:<owner>/<repo>#path:/<子目录>` |
| 删除工具显示"读取失败：HTTP 200" | 收到 200 但响应体不是插件数据（页面/缓存） | 强刷页面；仍复现则在开发者工具里核对该请求 |
| 家族树为空、无子智能体 | `sessionQuery` 服务在当前 dsh 版本不可用 | 属插件版本差异，普通根会话删除不受影响 |

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
