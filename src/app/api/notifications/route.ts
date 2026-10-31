import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Session required" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId");
    const filter = searchParams.get("filter") || "ALL"; // ALL, UNREAD, READ
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    // Build tenancy and ownership filter: user only sees their own or broadcast workspace notifications
    const where: any = {
      OR: [
        { userId: session.id },
        { userId: null },
      ],
    };

    if (workspaceId) {
      // Verify user has access to requested workspace
      const membership = await prisma.membership.findUnique({
        where: {
          userId_workspaceId: {
            userId: session.id,
            workspaceId,
          },
        },
      });
      if (!membership) {
        return NextResponse.json({ error: "Forbidden: No access to this workspace" }, { status: 403 });
      }
      where.workspaceId = workspaceId;
    } else {
      // Scope to workspaces user belongs to
      const userMemberships = await prisma.membership.findMany({
        where: { userId: session.id },
        select: { workspaceId: true },
      });
      const wsIds = userMemberships.map((m) => m.workspaceId);
      where.workspaceId = { in: wsIds };
    }

    if (filter === "UNREAD") {
      where.read = false;
    } else if (filter === "READ") {
      where.read = true;
    }

    const [total, unreadCount, notifications] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: {
          ...where,
          read: false,
        },
      }),
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          workspace: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),
    ]);

    return NextResponse.json({
      notifications: notifications.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        read: n.read,
        link: n.link,
        createdAt: n.createdAt,
        workspace: n.workspace,
      })),
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Global notifications fetch error:", error);
    return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Session required" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { notificationId, markAllRead, workspaceId } = body;

    // Mark all read
    if (markAllRead) {
      const where: any = {
        read: false,
        OR: [
          { userId: session.id },
          { userId: null },
        ],
      };

      if (workspaceId) {
        where.workspaceId = workspaceId;
      } else {
        const userMemberships = await prisma.membership.findMany({
          where: { userId: session.id },
          select: { workspaceId: true },
        });
        where.workspaceId = { in: userMemberships.map((m) => m.workspaceId) };
      }

      await prisma.notification.updateMany({
        where,
        data: { read: true },
      });

      return NextResponse.json({
        success: true,
        message: "All notifications marked as read",
      });
    }

    // Mark single notification read
    if (!notificationId) {
      return NextResponse.json({ error: "notificationId is required" }, { status: 400 });
    }

    const notif = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notif) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    // Check ownership / tenancy
    if (notif.userId && notif.userId !== session.id) {
      return NextResponse.json({ error: "Forbidden: Cannot alter another user's notification" }, { status: 403 });
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });

    return NextResponse.json({
      success: true,
      notification: updated,
    });
  } catch (error) {
    console.error("Notification update error:", error);
    return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
  }
}
