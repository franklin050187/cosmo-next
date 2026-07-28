import jwt from "jsonwebtoken";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET env var is required");
  return secret;
}

const TOKEN_EXPIRY = "30d";

export interface UserPayload {
  id: string;
  username: string;
  avatar: string | null;
  guild?: string;
}

export interface TokenPayload {
  app?: string;
  user?: UserPayload;
}

export function generateToken(): string {
  return jwt.sign({ app: "cosmo-client" }, getJwtSecret(), {
    expiresIn: TOKEN_EXPIRY,
  });
}

export function generateUserToken(user: UserPayload): string {
  return jwt.sign({ user }, getJwtSecret(), { expiresIn: TOKEN_EXPIRY });
}

export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, getJwtSecret()) as TokenPayload;
}

export function getTokenFromRequest(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7);
}

export function verifyRequest(req: Request): TokenPayload | null {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}
