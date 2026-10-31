import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminFirestore } from "@/lib/firebase-admin";
import { prisma } from "@/lib/prisma";
import { signToken, COOKIE_NAME } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { idToken, name } = body;

    if (!idToken || typeof idToken !== "string") {
      return NextResponse.json({ error: "Valid Firebase idToken is required" }, { status: 400 });
    }

    if (!adminAuth) {
      return NextResponse.json({ error: "Firebase Admin is not configured on this server" }, { status: 503 });
    }

    let decoded: any;
    try {
      // First try standard verification
      decoded = await adminAuth.verifyIdToken(idToken);
    } catch (err: any) {
      console.error("[Firebase Token Verification Failure]:", err?.code, err?.message);
      return NextResponse.json(
        {
          error: "Invalid or expired Firebase ID token. Please try signing in again.",
          details: err?.message || String(err),
          code: err?.code,
        },
        { status: 401 }
      );
    }

    const { email, uid, email_verified } = decoded;
    if (!email) {
      return NextResponse.json({ error: "Firebase token does not contain a valid email" }, { status: 400 });
    }

    // Lookup or Provision User in Primary SaaS DB
    let user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    const displayName = name || decoded.name || email.split("@")[0] || "User";

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          name: displayName,
          passwordHash: `FIREBASE_AUTH:${uid}`,
          emailVerified: email_verified ? new Date() : null,
          systemRole: "USER",
        },
      });

      // Also create default workspace and organization if new user
      const slug = `${displayName.toLowerCase().replace(/[^a-z0-9]/g, "")}-${Date.now().toString(36)}`;
      const org = await prisma.organization.create({
        data: {
          name: `${displayName}'s Team`,
          slug,
          ownerId: user.id,
          plan: "FREE",
          members: {
            create: {
              userId: user.id,
              role: "OWNER",
            },
          },
        },
      });

      await prisma.workspace.create({
        data: {
          name: "Default Workspace",
          slug: `${slug}-default`,
          creatorId: user.id,
          organizationId: org.id,
          plan: "STARTER",
          members: {
            create: {
              userId: user.id,
              role: "OWNER",
            },
          },
        },
      });
    }

    // Mirror to Firestore user document for Firestore client integration
    if (adminFirestore) {
      try {
        await adminFirestore.collection("users").doc(user.id).set(
          {
            uid,
            email: user.email,
            name: user.name,
            systemRole: user.systemRole,
            updatedAt: new Date(),
          },
          { merge: true }
        );
      } catch (fsErr) {
        console.warn("[Firestore Sync Warning]:", fsErr);
      }
    }

    // Issue unified session cookie
    const token = signToken({
      userId: user.id,
      email: user.email,
      systemRole: user.systemRole,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        systemRole: user.systemRole,
      },
    });

    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: "Firebase authentication synchronization failed", details: error.message }, { status: 500 });
  }
}
