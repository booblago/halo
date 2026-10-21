import {
  clearSessionCookie,
  destroySession,
  parseCookies,
} from "../_lib/auth.js";
import { json } from "../_lib/http.js";

export async function POST(request) {
  const cookies = parseCookies(request);
  await destroySession(cookies.halo_session);
  return json(
    { ok: true },
    { headers: { "Set-Cookie": clearSessionCookie() } }
  );
}
