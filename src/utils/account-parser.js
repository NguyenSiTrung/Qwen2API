/**
 * 共用账号行解析器
 * 同时被 ENV ACCOUNTS 加载（utils/data-persistence.js）和
 * 后台批量添加（routes/accounts.js）复用，
 * 保证两条入口对账号格式与代理 URL 的解析行为完全一致。
 *
 * 支持的输入格式（向后兼容）：
 *   email:password                 — 旧格式
 *   email:password|proxy_url       — 新格式，附带账号级代理
 *
 * 注意：使用 indexOf 而非 split，避免密码中包含 ':' 时把后半截截断
 */

/**
 * 解析单行账号文本
 * @param {string} line - 单行原始文本
 * @returns {{ email: string, password: string, proxy: string|null } | null} 解析失败返回 null
 */
const parseAccountLine = (line) => {
  if (typeof line !== 'string') return null
  const trimmed = line.trim()
  if (!trimmed) return null

  // 先按第一个 '|' 切出可选 proxy（proxy 部分自身可能含有 '|'，例如 query 参数极少见，这里按首个分隔）
  const pipeIdx = trimmed.indexOf('|')
  const credentials = pipeIdx === -1 ? trimmed : trimmed.slice(0, pipeIdx)
  const proxyRaw = pipeIdx === -1 ? '' : trimmed.slice(pipeIdx + 1)
  const proxy = proxyRaw.trim() || null

  // credentials 部分按第一个 ':' 切分，保留密码中可能存在的 ':'
  const colonIdx = credentials.indexOf(':')
  if (colonIdx === -1) return null

  const email = credentials.slice(0, colonIdx).trim()
  const password = credentials.slice(colonIdx + 1).trim()

  if (!email || !password) return null

  return { email, password, proxy }
}

/**
 * 判断一个 chunk 是否代表一个新账号条目的开头
 * @param {string} str
 * @returns {boolean}
 */
const isNewAccountEntry = (str) => {
  if (!str) return false
  const trimmed = str.trim()
  const pipeIdx = trimmed.indexOf('|')
  const creds = pipeIdx === -1 ? trimmed : trimmed.slice(0, pipeIdx)
  const colonIdx = creds.indexOf(':')
  if (colonIdx === -1) return false
  const potentialEmail = creds.slice(0, colonIdx).trim()
  return potentialEmail.length > 0 && !/\s/.test(potentialEmail) && !/[;,]/.test(potentialEmail)
}

/**
 * 将完整的 ACCOUNTS 环境变量或多行账号文本智能切分成独立的账号条目字符串数组
 * 能够智能识别密码中包含逗号 (,) 或分号 (;) 的情况
 * @param {string} rawText
 * @returns {string[]}
 */
const splitAccountEntries = (rawText) => {
  if (typeof rawText !== 'string' || !rawText.trim()) return []

  const lines = rawText
    .replace(/\r/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)

  const entries = []

  for (const line of lines) {
    if (!line.includes(',') && !line.includes(';')) {
      entries.push(line)
      continue
    }

    const chunks = line.split(/([,;])/)
    let currentEntry = ''

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      if (chunk === ',' || chunk === ';') continue

      if (!currentEntry) {
        currentEntry = chunk
      } else if (isNewAccountEntry(chunk)) {
        entries.push(currentEntry)
        currentEntry = chunk
      } else {
        const delim = chunks[i - 1] || ','
        currentEntry += delim + chunk
      }
    }

    if (currentEntry) {
      entries.push(currentEntry)
    }
  }

  return entries
}

/**
 * 从 ACCOUNTS 环境变量解析所有账号结构数组
 * @param {string} envAccounts
 * @returns {Array<{ email: string, password: string, proxy: string|null, token: null, expires: null }>}
 */
const parseAccountsEnv = (envAccounts) => {
  const rawEntries = splitAccountEntries(envAccounts)
  const accounts = []

  for (const item of rawEntries) {
    const parsed = parseAccountLine(item)
    if (parsed) {
      accounts.push({ ...parsed, token: null, expires: null })
    }
  }

  return accounts
}

module.exports = {
  parseAccountLine,
  isNewAccountEntry,
  splitAccountEntries,
  parseAccountsEnv
}

