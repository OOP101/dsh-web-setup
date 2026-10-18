#!/usr/bin/env node
// delete-session.mjs — DSH 会话一键删除工具（Windows）
//
// 做两件事：
//   1. 把会话目录移入 Windows 回收站（可还原，不是永久抹除）；
//   2. 从工作区记账（storages/workspace.json）与投影缓存中清理该会话的 id，
//      避免侧栏残留空行、避免归档集合里留下已不存在的 id。
//
// 用法：
//   node session-cleanup/delete-session.mjs --list
//       列出全部工作区与会话（含标题、归档状态、目录是否存在）
//
//   node session-cleanup/delete-session.mjs <id 或 id 片段> [更多 id ...]
//       删除指定会话；可以只给 uuid 前 8 位、末尾几位或任意唯一片段
//
//   node session-cleanup/delete-session.mjs --list --home D:\other\.dsh
//       指定 DSH_HOME（默认 %USERPROFILE%\.dsh 或环境变量 DSH_HOME）
//
// 前提：dsh web 必须处于停止状态。运行中时脚本会拒绝执行——运行中的进程会把
// 内存里的工作区状态写回磁盘，覆盖掉这里的清理结果。
//
// 退出码：0 成功；1 参数/环境错误；2 存在无法处理的条目（其余条目已处理）。

import { existsSync, readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { connect } from 'node:net'
import { execFileSync } from 'node:child_process'

const argv = process.argv.slice(2)
const opts = { list: false, home: null, ids: [] }
for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i]
  if (a === '--list' || a === '-l') opts.list = true
  else if (a === '--home') { opts.home = argv[i + 1]; i += 1 }
  else if (a === '--help' || a === '-h') { printHelp(); process.exit(0) }
  else if (a.startsWith('-')) { console.error(`未知参数：${a}`); process.exit(1) }
  else opts.ids.push(a)
}

function printHelp() {
  console.log(`DSH 会话一键删除（移入回收站）

  node session-cleanup/delete-session.mjs --list            列出会话
  node session-cleanup/delete-session.mjs <id 或片段> ...   删除指定会话（uuid 前 8 位即可）
  --home <目录>                                             指定 DSH_HOME

删除前请先停止 dsh web。`)
}

const DSH_HOME = resolve(opts.home ? opts.home : (process.env.DSH_HOME || join(homedir(), '.dsh')))
const SESSIONS_DIR = join(DSH_HOME, 'sessions')
const WORKSPACE_JSON = join(DSH_HOME, 'storages', 'workspace.json')
const PROJCACHE_JSON = join(DSH_HOME, 'storages', 'session_projcache.json')

for (const p of [SESSIONS_DIR, WORKSPACE_JSON]) {
  if (!existsSync(p)) {
    console.error(`找不到 ${p}，请确认 --home 指向正确的 DSH_HOME`)
    process.exit(1)
  }
}

// ---------- 读取状态 ----------

const workspaceStore = JSON.parse(readFileSync(WORKSPACE_JSON, 'utf8'))
const archived = new Set(workspaceStore.global?.archivedSessionIds ?? [])
const workspaces = Object.entries(workspaceStore.tables?.workspaces ?? {})

let projCache = null
if (existsSync(PROJCACHE_JSON)) {
  try { projCache = JSON.parse(readFileSync(PROJCACHE_JSON, 'utf8')) } catch { projCache = null }
}

function titleOf(sessionId) {
  const raw = projCache?.tables?.sessions?.[sessionId]?.rows?.title
  const v = raw && typeof raw === 'object' ? raw.val : raw
  return typeof v === 'string' && v.trim() ? v.trim() : '(无标题)'
}

/** 在 sessions/<workspace-key>/ 下定位会话目录。 */
function dirOf(sessionId) {
  if (!existsSync(SESSIONS_DIR)) return null
  for (const key of readdirSync(SESSIONS_DIR)) {
    const dir = join(SESSIONS_DIR, key, sessionId)
    if (existsSync(dir) && statSync(dir).isDirectory()) return dir
  }
  return null
}

function rows() {
  const out = []
  for (const [workspaceId, ws] of workspaces) {
    for (const id of ws.sessionIds ?? []) {
      out.push({
        workspaceId,
        workspaceTitle: ws.title ?? workspaceId,
        workspacePath: ws.path ?? '',
        id,
        title: titleOf(id),
        archived: archived.has(id),
        hasDir: dirOf(id) !== null,
      })
    }
  }
  return out
}

// ---------- 运行状态检查 ----------

function serverRunning() {
  return new Promise((resolvePromise) => {
    const socket = connect({ host: '127.0.0.1', port: 3080 })
    const done = (running) => { socket.destroy(); resolvePromise(running) }
    socket.setTimeout(700)
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
  })
}

// ---------- 回收站删除 ----------

