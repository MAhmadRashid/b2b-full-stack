import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit";
import crypto from "crypto";

const WEBHOOK_SECRET = process.env.BILLING_WEBHOOK_SECRET || "whsec_test_secret_key_pulseflow_2026!";

/**
 * Verify webhook signature using HMAC-SHA256
 */
function verifyWebhookSignature(payload: string, signature: string | null): boolean {
  if (!signature) return false;
  try {
    const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
    hmac.update(payload);
    const expected = `sha256=${hmac.digest("hex")}`;
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-pulseflow-signature") || req.headers.get("stripe-signature");

    // Security check: verify signature
    if (!verifyWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    }

    const event = JSON.parse(rawBody);
    const { type, data } = event;

    if (!type || !data) {
      return NextResponse.json({ error: "Malformed webhook payload" }, { status: 400 });
    }

    let action: string = type;
    let extraData: Record<string, any> = {};

    switch (type) {
      case "invoice.payment_succeeded": {
        const { workspaceId, amountCents = 9900, invoiceNumber, currency = "USD" } = data;
        if (!workspaceId) break;

        const invNum = invoiceNumber || `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

        const createdInvoice = await prisma.$transaction(async (tx) => {
          // 1. Create or ensure Invoice record
          const inv = await tx.invoice.create({
            data: {
              workspaceId,
              invoiceNumber: invNum,
              amountCents,
              currency,
              status: "PAID",
              periodStart: new Date(),
              periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              pdfUrl: `/invoices/${invNum}.pdf`,
            },
          });

          // 2. Ensure Subscription is active
          await tx.subscription.upsert({
            where: { workspaceId },
            create: {
              workspaceId,
              tier: "PRO",
              status: "ACTIVE",
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
            update: {
              status: "ACTIVE",
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          });

          // 3. Create Notification for workspace members
          await tx.notification.create({
            data: {
              workspaceId,
              title: "Payment Received",
              message: `Payment of $${(amountCents / 100).toFixed(2)} ${currency} for invoice ${invNum} succeeded.`,
              type: "BILLING",
              link: "/dashboard/billing",
            },
          });

          return inv;
        });

        await recordAuditLog({
          workspaceId,
          action: "INVOICE_PAYMENT_SUCCEEDED",
          details: `Webhook processed payment of $${(amountCents / 100).toFixed(2)} for ${invNum}`,
        });

        action = "invoice_paid";
        extraData = { invoiceId: createdInvoice.id };
        break;
      }

      case "customer.subscription.updated": {
        const { workspaceId, tier, billingCycle, status } = data;
        if (!workspaceId) break;

        const planLimits: Record<string, number> = {
          STARTER: 50000,
          PRO: 250000,
          ENTERPRISE: 1000000,
        };

        await prisma.$transaction(async (tx) => {
          if (tier) {
            await tx.workspace.update({
              where: { id: workspaceId },
              data: {
                plan: tier,
                ...(billingCycle && { billingCycle }),
                ...(planLimits[tier] && { monthlyRequestLimit: planLimits[tier] }),
              },
            });
          }

          await tx.subscription.upsert({
            where: { workspaceId },
            create: {
              workspaceId,
              tier: tier ? tier.toUpperCase() : "PRO",
              billingCycle: billingCycle ? billingCycle.toUpperCase() : "MONTHLY",
              status: status ? status.toUpperCase() : "ACTIVE",
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
            update: {
              ...(tier && { tier: tier.toUpperCase() }),
              ...(billingCycle && { billingCycle: billingCycle.toUpperCase() }),
              ...(status && { status: status.toUpperCase() }),
            },
          });

          await tx.notification.create({
            data: {
              workspaceId,
              title: "Subscription Updated",
              message: `Your workspace subscription was modified to ${tier || "current plan"}.`,
              type: "INFO",
              link: "/dashboard/billing",
            },
          });
        });

        action = "subscription_updated";
        extraData = { tier: tier || "PRO" };
        break;
      }

      case "customer.subscription.deleted": {
        const { workspaceId } = data;
        if (!workspaceId) break;

        await prisma.$transaction([
          prisma.workspace.update({
            where: { id: workspaceId },
            data: {
              plan: "STARTER",
              monthlyRequestLimit: 50000,
              subscriptionStatus: "CANCELED",
            },
          }),
          prisma.subscription.update({
            where: { workspaceId },
            data: { status: "CANCELED", cancelAtPeriodEnd: false },
          }),
          prisma.notification.create({
            data: {
              workspaceId,
              title: "Subscription Canceled",
              message: "Your subscription has ended and your workspace has been reverted to Starter tier.",
              type: "WARNING",
              link: "/dashboard/billing",
            },
          }),
        ]);

        await recordAuditLog({
          workspaceId,
          action: "SUBSCRIPTION_TERMINATED",
          details: "Webhook received subscription cancellation event",
        });

        action = "subscription_deleted";
        break;
      }

      default:
        // Unhandled event type
        break;
    }

    return NextResponse.json({ received: true, event: type, action, ...extraData });
  } catch (error) {
    console.error("Billing webhook error:", error);
    return NextResponse.json({ error: "Webhook processing error" }, { status: 500 });
  }
}
