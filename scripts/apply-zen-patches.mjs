#!/usr/bin/env node
// apply-zen-patches.mjs — dsh-opencode-zen 本地补丁一键恢复 + 免费模型清单同步
//
// 做三件事（均幂等，可重复执行）：
//   1. 若包内缺 cordis.patch.yml（上游 GitHub 包遗漏），补写标准 insert 条目；
//   2. 若 lib/index.js 的 OpenCodeZenAdapter 缺 prepareCall（dsh-llm 0.2.x 接口要求），注入垫片；
//   3. 从上游拉取当前免费模型清单，重写 lib/index.js 的 MODELS 数组。
//
// 用法：
//   node apply-zen-patches.mjs [--dir <dsh-opencode-zen 包目录>]
//   默认目录：%USERPROFILE%\.dsh\profiles\web\node_modules\dsh-opencode-zen
//
// 执行完成后需重启 dsh web 生效。

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

// ---------- 参数 ----------
const args = process.argv.slice(2)
const dirIdx = args.indexOf('--dir')
const ZEN_DIR = dirIdx >= 0
  ? resolve(args[dirIdx + 1])
  : join(homedir(), '.dsh', 'profiles', 'web', 'node_modules', 'dsh-opencode-zen')

const INDEX_JS = join(ZEN_DIR, 'lib', 'index.js')
const PATCH_YML = join(ZEN_DIR, 'cordis.patch.yml')
const UPSTREAM_MODELS_URL = 'https://opencode.ai/zen/v1/models'
const UPSTREAM_KEY = 'public'
const UPSTREAM_UA = 'opencode/1.18.18 ai-sdk/provider-utils/4.0.23 runtime/bun/1.3.14'

if (!existsSync(INDEX_JS)) {
  console.error(`[x] 未找到 ${INDEX_JS}，请确认插件已安装，或用 --dir 指定包目录`)
  process.exit(1)
}

let indexJs = readFileSync(INDEX_JS, 'utf8')
let changed = false

// ---------- 1. 补写 cordis.patch.yml ----------
const PATCH_CONTENT = `# dsh-opencode-zen bundle patch — recreated locally (missing from the upstream git package).
# The node half registers the opencode adapter via ctx.llm.registerAdapter.
- insert:
    - id: dsh-opencode-zen
      name: 'dsh-opencode-zen'
`

if (!existsSync(PATCH_YML)) {
  writeFileSync(PATCH_YML, PATCH_CONTENT, 'utf8')
  console.log('[1/3] 已补写缺失的 cordis.patch.yml')
  changed = true
} else {
  console.log('[1/3] cordis.patch.yml 已存在，跳过')
}

// ---------- 2. 注入 prepareCall 垫片 ----------
const SHIM_ANCHOR = '  async *stream(options) {'
const SHIM = `  // --- local compatibility shim: dsh-llm (0.2.x) requires prepareCall() ---
  async prepareCall(provider, model, signal) {
    const info = await this.resolveModel(provider, model)
    return {
      model: info,
      stream: (options) => this.stream(options),
    }
  }

  async *stream(options) {`

if (!indexJs.includes('prepareCall')) {
  if (!indexJs.includes(SHIM_ANCHOR)) {
    console.error('[2/3] [x] 未找到注入锚点（async *stream），lib/index.js 结构可能已变化，请手动检查')
    process.exit(1)
  }
  indexJs = indexJs.replace(SHIM_ANCHOR, SHIM)
  console.log('[2/3] 已注入 prepareCall 兼容垫片')
  changed = true
} else {
  console.log('[2/3] prepareCall 已存在，跳过')
}

// ---------- 3. 同步最新免费模型清单 ----------
const FREE_SUFFIX = '-free'
const EXTRA_FREE_IDS = ['big-pickle'] // 非 -free 后缀但在免费档开放的模型

async function fetchUpstreamModels() {
  const res = await fetch(UPSTREAM_MODELS_URL, {
    headers: { Authorization: `Bearer ${UPSTREAM_KEY}`, 'User-Agent': UPSTREAM_UA },
  })
  if (!res.ok) throw new Error(`上游 /models 请求失败：HTTP ${res.status}`)
  const json = await res.json()
  return json.data.map((m) => m.id).filter(
    (id) => id.endsWith(FREE_SUFFIX) || EXTRA_FREE_IDS.includes(id),
  )
}

function buildModelsJs(ids) {
  const known = {
    'deepseek-v4.1-flash-free': { name: 'DeepSeek V4.1 Flash (Free)', contextWindow: 200000, description: 'OpenCode Zen 免费档：推理 + 工具调用，日常主力' },
    'mimo-v2.6-flash-free': { name: 'MiMo 2.6 Flash (Free)', contextWindow: 200000, description: 'OpenCode Zen 免费档（小米）' },
    'glm-5.3-flash-free': { name: 'GLM 5.3 Flash (Free)', contextWindow: 200000, description: 'OpenCode Zen 免费档（智谱）' },
    'longcat-2.5-preview-free': { name: 'LongCat 2.5 Preview (Free)', contextWindow: 200000, description: 'OpenCode Zen 免费档（美团）' },
    'nemotron-3.5-super-vl-free': { name: 'Nemotron 3.5 Super VL (Free)', contextWindow: 1000000, description: 'OpenCode Zen 免费档（NVIDIA，支持视觉）' },
    'nemotron-3.5-lightning-free': { name: 'Nemotron 3.5 Lightning (Free)', contextWindow: 131072, description: 'OpenCode Zen 免费档（NVIDIA）' },
    'big-pickle': { name: 'Big Pickle (Free)', contextWindow: 200000, description: 'OpenCode Zen 免费档' },
  }
  const lines = ids.map((id) => {
    const k = known[id]
    if (k) {
      return `  { id: '${id}', name: '${k.name}', contextWindow: ${k.contextWindow}, description: '${k.description}' },`
    }
    return `  { id: '${id}', name: '${id}', contextWindow: 200000, description: 'OpenCode Zen 免费档' },`
  })
  return `const MODELS = [\n${lines.join('\n')}\n]`
}

try {
  const ids = await fetchUpstreamModels()
  if (ids.length === 0) throw new Error('上游返回的免费模型列表为空，保守起见不修改 MODELS')
  const newBlock = buildModelsJs(ids)
  const re = /const MODELS = \[[\s\S]*?\n\]/
  if (!re.test(indexJs)) {
    console.error('[3/3] [x] 未找到 MODELS 数组，lib/index.js 结构可能已变化，请手动检查')
    process.exit(1)
  }
  const current = indexJs.match(re)[0]
  if (current !== newBlock) {
    indexJs = indexJs.replace(re, newBlock)
    console.log(`[3/3] MODELS 已同步为上游 ${ids.length} 个免费模型：\n      ${ids.join(', ')}`)
    changed = true
  } else {
    console.log('[3/3] MODELS 已是最新，跳过')
  }
} catch (err) {
  console.warn(`[3/3] [!] 同步模型清单失败（${err.message}），跳过此步；前两步补丁不受影响`)
}

// ---------- 落盘 ----------
if (changed) {
  writeFileSync(INDEX_JS, indexJs, 'utf8')
  console.log('\n[ok] 补丁已写入，请重启 dsh web 生效')
} else {
  console.log('\n[ok] 无需变更')
}
