import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = process.env.ZP_DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');
const file = path.join(dir, 'login-log.jsonl');
const MAX_ENTRIES = 1000;
const MAX_BYTES = 2 * 1024 * 1024;

function load() {
  try {
    const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
    return lines.slice(-MAX_ENTRIES).map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);
  } catch {
    return [];
  }
}

const entries = load();

function rotateIfNeeded() {
  try {
    if (fs.statSync(file).size <= MAX_BYTES) return;
    const keep = entries.slice(-600);
    fs.writeFileSync(file, keep.map((entry) => JSON.stringify(entry)).join('\n') + '\n');
  } catch {
    // 忽略日志轮转失败
  }
}

export function addLoginLog(entry) {
  const record = {
    at: new Date().toISOString(),
    username: String(entry.username || '').slice(0, 16),
    accountId: entry.accountId || '',
    ip: String(entry.ip || '').slice(0, 64),
    ua: String(entry.ua || '').slice(0, 140),
    result: entry.result || 'success',
    reason: String(entry.reason || '').slice(0, 60),
  };
  entries.push(record);
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(file, JSON.stringify(record) + '\n');
    rotateIfNeeded();
  } catch {
    // 日志写入失败不影响登录
  }
}

export function listLoginLogs(limit = 80) {
  const count = Math.max(1, Math.min(500, Number(limit) || 80));
  return entries.slice(-count).reverse();
}