function toRecycleBin(target) {
  const escaped = target.replace(/'/g, "''")
  const script = [
    'Add-Type -AssemblyName Microsoft.VisualBasic',
    `[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory('${escaped}','OnlyErrorDialogs','SendToRecycleBin')`,
  ].join('; ')
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { stdio: 'pipe' })
}

// ---------- 主流程 ----------

if (!opts.list && opts.ids.length === 0) { printHelp(); process.exit(1) }

// --list 只读，不要求停服务；删除才需要独占
if (opts.list) {
  const all = rows()
  if (all.length === 0) { console.log('没有会话。'); process.exit(0) }
  console.log(`DSH_HOME: ${DSH_HOME}\n`)
  for (const [workspaceId, ws] of workspaces) {
    const list = all.filter((r) => r.workspaceId === workspaceId)
    console.log(`■ ${ws.title ?? workspaceId}  (${ws.path ?? ''})  共 ${list.length} 个会话`)
    for (const r of list) {
      const marks = [r.archived ? '已归档' : '正常', r.hasDir ? '目录在' : '目录缺失'].join(' / ')
      const short = r.id.replace(/^session-/, '').slice(0, 8)
      console.log(`  ${short}  ${r.title}   [${marks}]`)
      console.log(`            ${r.id}`)
    }
    console.log('')
  }
  process.exit(0)
}

if (await serverRunning()) {
  console.error('dsh web 正在运行（127.0.0.1:3080 可连接）。')
  console.error('请先停止服务再执行（否则运行中的进程会把内存状态写回磁盘，覆盖清理结果）：')
  console.error('  任务管理器结束占用 3080 的 node.exe，或运行 ~/.dsh/restart-web.ps1 前先手动停止')
  process.exit(1)
}

// 删除：把每个参数解析成唯一会话 id
const all = rows()

/**
 * 把用户给的片段解析成候选会话。
 * 顺序：完整 id → 视为 uuid 前缀 → 视为 uuid 后缀 → 任意包含。
 * 任一层命中即停，避免「前 8 位」这种最自然的写法反而匹配不到。
 */
function candidates(q) {
  const exact = all.filter((r) => r.id === q)
  if (exact.length > 0) return exact
  const withPrefix = q.startsWith('session-') ? q : `session-${q}`
  const byPrefix = all.filter((r) => r.id.startsWith(withPrefix))
  if (byPrefix.length > 0) return byPrefix
  const bySuffix = all.filter((r) => r.id.endsWith(q))
  if (bySuffix.length > 0) return bySuffix
  return all.filter((r) => r.id.includes(q))
}

const resolved = []
let unresolved = 0
for (const raw of opts.ids) {
  const q = raw.trim()
  const hits = candidates(q)
  if (hits.length === 1) { resolved.push(hits[0]); continue }
  if (hits.length > 1) {
    console.error(`[跳过] ${q} 匹配到多个会话，请给出更长的 id：`)
    for (const h of hits) console.error(`         ${h.id}  ${h.title}`)
    unresolved += 1
    continue
  }
  console.error(`[跳过] ${q} 未在工作区记账中找到`)
  unresolved += 1
}

if (resolved.length === 0) {
  console.error('没有可删除的会话。')
  process.exit(1)
}

let failed = 0
const deleted = []
for (const target of resolved) {
  try {
    const dir = dirOf(target.id)
    if (dir) {
      toRecycleBin(dir)
      console.log(`[回收站] ${target.id}  ${target.title}`)
    } else {
      console.log(`[无目录] ${target.id}  仅清理记账（目录已不存在）`)
    }
    deleted.push(target.id)
  } catch (error) {
    console.error(`[失败] ${target.id}：${error.message}`)
    failed += 1
  }
}

// 清理记账与投影缓存（先改内存对象，最后一次写盘）
if (deleted.length > 0) {
  const set = new Set(deleted)
  for (const [, ws] of Object.entries(workspaceStore.tables?.workspaces ?? {})) {
    if (Array.isArray(ws.sessionIds)) ws.sessionIds = ws.sessionIds.filter((id) => !set.has(id))
  }
  workspaceStore.global.archivedSessionIds = (workspaceStore.global.archivedSessionIds ?? []).filter((id) => !set.has(id))
  writeFileSync(WORKSPACE_JSON, JSON.stringify(workspaceStore, null, 2), 'utf8')

  if (projCache?.tables?.sessions) {
    for (const id of deleted) delete projCache.tables.sessions[id]
    writeFileSync(PROJCACHE_JSON, JSON.stringify(projCache), 'utf8')
  }

  console.log(`\n已处理 ${deleted.length} 个会话，工作区记账已同步更新。`)
  console.log('启动 dsh web 后侧栏即不再显示这些会话；未清空回收站前可从回收站还原。')
}

if (failed > 0 || unresolved > 0) process.exit(2)
