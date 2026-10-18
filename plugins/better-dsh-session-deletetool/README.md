# better-dsh-session-deletetool（诊断记录，已卸载）

> **状态：已从 web profile 卸载。** 原因见下方两处限制；替代方案为 `plugins/dsh-session-remover`（移入回收站，可还原）。

真正删除 DSH 会话（而非归档），支持按工作区分组、批量删除、查看会话派生关系。

- 上游：`github:Lzcdebear/better-dsh-session-deletetool@0.5.3`
- 本插件不需要代码级适配，本目录记录两处已知限制与排查依据。

## 安装

```sh
dsh plugin install github:Lzcdebear/better-dsh-session-deletetool --profile web
# 重启 dsh web
```

## 已知限制一：批量对话框显示「读取失败：HTTP 200」

客户端在响应不是合法 JSON、或缺少 `ok: true` 时，会把错误编码成 `HTTP <状态码>`（见 `client.js` 的 `failureOf()`）。因此该提示的含义是"收到 200，但内容不是插件数据"，典型成因为页面为旧版本加载或浏览器缓存回退。

实测排除项（均在服务端逐条验证）：

| 接口 | 实测结果 |
|---|---|
| `GET /catalog` | 200，正确返回会话列表 |
| `GET /inspect?sessionId=` | 200，`ok: true`（携带 sessionQuery 警告） |
| `POST /delete-batch`（空 roots 安全测试） | 400 + 明确错误信息，路由与校验正常 |
| `GET /delete` | 405，方法校验正常 |

处置：`Ctrl + Shift + R` 强制刷新后重试；仍复现则用开发者工具核对该请求的 URL、状态码与响应体。

状态：**根因未最终确认**，此处仅记录已排除项与判断依据，不作结论。

## 已知限制二：家族树读不到子智能体

`GET /inspect` 返回 `ok: true`，但携带警告：

```
sessionQuery 服务不可用，子智能体目录没有读到
```

影响：只能列出根会话，`descendants` 恒为 0，子智能体与派生对话无法展开。
原因：插件依赖的 `sessionQuery` 服务在当前 dsh 版本未暴露，属插件与 0.2.x 的版本差异，非配置错误。
处置：普通根会话删除不受影响；若必须按家族树删除，需要为插件补会话查询兼容，或等待上游适配。
