import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { ensureSchema, sql } from "../api/_lib/db.js";
import { hashPassword, uid } from "../api/_lib/auth.js";

function loadEnv() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv();
await ensureSchema();
const db = sql();
const id = uid("usr");
const email = `demo_${Date.now()}@halo.test`;
const payload = {
  settings: { hourlyRate: 90 },
  blocks: [],
  sessions: [],
  mixer: { drift: 1, rain: 2, room: 3 },
};

await db`
  INSERT INTO users (id, email, password_hash, name)
  VALUES (${id}, ${email}, ${hashPassword("demo123")}, ${"Demo"})
`;
await db`
  INSERT INTO user_state (user_id, payload)
  VALUES (${id}, ${JSON.stringify(payload)})
`;
const rows = await db`
  SELECT u.email, s.payload
  FROM users u
  JOIN user_state s ON s.user_id = u.id
  WHERE u.id = ${id}
`;
console.log(
  "ok",
  rows[0].email,
  typeof rows[0].payload,
  rows[0].payload?.settings?.hourlyRate
);
await db`DELETE FROM users WHERE id = ${id}`;
