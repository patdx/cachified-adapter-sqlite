import { type Cache, totalTtl } from '@epic-web/cachified'
import type { Client } from '@libsql/client'

type KvCacheRow = {
  key: string
  value: string
  metadata: string
  expires_at: number | null
  created_at: number | null
}

const initSql = [
  `create table if not exists kv_cache (
    key text primary key,
    value text not null,
    metadata text not null,
    expires_at integer,
    created_at integer
  ) strict;`,
  `create index if not exists kv_cache_expires_at on kv_cache(expires_at);`,
  `create index if not exists kv_cache_created_at on kv_cache(created_at);`,
]

export async function initDb(db: Client) {
  await db.batch(initSql.map((sql) => ({ sql, args: [] })))
}

export function createCache(db: Client): Cache {
  return {
    name: 'cachified-adapter-sqlite',
    set(key, value) {
      const ttl = totalTtl(value?.metadata)
      const created_at = value.metadata.createdTime
      const expires_at =
        ttl > 0 && ttl < Infinity && typeof created_at === 'number'
          ? (created_at + ttl)
          : null

      return db.execute({
        sql:
          `insert or replace into kv_cache (key, value, metadata, expires_at, created_at)
                                    values (?, ?, ?, ?, ?)`,
        args: [
          key,
          JSON.stringify(value.value),
          JSON.stringify(value?.metadata),
          expires_at,
          created_at,
        ],
      })
    },
    async get(key) {
      const rows = await db.execute({
        sql: 'SELECT value, metadata FROM kv_cache WHERE key = ?',
        args: [key],
      })

      const row = rows.rows?.[0] as unknown as KvCacheRow | undefined

      if (!row) return null

      return {
        value: JSON.parse(row.value),
        metadata: JSON.parse(row.metadata),
      }
    },
    delete(key) {
      return db.execute({
        sql: 'DELETE FROM kv_cache WHERE key = ?',
        args: [key],
      })
    },
  }
}

export async function clearExpired(db: Client) {
  await db.execute({
    sql: 'DELETE FROM kv_cache WHERE expires_at < ?',
    args: [Date.now()],
  })
}
