import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { prisma } from "./prisma";

const JWT_SECRET = process.env.JWT_SECRET || "pulseflow-default-secret-change-in-prod";
const COOKIE_NAME = "pulseflow_session";

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  console.warn("[SECURITY ALERT] JWT_SECRET environment variable is unset in production environment!");
}

export interface SessionPayload {
  userId: string;
  email: string;
  systemRole: string;
  iat?: number;
  exp?: number;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: { userId: string; email: string; systemRole: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSessionUser(req?: NextRequest): Promise<{
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  systemRole: string;
} | null> {
  try {
    let token: string | undefined;

    if (req) {
      const authHeader = req.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7).trim();
      }
      if (!token) {
        token = req.cookies.get(COOKIE_NAME)?.value;
      }
    } else {
      const cookieStore = await cookies();
      token = cookieStore.get(COOKIE_NAME)?.value;
    }

    if (!token) return null;

    let targetUserId: string | null = null;
    let targetEmail: string | null = null;

    // 1. Try standard HMAC JWT token
    const decodedJwt = verifyToken(token);
    if (decodedJwt && decodedJwt.userId) {
      targetUserId = decodedJwt.userId;
    } else {
      // 2. Try Firebase ID Token verification via Admin SDK
      try {
        const { verifyFirebaseIdToken } = await import("./firebase-admin");
        const decodedFirebase = await verifyFirebaseIdToken(token);
        if (decodedFirebase && decodedFirebase.uid) {
          targetEmail = decodedFirebase.email || null;
        }
      } catch (fbErr) {
        // Fall through
      }
    }

    if (!targetUserId && !targetEmail) return null;

    const user = await prisma.user.findFirst({
      where: targetUserId ? { id: targetUserId } : { email: targetEmail! },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        systemRole: true,
        suspended: true,
      },
    });

    if (!user || user.suspended) return null;

    return user;
  } catch (error) {
    console.error("Session verification error:", error);
    return null;
  }
}

export { COOKIE_NAME };
