#!/usr/bin/env node
// apply-provider-hub-patch.mjs — dsh-provider-hub 客户端插槽本地补丁
//
// 背景：本机 dsh 版本的设置页只暴露 `settings.section` 插槽，而 provider-hub
// 的客户端半把卡片注册到 `settings.models.footer`，插槽不存在时卡片静默不渲染，
// 表现为"设置 → 模型"页看不到「服务商预设」。本脚本把注册目标改为
// `settings.section`（独立一节），幂等可重复执行。
//
// 用法：node apply-provider-hub-patch.mjs [--dir <dsh-provider-hub 包目录>]
// 执行后需重启 dsh web。

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
const dirIdx = args.indexOf('--dir')
const HUB_DIR = dirIdx >= 0
  ? resolve(args[dirIdx + 1])
  : join(homedir(), '.dsh', 'profiles', 'web', 'node_modules', 'dsh-provider-hub')

const CLIENT_JS = join(HUB_DIR, 'src', 'client.js')

if (!existsSync(CLIENT_JS)) {
  console.error(`[x] 未找到 ${CLIENT_JS}，请确认插件已安装，或用 --dir 指定包目录`)
  process.exit(1)
}

let source = readFileSync(CLIENT_JS, 'utf8')

const OLD_BLOCK = `      ctx.slots.inject('settings.models.footer', () =>
        ctx.slots.register(
          {
            name: 'settings.models.footer',
            id: 'provider-hub',
            order: 20,
            locale: NS,
          },
          PresetsCard,
        ),
      )`

const NEW_BLOCK = `      // --- local compatibility patch: this dsh build exposes no
      // \`settings.models.footer\` slot; register the card as its own settings
      // section (\`settings.section\`) instead, which is the slot the official
      // Models page itself uses in this version.
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
      )`

if (source.includes("ctx.slots.inject('settings.section'")) {
  console.log('[ok] 补丁已存在，跳过')
} else if (source.includes(OLD_BLOCK)) {
  source = source.replace(OLD_BLOCK, NEW_BLOCK)
  writeFileSync(CLIENT_JS, source, 'utf8')
  console.log('[ok] 已把注册插槽从 settings.models.footer 改为 settings.section，请重启 dsh web')
} else if (source.includes("ctx.slots.inject('settings.models.footer'")) {
  // 结构有变动但插槽名仍在：做一次最小替换，提示人工复核
  source = source
    .replace("ctx.slots.inject('settings.models.footer'", "ctx.slots.inject('settings.section'")
    .replace("name: 'settings.models.footer'", "name: 'settings.section'")
  if (!source.includes('label: () =>')) {
    source = source.replace("order: 20,", "order: 40,\n            label: () => '服务商预设',")
  }
  writeFileSync(CLIENT_JS, source, 'utf8')
  console.log('[!] 上游代码结构已变化，已按插槽名做最小替换，请人工复核 src/client.js 的注册块')
} else {
  console.error('[x] 未找到预期的注册块，上游代码结构可能已变化，请人工检查 src/client.js')
  process.exit(1)
}
