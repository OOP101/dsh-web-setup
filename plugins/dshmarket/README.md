# dshmarket（插件市场）

在 DSH 内部提供可视化插件市场：浏览、搜索、一键安装社区插件。

- 来源：`dshmarket`（npm，作者 fkysly）
- 当前安装版本：`1.66.x`

## 安装

```sh
dsh plugin install dshmarket --profile web
# 重启 dsh web
```

## 使用

设置 → **插件市场**，站内搜索并安装插件。安装后仍需重启 dsh web 才能加载插件层（插件代码在启动时组合）。

## 说明

- 本插件不需要代码级适配，本目录只有说明文档。
- 市场只负责"发现与安装"，不保证插件与当前 dsh 版本兼容；兼容性问题见各插件目录的 README（如 `dsh-opencode-zen`、`better-dsh-session-deletetool`）。
- 备选方案：`@noob-stupid/dsh-plugin-console` 内置多源市场，并带框架升级门控与失败自动回滚，适合需要版本安全性的场景。
