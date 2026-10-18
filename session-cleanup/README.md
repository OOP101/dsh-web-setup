# session-cleanup — dsh 会话一键删除

dsh（DeepSeek Harness）没有提供删除会话的入口，只有"归档"。本目录提供一个命令行工具，把指定的会话连同它的记账与缓存一起清理掉，会话正文移入 Windows 回收站，可以还原。

本目录自成一体：只有 `delete-session.mjs` 一个脚本，无第三方依赖，Node 18+ 直接运行。

## 为什么需要它

dsh 原生只有归档功能。归档的实质是把会话 id 写进 `~/.dsh/storages/workspace.json` 的 `global.archivedSessionIds`，在侧栏把那一行隐藏起来：

- 聊天记录仍然保存在磁盘上，照旧占用空间；
- 本机 dsh 0.2.x **没有归档管理页面**，归档后既找不到撤销入口，也找不到删除入口；
- 归档只是"看不见"，不是"删掉了"。

社区有两个会话删除插件，在本机 dsh 0.2.x 上都未能挂载出菜单：

| 插件 | 状态 | 原因 |
|---|---|---|
| `better-dsh-session-deletetool` | 已卸载 | 批量对话框固定显示「读取失败：HTTP 200」；依赖的 `sessionQuery` 服务在当前版本不可用，家族树读不到子智能体 |
| `dsh-session-remover` | 装得上，菜单不出现 | 注册到插槽 `sidebar.workspaces.session.menu.item`，本机只声明 `sidebar.workspaces` 与 `sidebar.workspaces.directoryFlow`；插槽名不存在时注册被静默忽略，插件内又有 try/catch，连报错都没有 |

插件"装上了但界面无变化"，优先怀疑插槽名对不上：先 `grep -rn "slots.inject"` 找出插件注册的插槽名，再在 dsh 客户端产物里搜同名常量确认是否存在。两边对不上就不必在插件侧继续尝试。本工具是这条路的替代方案。

## 一条会话涉及三处数据

删除不能只删目录，也不能只改配置，否则会留下各种残留：

| 层 | 路径 | 作用 | 只删其他层的后果 |
|---|---|---|---|
| 1 正文 | `~/.dsh/sessions/<workspace-key>/session-<uuid>/session.jsonl.zstd` | 真正的聊天记录 | 只删 2、3 层：记录仍在占磁盘 |
| 2 记账 | `~/.dsh/storages/workspace.json` → `tables.workspaces.<id>.sessionIds`<br>以及 `global.archivedSessionIds` | 决定侧栏显示哪几条 | 只删 1 层：侧栏留下点不开的空行 |
| 3 缓存 | `~/.dsh/storages/session_projcache.json` → `tables.sessions.<id>.rows.title` | 决定侧栏显示什么标题 | 只删 1、2 层：标题缓存越积越多，成为无主条目 |

工具一次做完三步：

1. 目录移入 Windows 回收站（`.NET FileSystem.DeleteDirectory` + `SendToRecycleBin`，不是永久抹除）；
2. 从 `sessionIds` 与 `archivedSessionIds` 中摘除该 id；
3. 从 `session_projcache.json` 的 `tables.sessions` 中删除该条目。

`workspace-key` 由工作区路径转换而来，例如 `D:\DeepSeek` 对应 `--D-DeepSeek--`。

## 用法

```sh
# 列出全部工作区与会话（短 id、完整 id、归档状态、目录是否存在）
node session-cleanup/delete-session.mjs --list

# 删除指定会话，uuid 前 8 位即可；可一次给多个
node session-cleanup/delete-session.mjs 900ea42d 7af8fc00
```

`--list` 输出示例：

```
DSH_HOME: C:\Users\JJY\.dsh

■ DeepSeek  (D:\DeepSeek)  共 3 个会话
  b460089d  (无标题)   [正常 / 目录在]
            session-b460089d-5127-4172-b3fa-95e6cfd04f5c
  900ea42d  你好   [正常 / 目录在]
            session-900ea42d-ab64-45eb-818f-00ba7e2091bc
```

参数：

