# dsh 模型提供方手动填写指南

适用场景：在 dsh web 的 **设置 → Models → 添加自定义提供方** 表单中手工填写付费渠道。本文件给出每个字段的确切取值，数据来源为 dsh-provider-hub 内置预设（共 50 家，此处收录你需要的国内几家 + DeepSeek 作为对照）。

---

## 一、表单字段说明

| 表单字段 | 含义 | 填写要点 |
|---|---|---|
| **Provider ID** | 路由标识 | 以小写字母开头的唯一标识，仅用于内部区分，建议与下表一致；同一个 ID 只能存在一份 |
| **显示名称** | 界面上展示的名字 | 随意，建议 `腾讯混元`、`火山方舟` 等 |
| **API 地址** | Base URL | **必须填到 `/v1` 或对应版本路径为止**，不要带 `/chat/completions`；填错会 404 |
| **API 协议** | 请求格式 | 三选一：`openai-completions`（绝大多数）、`openai-responses`（少数订阅制）、`anthropic-messages` |
| **API 密钥** | 平台发放的 Key | 见每家「获取地址」；填错通常返回 401 |
| **模型目录** | 可选模型清单 | 点「获取可用模型」自动拉取；拉不到就按下方模型 ID 手填，逗号或换行分隔 |

---

## 二、腾讯混元

| 字段 | 值 |
|---|---|
| Provider ID | `hunyuan` |
| 显示名称 | `腾讯混元` |
| API 地址 | `https://api.hunyuan.cloud.tencent.com/v1` |
| API 协议 | `openai-completions` |
| API 密钥 | 腾讯云控制台 → 混元 → API Key：https://console.cloud.tencent.com/hunyuan/api-key |
| 模型 ID | `hunyuan-turbos-latest`、`hunyuan-t1-latest` |

补充模型 ID（按开通情况可加填）：`hunyuan-lite`（免费档）、`hunyuan-standard-latest`、`hunyuan-pro-latest`、`hunyuan-vision-latest`。

---

## 三、火山方舟（豆包）— 按量付费

| 字段 | 值 |
|---|---|
| Provider ID | `ark` |
| 显示名称 | `火山方舟` |
| API 地址 | `https://ark.cn-beijing.volces.com/api/v3` |
| API 协议 | `openai-completions` |
| API 密钥 | 方舟控制台 → API Key：https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey |
| 模型 ID | `doubao-seed-1-6-250615`、`doubao-seed-1-6-thinking-250715` |

**关键提示**：方舟的模型必须在控制台**先开通**，且部分账号只支持「推理接入点」形式，此时模型 ID 要填 `ep-xxxxxxxx-xxxxx`（在控制台「在线推理」页复制），不能填 `doubao-seed-...`。

### 火山方舟 Agent Plan（订阅制，协议不同）

| 字段 | 值 |
|---|---|
| Provider ID | `ark-agent-plan` |
| 显示名称 | `火山方舟 Agent Plan` |
| API 地址 | `https://ark.cn-beijing.volces.com/api/plan/v3` |
| API 协议 | **`openai-responses`**（不是 openai-completions） |
| API 密钥 | 同上，方舟 API Key |
| 模型 ID | `ark-code-latest`、`deepseek-v4.1-flash`、`glm-5.3`、`kimi-k3`、`deepseek-v4-pro`、`deepseek-v4-flash`、`kimi-k2.8-preview` |

注意：Agent Plan 用的是 `/api/plan/v3`（订阅额度），按量付费用 `/api/v3`。两者地址混淆会导致计费口径错误或鉴权失败。

---

## 四、小米 MiMo

| 字段 | 值 |
|---|---|
| Provider ID | `xiaomi` |
| 显示名称 | `小米 MiMo` |
| API 地址 | `https://api.xiaomimimo.com/v1` |
| API 协议 | `openai-completions` |
| API 密钥 | 小米 MiMo 开放平台：https://platform.xiaomimimo.com/ |
| 模型 ID | `mimo-v2.5`、`mimo-v2.5-pro`、`mimo-v2.5-pro-ultraspeed` |

### 小米 MiMo Token Plan（按区选择地址）

| 区域 | API 地址 | 模型 ID |
|---|---|---|
| 国内 | `https://token-plan-cn.xiaomimimo.com/v1` | `mimo-v2.5`、`mimo-v2.5-pro` |
| 新加坡 | `https://token-plan-sgp.xiaomimimo.com/v1` | 同上 |
| 美国 | `https://token-plan-ams.xiaomimimo.com/v1` | 同上 |

Token Plan 与普通 API 是两套端点、两套额度，Key 不通用，按你购买的类型选择。

---

## 五、DeepSeek（对照参考，DSH 已内置可跳过）

| 字段 | 值 |
|---|---|
| Provider ID | `deepseek-custom` |
| 显示名称 | `DeepSeek` |
| API 地址 | `https://api.deepseek.com`（官方文档该地址不带 `/v1`，加 `/v1` 也兼容） |
| API 协议 | `openai-completions` |
| API 密钥 | https://platform.deepseek.com |
| 模型 ID | `deepseek-v4-flash`、`deepseek-v4-pro`、`deepseek-v4-flash-vision-exp` |

**如果你只是要用 DeepSeek**：DSH 原生适配器已经内置，直接在「模型」页填 Key 即可，不必走自定义提供方。

---

## 六、填完后的验证与排错

| 现象 | 大概率原因 | 处理 |
|---|---|---|
| 401 / 鉴权失败 | Key 错误或已过期；Token Plan 与普通 Key 混用 | 核对 Key 类型与端点是否匹配 |
| 404 / Not Found | API 地址少了或多了版本路径；协议选错（completions vs responses） | 严格照上表复制地址与协议 |
| 400 model not found | 模型 ID 未开通 / 拼写不符 / 方舟需填 `ep-` 接入点 | 控制台核对已开通模型，复制准确 ID |
| 429 | 额度用尽或限流 | 控制台查余额与速率限制 |
| 模型不出现 | 模型目录未填且「获取可用模型」失败 | 手动填模型 ID，逗号或换行分隔 |

填写完成无需重启 dsh web：自定义提供方写入即热注册，回到聊天框的模型选择器即可看到新模型。

---

## 七、更快的方式（可选）

以上内容就是 dsh-provider-hub 的预设数据，插件已把它做成「一键」形式：**设置 → Models → 页面底部「服务商预设」卡片**，点对应服务商，粘贴 Key，点「启用」即可，无需手工逐字段填写，也不会出现地址/协议填错的问题。

手工填写的价值在于：预设清单外的自有网关（公司内网中转、one-api 类聚合服务）只能通过表单接入。

---

数据来源：dsh-provider-hub v0.3.2 内置预设（`/dsh-provider-hub/state` 接口实时读取）。各平台模型 ID 会随版本更新，模型不可用时报错信息通常会给出替代 ID。
