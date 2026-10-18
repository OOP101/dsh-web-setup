# dsh-provider-hub 的「服务商预设」卡片不显示 —— 插槽名不匹配

## 现象

插件安装成功、服务端接口正常（`/dsh-provider-hub/state` 返回 50 家预设），但 **设置 → 模型** 页面底部看不到「服务商预设」卡片，界面上只有 DeepSeek 一行和「添加提供方 / 添加自定义提供方」两个按钮。

## 根因

插件客户端半把卡片注册到一个固定插槽：

```js
ctx.slots.inject('settings.models.footer', () => ctx.slots.register({ name: 'settings.models.footer', ... }, PresetsCard))
```

而本机 dsh 版本的设置页只挂载 `settings.section` 与 `settings.onboarding` 两个插槽（在 `dsh-client-ui-settings-models` 中可见）：

```js
ctx.slots.inject("settings.section", () => ctx.slots.register({
  name: "settings.section", id: "models", order: 10, label: () => t("nav"), inject: injected,
}, ModelsSection))
```

插槽名不存在时，注册被静默忽略——没有报错、日志也无记录，所以表现为"装好了但看不见"。

## 修复

把注册目标改为 `settings.section`，并补上该插槽要求的 `label`（导航项名称）：

```js
ctx.slots.inject('settings.section', () =>
  ctx.slots.register(
    {
      name: 'settings.section',
      id: 'provider-hub',
      order: 40,
      label: () => '服务商预设',
      locale: NS,
    },
    PresetsCard,
  ),
)
```

效果：设置页左侧多出一节「服务商预设」，点进去就是完整的 50 家预设卡片，用法与插件 README 描述一致——选服务商、粘贴 Key、点启用，热注册生效。

## 恢复方式

插件更新或重装会覆盖 `src/client.js`，运行本仓库的脚本恢复：

```sh
node scripts/apply-provider-hub-patch.mjs
```

## 备选方案（无需插件）

如果只是要接入腾讯混元、火山方舟、小米 MiMo，用「添加自定义提供方」手工填写同样可行，且免费赠送额度走的是同一套官方接口。逐字段取值见 `docs/provider-fill-guide.md`。

区别只在于：手工填写要自己保证地址、协议、模型 ID 正确；插件预设是点一下就把这些写好。
