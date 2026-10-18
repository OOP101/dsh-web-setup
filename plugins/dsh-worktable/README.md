# dsh-worktable（安装方式适配）

工作台插件，提供 DSH 内的内容工作台界面。

- 上游：`github:Aisland-SJL/dsh-worktable`
- 当前安装版本：`0.4.0`（子包 `01_content`）

## 关键点：根包不是插件

该仓库是多包集合，根目录只是索引与文档，直接安装根包会出现「已安装，未生效」：

| 目录 | 内容 |
|---|---|
| `00_index` | 仅 README 索引 |
| `01_content` | **可安装的插件包**（含 `cordis.patch.yml`、`dsh.plugin.json`） |
| `02_process` | PRD、调研、工作日志 |
| `04_test` | 测试脚本 |

## 正确安装

```sh
# 若之前装过根包，先移除
dsh plugin remove dsh-worktable --profile web

# 安装子包（注意 #path:/01_content）
dsh plugin install "github:Aisland-SJL/dsh-worktable#path:/01_content" --profile web
# 重启 dsh web
```

## 验证

```sh
dsh plugin list --profile web
# 应显示 dsh-worktable@0.4.x，且 profile package.json 的 dsh.profile.bundles 中含 dsh-worktable
```

## 说明

- 本插件不需要代码级适配，因此本目录只有说明文档。
- `#path:/子目录` 是 pnpm 对 git 源子目录的固定写法，适用于所有「仓库里套多个包」的插件。
- 兼容性声明：该版本 `engines.dsh` 标注兼容 `0.1.1-rc.2` / `0.1.2-rc.1` / `0.2.0-rc.2`。
