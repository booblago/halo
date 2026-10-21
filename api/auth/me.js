import { getUserFromRequest } from "../_lib/auth.js";
import { ensureSchema, sql } from "../_lib/db.js";
import { error, json } from "../_lib/http.js";

export async function GET(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return json({ ok: true, user: null, state: null });
    }
    await ensureSchema();
    const db = sql();
    const rows = await db`
      SELECT payload FROM user_state WHERE user_id = ${user.id} LIMIT 1
    `;
    return json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name },
      state: rows[0]?.payload || null,
    });
  } catch (err) {
    console.error(err);
    return error("Could not load session", 500);
  }
}