| 参数 | 说明 |
|---|---|
| `--list` / `-l` | 只列清单，不做任何修改 |
| `<id 或片段>` | 要删除的会话，可给多个 |
| `--home <目录>` | 指定 `DSH_HOME`，默认 `%USERPROFILE%\.dsh` 或环境变量 `DSH_HOME` |
| `--help` / `-h` | 显示帮助 |

id 解析顺序为：完整 id → 视为 uuid 前缀（自动补 `session-`）→ 视为末尾片段 → 任意唯一片段，任一层命中即停。匹配到多条时会列出全部候选，要求给出更长的片段，不会猜。

退出码：`0` 成功；`1` 参数或环境错误（含服务在运行）；`2` 部分条目未处理（其余已处理）。

## 执行前必须停止服务

脚本会先探测 `127.0.0.1:3080`，服务在跑就直接拒绝执行（退出码 1）。

原因：运行中的进程会把内存里的工作区状态写回磁盘，覆盖掉清理结果。表现为删除后侧栏仍然显示、或者重启后会话又回来了。

```sh
# 查占用 3080 的进程
netstat -ano | grep ":3080" | grep -i listening
# 结束它（PID 换成上一步查到的）
taskkill /F /PID <PID>
```

## 作用范围

工具只读写 `DSH_HOME` 下的两个位置：

```
DSH_HOME/
├── sessions/<workspace-key>/session-<uuid>/     # 删除时移入回收站
└── storages/
    ├── workspace.json                            # 摘除 id
    └── session_projcache.json                    # 删除条目
```

**工作区对应的项目目录不会被触碰。** 例如工作区 `D:\DeepSeek`，在 `workspace.json` 里只是一行字符串路径，工具从不读写它。实测删除前后对该目录做文件快照比对，结果完全一致。

## 还原

会话正文在回收站里，可以直接还原：

1. 打开资源管理器 → 回收站；
2. 找到对应的 `session-<uuid>` 文件夹，右键 → 还原，它会回到 `~/.dsh/sessions/<workspace-key>/` 下；
3. 重启 dsh web。

注意：还原只恢复正文。工作区记账与投影缓存的清理不会同步恢复，因此还原后的会话在侧栏里可能归入「未分组」或显示为无标题，需要重新进入一次对话让缓存重建。要完全恢复到删除前的侧栏位置，需手工把 id 加回 `workspace.json` 的 `sessionIds`。

清空回收站后不可还原。

## 已知限制

- **仅 Windows**：移入回收站依赖 .NET 的 `Microsoft.VisualBasic.FileIO.FileSystem`，Linux / macOS 未适配。
- **`--list` 的数据源是 `workspace.json`，不是磁盘扫描**：磁盘上可能存在未登记的孤儿会话目录（常见于旧版本残留的 `session.v4.jsonl.zstd`），这些不会出现在清单里，也无法用本工具删除，需要按上面的路径手工处理。
- **修改 JSON 前必须停服务**，否则改动会被内存状态覆盖。
- 删除后需重启 dsh web，侧栏才会更新。
- 只清理本机 `DSH_HOME`。web 与 desktop 两个 profile 共享同一份 `~/.dsh` 下的会话与存储，因此删除对两端同时生效。

## 实测记录（2026-10-18）

删除 DeepSeek 工作区下的两条会话（`900ea42d`「你好」、`7af8fc00`「加载当前文件夹中的机甲文件」），保留当前会话。四项核对全部通过：

| 核对项 | 结果 |
|---|---|
| 回收站条目 | 两条，原始路径指向 `~/.dsh/sessions/--D-DeepSeek--/session-*` |
| 会话目录 | 两个目录已从 `sessions/--D-DeepSeek--/` 消失 |
| `workspace.json` | `sessionIds` 由 3 条降为 1 条，`archivedSessionIds` 为空 |
| `session_projcache.json` | 两条标题条目已删除，保留的会话条目完好 |
| `D:\DeepSeek` | 删除前后文件快照比对完全一致，未被触碰 |

重启 dsh web 后 HTTP 200，侧栏只剩保留的那一条。
