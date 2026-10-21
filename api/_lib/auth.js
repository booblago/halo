import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { ensureSchema, sql } from "./db.js";

const SESSION_DAYS = 30;
const COOKIE = "halo_session";

export function uid(prefix = "u") {
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
}

export function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(":");
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 64);
  const prev = Buffer.from(hash, "hex");
  if (prev.length !== next.length) return false;
  return timingSafeEqual(prev, next);
}

export function parseCookies(request) {
  const header = request.headers.get("cookie") || "";
  const out = {};
  header.split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i === -1) return;
    const key = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  });
  return out;
}

export function sessionCookie(token, maxAgeSec = SESSION_DAYS * 86400) {
  const secure = process.env.VERCEL ? "; Secure" : "";
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`;
}

export function clearSessionCookie() {
  const secure = process.env.VERCEL ? "; Secure" : "";
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export async function createSession(userId) {
  await ensureSchema();
  const db = sql();
  const token = createHash("sha256").update(randomBytes(32)).digest("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
  await db`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (${token}, ${userId}, ${expires.toISOString()})
  `;
  return token;
}

export async function destroySession(token) {
  if (!token) return;
  await ensureSchema();
  const db = sql();
  await db`DELETE FROM sessions WHERE token = ${token}`;
}

export async function getUserFromRequest(request) {
  await ensureSchema();
  const cookies = parseCookies(request);
  const token = cookies[COOKIE];
  if (!token) return null;
  const db = sql();
  const rows = await db`
    SELECT u.id, u.email, u.name
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ${token}
      AND s.expires_at > NOW()
    LIMIT 1
  `;
  return rows[0] || null;
}
