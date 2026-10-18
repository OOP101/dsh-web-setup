# dsh-provider-hub（本地适配版说明）

50 家服务商预设：选服务商、粘贴 API Key、点启用，插件通过 DSH 官方服务写入 `llm-pi-ai` 路由与凭据，热注册立即生效，无需重启、无需手改 `settings.yaml`。

- 上游：`dsh-provider-hub@0.3.2`（npm，作者 DDDMUC）
- 适用：腾讯混元、火山方舟（豆包）、小米 MiMo、阿里云百炼、智谱、Kimi Coding、MiniMax Coding Plan 等

## 本目录收录的适配

| 文件 | 用途 |
|---|---|
| `apply.mjs` | 一键应用适配（幂等，可重复执行） |
| `patch/fix-settings-slot.md` | 插槽名不匹配导致「服务商预设」卡片不显示的根因与修复 |

## 适配内容：设置页插槽名

**问题**：插件客户端把卡片注册到 `settings.models.footer`，而本机 dsh 版本的设置页只挂载 `settings.section` 与 `settings.onboarding`。插槽不存在时注册被静默忽略——接口正常、日志无报错，界面上就是没有卡片。

**修复**：注册目标改为 `settings.section`，并补上该插槽必需的 `label`。改完设置页左侧多出一节「服务商预设」。

```js
ctx.slots.inject('settings.section', () =>
  ctx.slots.register(
    { name: 'settings.section', id: 'provider-hub', order: 40, label: () => '服务商预设', locale: NS },
    PresetsCard,
  ),
)
```

## 安装与适配

```sh
dsh plugin install dsh-provider-hub --profile web
node plugins/dsh-provider-hub/apply.mjs
# 重启 dsh web
```

## 使用

设置 → **服务商预设** → 选服务商 → 点「获取 Key」去对应控制台申请 → 粘贴 Key → 点「启用」→ 状态显示"运行中"→ 回到聊天框的模型选择器即可选用。

## 已知限制

- 插件更新或重装会覆盖 `src/client.js`，需要重新执行 `apply.mjs`。
- 若某天官方设置页恢复提供 footer 插槽，本适配会变成新增独立一节，不影响功能。
- 不想用插件时，用「添加自定义提供方」手工填写同样可用（免费赠送额度走同一套官方接口），逐字段取值见仓库根目录 `docs/provider-fill-guide.md`。
