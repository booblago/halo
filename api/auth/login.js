import {
  createSession,
  sessionCookie,
  verifyPassword,
} from "../_lib/auth.js";
import { ensureSchema, sql } from "../_lib/db.js";
import { error, json, readJson } from "../_lib/http.js";

export async function POST(request) {
  try {
    const body = await readJson(request);
    const email = String(body?.email || "")
      .trim()
      .toLowerCase();
    const password = String(body?.password || "");

    if (!email || !password) {
      return error("Email and password are required");
    }

    await ensureSchema();
    const db = sql();
    const rows = await db`
      SELECT id, email, name, password_hash
      FROM users
      WHERE email = ${email}
      LIMIT 1
    `;
    const user = rows[0];
    if (!user || !verifyPassword(password, user.password_hash)) {
      return error("Invalid email or password", 401);
    }

    const token = await createSession(user.id);
    const stateRows = await db`
      SELECT payload FROM user_state WHERE user_id = ${user.id} LIMIT 1
    `;

    return json(
      {
        ok: true,
        user: { id: user.id, email: user.email, name: user.name },
        state: stateRows[0]?.payload || null,
      },
      { headers: { "Set-Cookie": sessionCookie(token) } }
    );
  } catch (err) {
    console.error(err);
    return error("Could not sign in", 500);
  }
}
