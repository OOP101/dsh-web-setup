# dsh-opencode-zen 适配器缺 prepareCall —— 兼容垫片

## 现象

选择 opencode 分组的模型发起对话，运行失败：

```
本轮运行失败 registration.adapter.prepareCall is not a function
```

## 原因

本机 dsh-llm（0.2.x）的适配器契约要求实现：

```ts
prepareCall(provider: string, model: string, signal?: AbortSignal): Promise<PreparedAdapterCall>
// PreparedAdapterCall = { model: LlmResolvedModelInfo, stream(options: GenerateOptions): AsyncIterable<StreamChunk> }
```

即"模型解析 + 流式调用"必须绑定为同一代句柄（保证日志与分发使用同一次注册）。而插件的 `OpenCodeZenAdapter` 按旧接口实现，只有 `resolveModel` 与 `async *stream(options)`，缺少 `prepareCall`。

## 修复

在 `lib/index.js` 的 `OpenCodeZenAdapter` 类内（`async *stream(options)` 之前）插入垫片：

```js
// --- local compatibility shim: dsh-llm (0.2.x) requires prepareCall() ---
async prepareCall(provider, model, signal) {
  const info = await this.resolveModel(provider, model)
  return {
    model: info,
    stream: (options) => this.stream(options),
  }
}
```

语义：复用插件自身的 `resolveModel` 解析模型元数据，`stream` 绑定到类内已有的流式实现，满足"同一代绑定"契约。

## 恢复方式

重装或更新插件后补丁丢失，运行本仓库的 `scripts/apply-zen-patches.mjs` 自动注入。
