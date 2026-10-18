# dsh-opencode-zen 缺少声明的补丁文件 —— 补写内容

## 现象

安装 `github:xiaozhe7772222/dsh-opencode-zen` 后，dsh web 启动即崩溃：

```
Error: dsh: failed to read overlay C:\Users\JJY\.dsh\profiles\web\node_modules\dsh-opencode-zen\cordis.patch.yml:
Error: ENOENT: no such file or directory
```

## 原因

插件的 package.json 声明了 bundle 补丁：

```json
"dsh": {
  "bundle": {
    "patch": "./cordis.patch.yml"
  }
}
```

但上游 GitHub 包内并未包含该文件，dsh 组合 profile 层时读取失败，直接中断启动。

## 修复

在插件包根目录（`node_modules/dsh-opencode-zen/`）创建 `cordis.patch.yml`，内容如下（与 dsh-provider-hub 的标准格式一致）：

```yaml
# dsh-opencode-zen bundle patch — recreated locally (missing from the upstream git package).
# The node half registers the opencode adapter via ctx.llm.registerAdapter.
- insert:
    - id: dsh-opencode-zen
      name: 'dsh-opencode-zen'
```

要点：`name` 必须是**裸包名**——客户端模块扫描器按包说明符解析 `<name>/package.json`，写成子路径会被判定为"非客户端包"而静默不加载。

## 恢复方式

重装或更新插件后此文件会被覆盖丢失，运行本仓库的 `scripts/apply-zen-patches.mjs` 自动补写。
