import jwt from "jsonwebtoken";

const COOKIE_NAME = "session";
const isProd = process.env.NODE_ENV === "production";

export function signSession(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

export function verifySession(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    // maxAge en segundos (aquí 7 días)
    maxAge: 60 * 60 * 24 * 7,
  };
}

export { COOKIE_NAME };