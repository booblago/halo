import { getUserFromRequest } from "./_lib/auth.js";
import { ensureSchema, sql } from "./_lib/db.js";
import { error, json, readJson } from "./_lib/http.js";

export async function GET(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return error("Sign in required", 401);
    await ensureSchema();
    const db = sql();
    const rows = await db`
      SELECT payload, updated_at FROM user_state WHERE user_id = ${user.id} LIMIT 1
    `;
    return json({
      ok: true,
      state: rows[0]?.payload || null,
      updatedAt: rows[0]?.updated_at || null,
    });
  } catch (err) {
    console.error(err);
    return error("Could not load state", 500);
  }
}

export async function PUT(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return error("Sign in required", 401);
    const body = await readJson(request);
    if (!body?.state || typeof body.state !== "object") {
      return error("Missing state payload");
    }

    await ensureSchema();
    const db = sql();
    await db`
      INSERT INTO user_state (user_id, payload, updated_at)
      VALUES (${user.id}, ${JSON.stringify(body.state)}, NOW())
      ON CONFLICT (user_id) DO UPDATE
      SET payload = EXCLUDED.payload, updated_at = NOW()
    `;
    return json({ ok: true, synced: true });
  } catch (err) {
    console.error(err);
    return error("Could not save state", 500);
  }
}
