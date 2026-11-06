import crypto from "node:crypto";

export type SessionUser = {
  userId: string;
  email: string;
  role: string;
  name: string;
};

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be configured with at least 32 characters.");
  }
  return secret;
}

function createSignature(payload: string) {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");
}

export function createSessionToken(user: SessionUser) {
  const payload = Buffer.from(
    JSON.stringify({
      userId: user.userId,
      email: user.email,
      role: user.role,
      name: user.name,
      exp: Date.now() + 1000 * 60 * 60 * 24,
    })
  ).toString("base64url");

  return `${payload}.${createSignature(payload)}`;
}

export function verifySessionToken(token: string): SessionUser | null {
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expectedSignature = createSignature(payload);
  const providedSignature = Buffer.from(signature);
  const expectedSignatureBytes = Buffer.from(expectedSignature);
  if (providedSignature.length !== expectedSignatureBytes.length) return null;
  if (!crypto.timingSafeEqual(providedSignature, expectedSignatureBytes)) return null;

  try {
    const decoded: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      typeof decoded !== "object" ||
      decoded === null ||
      !("userId" in decoded) ||
      !("email" in decoded) ||
      !("role" in decoded) ||
      !("name" in decoded) ||
      !("exp" in decoded) ||
      typeof decoded.userId !== "string" ||
      typeof decoded.email !== "string" ||
      typeof decoded.role !== "string" ||
      typeof decoded.name !== "string" ||
      typeof decoded.exp !== "number" ||
      decoded.exp <= Date.now()
    ) {
      return null;
    }

    return {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      name: decoded.name,
    };
  } catch {
    return null;
  }
}
