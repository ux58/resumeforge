import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/** 惰性单例：构建期不连库，请求期复用连接 */
let client: postgres.Sql | null = null;

export function getDb() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL 未配置");
    client = postgres(url, { max: 5, idle_timeout: 20, connect_timeout: 10 });
  }
  return drizzle(client, { schema });
}

export { schema };
