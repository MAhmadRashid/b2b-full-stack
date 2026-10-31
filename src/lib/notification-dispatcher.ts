import { prisma } from "./prisma";
import { sendTransactionalEmail, generateEmailTemplate, EmailEventType } from "./email-service";

export interface TriggerNotificationParams {
  workspaceId: string;
  userId?: string;
  recipientEmail?: string;
  title: string;
  message: string;
  type?: "INFO" | "SUCCESS" | "WARNING" | "CRITICAL" | "BILLING";
  link?: string;
  emailEventType?: EmailEventType;
  emailDetails?: Record<string, string>;
  actionUrl?: string;
  actionText?: string;
  idempotencyKey?: string;
}

/**
 * Dispatches an in-app notification and optionally an automated transactional email.
 * Guarantees in-app notification persistence and checks user notification preferences for emails.
 */
export async function triggerNotification(params: TriggerNotificationParams) {
  const {
    workspaceId,
    userId,
    recipientEmail,
    title,
    message,
    type = "INFO",
    link,
    emailEventType,
    emailDetails,
    actionUrl,
    actionText,
    idempotencyKey,
  } = params;

  // 1. Create In-App Notification Record
  const notification = await prisma.notification.create({
    data: {
      workspaceId,
      userId,
      title,
      message,
      type,
      link,
    },
  });

  // 2. Dispatch Email if emailEventType & recipient provided
  let emailResult = null;
  if (emailEventType && (recipientEmail || userId)) {
    let targetEmail = recipientEmail;
    if (!targetEmail && userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      targetEmail = user?.email;
    }

    if (targetEmail) {
      const htmlContent = generateEmailTemplate({
        category: type,
        heading: title,
        message,
        actionUrl: actionUrl || (link ? `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5000"}${link}` : undefined),
        actionText: actionText || (link ? "View in Dashboard" : undefined),
        details: emailDetails,
      });

      emailResult = await sendTransactionalEmail({
        to: targetEmail,
        userId,
        eventType: emailEventType,
        subject: `[Nexora] ${title}`,
        htmlContent,
        idempotencyKey,
      });
    }
  }

  return {
    notification,
    emailResult,
  };
}
