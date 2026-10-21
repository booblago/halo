import { createSession, hashPassword, sessionCookie, uid } from "../_lib/auth.js";
import { ensureSchema, sql } from "../_lib/db.js";
import { error, json, readJson } from "../_lib/http.js";

export async function POST(request) {
  try {
    const body = await readJson(request);
    const email = String(body?.email || "")
      .trim()
      .toLowerCase();
    const password = String(body?.password || "");
    const name = String(body?.name || "").trim().slice(0, 40);
    const state = body?.state && typeof body.state === "object" ? body.state : null;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return error("Enter a valid email");
    }
    if (password.length < 6) {
      return error("Password must be at least 6 characters");
    }

    await ensureSchema();
    const db = sql();
    const existing = await db`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
    if (existing.length) {
      return error("An account with this email already exists", 409);
    }

    const id = uid("usr");
    const passwordHash = hashPassword(password);
    await db`
      INSERT INTO users (id, email, password_hash, name)
      VALUES (${id}, ${email}, ${passwordHash}, ${name})
    `;

    if (state) {
      await db`
        INSERT INTO user_state (user_id, payload, updated_at)
        VALUES (${id}, ${JSON.stringify(state)}, NOW())
        ON CONFLICT (user_id) DO UPDATE
        SET payload = EXCLUDED.payload, updated_at = NOW()
      `;
    }

    const token = await createSession(id);
    return json(
      { ok: true, user: { id, email, name } },
      { status: 201, headers: { "Set-Cookie": sessionCookie(token) } }
    );
  } catch (err) {
    console.error(err);
    return error("Could not create account", 500);
  }
}
