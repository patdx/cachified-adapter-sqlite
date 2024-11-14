import { createClient } from '@libsql/client/node'
import type { Client } from '@libsql/client/web'
import { assertSnapshot } from '@std/testing/snapshot'
import { FakeTime } from '@std/testing/time'
import { createCache, initDb } from './main.ts'
import { cachified, verboseReporter } from '@epic-web/cachified'

const db = createClient({
	url: ':memory:',
})

Deno.test('init db', async (ctx) => {
	using time = new FakeTime(1000000)
	await initDb(db)

	await assertSnapshot(ctx, await checkSchema(db))

	const cache = createCache(db)

	await cachified({
		cache,
		key: 'hello',
		getFreshValue: async () => 'hello',
		ttl: 1000,
		swr: 1000,
	}, verboseReporter())

	const metadata = await db.execute({
		sql: `select value, metadata from kv_cache where key = ?`,
		args: ['hello'],
	})

	await assertSnapshot(ctx, metadata)
})

async function checkSchema(db: Client) {
	const result = await db.execute({
		sql: `select * from sqlite_schema`,
		args: [],
	})

	return result
}
