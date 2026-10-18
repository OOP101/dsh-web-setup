# dsh-opencode-zen（本地适配版说明，已停用）

把 OpenCode Zen 免费档模型接进 DSH 模型选择器，零配置、无需注册、字面量 `public` 认证。

- 上游：`github:xiaozhe7772222/dsh-opencode-zen`
- **当前状态：已卸载**。2026-10-18 起上游把免费档限制为仅 OpenCode 客户端可用（`POST /chat/completions` 一律 403 `FreeTierError`，`GET /models` 仍 200，改 UA 无效）。插件侧无解，故从 web profile 移除；本目录保留适配记录，供上游恢复后重新启用。

## 本目录收录的适配

| 文件 | 用途 |
|---|---|
| `apply.mjs` | 一键应用全部适配 + 从上游同步当前免费模型清单 |
| `patch/cordis-patch-yml-missing.md` | 上游包缺少它自己声明的 `cordis.patch.yml`，导致启动崩溃 |
| `patch/fix-prepareCall.md` | 适配器缺少 `prepareCall`，导致对话报 `prepareCall is not a function` |

## 三个适配点

1. **补写 `cordis.patch.yml`**：上游 package.json 声明了该补丁文件但包内没有，dsh 组合 profile 时读取失败，服务启动即中断。
2. **注入 `prepareCall` 垫片**：本机 dsh-llm 0.2.x 要求适配器提供 `prepareCall(provider, model, signal)`，返回 `{ model, stream(options) }`；插件只实现了旧接口（`resolveModel` + `async *stream`）。
3. **同步模型清单**：插件内硬编码的 MODELS 过期（`mimo-v2.5-free` 已废弃、`hy3-free` 已下线）。`apply.mjs` 会以 `public` 凭据请求上游 `/models`，只保留 `*-free` 与 `big-pickle`，重写 MODELS 数组。

## 安装与适配

```sh
dsh plugin install github:xiaozhe7772222/dsh-opencode-zen --profile web
node plugins/dsh-opencode-zen/apply.mjs
# 重启 dsh web
```

## 若上游恢复免费档

重装插件 → 运行 `apply.mjs` → 重启 → 模型选择器选 `deepseek-v4.1-flash-free` 或 `mimo-v2.6-flash-free`。若仍返回 403 `FreeTierError`，说明上游仍未放开，继续等待。

## 已知限制

- 免费档有 IP 限流（429 时等 30–60 秒）。
- 免费模型池滚动更新，出现 `410 ModelDeprecated` / `400 Model is unavailable` 即清单过期，重跑 `apply.mjs` 同步。
