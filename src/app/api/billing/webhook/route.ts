import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit";
import crypto from "crypto";

const WEBHOOK_SECRET =
  process.env.BILLING_WEBHOOK_SECRET ||
  process.env.STRIPE_WEBHOOK_SECRET ||
  "whsec_test_secret_key_pulseflow_2026!";

/**
 * Verify webhook signature using HMAC-SHA256 supporting raw hex, sha256=, and Stripe v1 formats
 */
function verifyWebhookSignature(payload: string, signature: string | null): boolean {
  if (!signature) return false;
  try {
    let cleanSignature = signature.trim();
    let timestamp: number | null = null;

    if (cleanSignature.includes("t=") && cleanSignature.includes("v1=")) {
      const parts = cleanSignature.split(",");
      for (const part of parts) {
        const [k, v] = part.trim().split("=");
        if (k === "t") timestamp = parseInt(v, 10);
        if (k === "v1") cleanSignature = v;
      }

      if (timestamp) {
        const nowSec = Math.floor(Date.now() / 1000);
        if (Math.abs(nowSec - timestamp) > 300) {
          return false;
        }
      }
    } else if (cleanSignature.startsWith("sha256=")) {
      cleanSignature = cleanSignature.replace("sha256=", "");
    }

    const signedPayload = timestamp ? `${timestamp}.${payload}` : payload;
    const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
    hmac.update(signedPayload, "utf8");
    const expectedHex = hmac.digest("hex");

    if (cleanSignature.length !== expectedHex.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(cleanSignature, "hex"),
      Buffer.from(expectedHex, "hex")
    );
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

    const eventId = event.id || `evt_${crypto.createHash("sha256").update(rawBody).digest("hex").slice(0, 24)}`;

    // Idempotency check: if event has already been processed, return 200 without duplicate action
    const existingPaymentEvent = await prisma.paymentEvent.findUnique({
      where: { eventId },
    });

    if (existingPaymentEvent) {
      let action: string = type;
      if (type === "customer.subscription.updated") action = "subscription_updated";
      if (type === "customer.subscription.deleted") action = "subscription_deleted";
      if (type === "invoice.payment_succeeded") action = "invoice_paid";
      if (type === "checkout.session.completed") action = "checkout_completed";

      return NextResponse.json({
        received: true,
        idempotent: true,
        event: type,
        action,
        ...(data?.tier && { tier: data.tier }),
        message: "Duplicate webhook event acknowledged without reprocessing.",
      });
    }

    let action: string = type;
    let extraData: Record<string, any> = {};

    switch (type) {
      case "checkout.session.completed": {
        const orgId = data.metadata?.organizationId || data.client_reference_id;
        const targetPlan = (data.metadata?.planId || "PRO").toUpperCase();
        const billingCycle = (data.metadata?.billingInterval || "MONTHLY").toUpperCase();
        const amountCents = data.amount_total || (targetPlan === "PRO" ? 9900 : 24900);
        const customerEmail = data.customer_email || data.customer_details?.email;
        const stripeCustomerId = data.customer || `cus_${crypto.randomBytes(12).toString("hex")}`;
        const stripeSubId = data.subscription || `sub_${crypto.randomBytes(12).toString("hex")}`;

        if (orgId) {
          const invNum = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

          const created = await prisma.$transaction(async (tx) => {
            await tx.paymentEvent.create({
              data: {
                eventId,
                provider: "STRIPE",
                eventType: type,
                status: "PROCESSED",
                payload: JSON.stringify(data),
              },
            });

            await tx.organization.update({
              where: { id: orgId },
              data: {
                plan: targetPlan,
                stripeCustomerId,
                billingEmail: customerEmail,
              },
            });

            await tx.subscription.upsert({
              where: { organizationId: orgId },
              create: {
                organizationId: orgId,
                tier: targetPlan,
                billingCycle,
                status: "ACTIVE",
                stripeCustomerId,
                stripeSubscriptionId: stripeSubId,
                billingEmail: customerEmail,
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              },
              update: {
                tier: targetPlan,
                billingCycle,
                status: "ACTIVE",
                stripeCustomerId,
                stripeSubscriptionId: stripeSubId,
                billingEmail: customerEmail,
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                cancelAtPeriodEnd: false,
              },
            });

            const inv = await tx.invoice.create({
              data: {
                organizationId: orgId,
                invoiceNumber: invNum,
                amountCents,
                currency: "USD",
                status: "PAID",
                billingEmail: customerEmail,
                paymentMethod: "card_verified",
                periodStart: new Date(),
                periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                pdfUrl: `/invoices/${invNum}.pdf`,
              },
            });

            return inv;
          });

          await recordAuditLog({
            organizationId: orgId,
            action: "ORGANIZATION_SUBSCRIPTION_ACTIVATED",
            details: `Activated ${targetPlan} plan (${billingCycle}) via checkout webhook`,
          });

          action = "checkout_completed";
          extraData = { invoiceId: created.id, organizationId: orgId };
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const { workspaceId, organizationId, amountCents = 9900, invoiceNumber, currency = "USD" } = data;
        const targetOrgId = organizationId || data.metadata?.organizationId;
        const invNum = invoiceNumber || `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

        const createdInvoice = await prisma.$transaction(async (tx) => {
          await tx.paymentEvent.create({
            data: {
              eventId,
              provider: "STRIPE",
              eventType: type,
              status: "PROCESSED",
              payload: JSON.stringify(data),
            },
          });

          // 1. Create or ensure Invoice record
          const inv = await tx.invoice.create({
            data: {
              workspaceId: workspaceId || null,
              organizationId: targetOrgId || null,
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
          if (workspaceId) {
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
          }

          if (targetOrgId) {
            await tx.subscription.updateMany({
              where: { organizationId: targetOrgId },
              data: {
                status: "ACTIVE",
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              },
            });
          }

          return inv;
        });

        await recordAuditLog({
          workspaceId: workspaceId || null,
          organizationId: targetOrgId || null,
          action: "INVOICE_PAYMENT_SUCCEEDED",
          details: `Webhook processed payment of $${(amountCents / 100).toFixed(2)} for ${invNum}`,
        });

        // Stage 8: Subscription Activated (Server-verified conversion)
        try {
          const { recordFunnelEvent } = await import("@/lib/funnel-analytics");
          await recordFunnelEvent({
            sessionId: `billing_${workspaceId || targetOrgId || eventId}`,
            stage: "SUBSCRIPTION_ACTIVATED",
            eventName: "subscription_activated_paid",
            organizationId: targetOrgId || null,
            workspaceId: workspaceId || null,
            metadata: {
              amountCents,
              currency,
              invoiceNumber: invNum,
            },
          });
        } catch {
          // Analytics non-blocking
        }

        action = "invoice_paid";
        extraData = { invoiceId: createdInvoice.id };
        break;
      }

      case "customer.subscription.updated": {
        const { workspaceId, organizationId, tier, billingCycle, status } = data;
        const targetOrgId = organizationId || data.metadata?.organizationId;

        const planLimits: Record<string, number> = {
          FREE: 10000,
          STARTER: 50000,
          PRO: 250000,
          BUSINESS: 1000000,
          ENTERPRISE: 5000000,
        };

        await prisma.$transaction(async (tx) => {
          await tx.paymentEvent.create({
            data: {
              eventId,
              provider: "STRIPE",
              eventType: type,
              status: "PROCESSED",
              payload: JSON.stringify(data),
            },
          });

          if (workspaceId) {
            if (tier) {
              await tx.workspace.update({
                where: { id: workspaceId },
                data: {
                  plan: tier.toUpperCase(),
                  ...(billingCycle && { billingCycle: billingCycle.toUpperCase() }),
                  ...(planLimits[tier.toUpperCase()] && { monthlyRequestLimit: planLimits[tier.toUpperCase()] }),
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
          }

          if (targetOrgId) {
            if (tier) {
              await tx.organization.update({
                where: { id: targetOrgId },
                data: { plan: tier.toUpperCase() },
              });
            }
            await tx.subscription.updateMany({
              where: { organizationId: targetOrgId },
              data: {
                ...(tier && { tier: tier.toUpperCase() }),
                ...(billingCycle && { billingCycle: billingCycle.toUpperCase() }),
                ...(status && { status: status.toUpperCase() }),
              },
            });
          }
        });

        action = "subscription_updated";
        extraData = { tier: tier || "PRO" };
        break;
      }

      case "customer.subscription.deleted": {
        const { workspaceId, organizationId } = data;
        const targetOrgId = organizationId || data.metadata?.organizationId;

        await prisma.$transaction(async (tx) => {
          await tx.paymentEvent.create({
            data: {
              eventId,
              provider: "STRIPE",
              eventType: type,
              status: "PROCESSED",
              payload: JSON.stringify(data),
            },
          });

          if (workspaceId) {
            await tx.workspace.update({
              where: { id: workspaceId },
              data: {
                plan: "FREE",
                monthlyRequestLimit: 10000,
                subscriptionStatus: "CANCELED",
              },
            });
            await tx.subscription.updateMany({
              where: { workspaceId },
              data: { status: "CANCELED", cancelAtPeriodEnd: false },
            });
          }

          if (targetOrgId) {
            await tx.organization.update({
              where: { id: targetOrgId },
              data: { plan: "FREE" },
            });
            await tx.subscription.updateMany({
              where: { organizationId: targetOrgId },
              data: { status: "CANCELED", cancelAtPeriodEnd: false },
            });
          }
        });

        action = "subscription_deleted";
        break;
      }

      case "invoice.payment_failed": {
        const { workspaceId, organizationId, amountCents = 9900 } = data;
        const targetOrgId = organizationId || data.metadata?.organizationId;

        await prisma.$transaction(async (tx) => {
          await tx.paymentEvent.create({
            data: {
              eventId,
              provider: "STRIPE",
              eventType: type,
              status: "PROCESSED",
              payload: JSON.stringify(data),
            },
          });

          if (workspaceId) {
            await tx.subscription.updateMany({
              where: { workspaceId },
              data: { status: "PAST_DUE" },
            });
          }
          if (targetOrgId) {
            await tx.subscription.updateMany({
              where: { organizationId: targetOrgId },
              data: { status: "PAST_DUE" },
            });
          }
        });

        // Trigger billing alert notification
        try {
          const { triggerNotification } = await import("@/lib/notification-dispatcher");
          const targetWsId = workspaceId || (await prisma.workspace.findFirst({ where: { organizationId: targetOrgId } }))?.id;
          if (targetWsId) {
            await triggerNotification({
              workspaceId: targetWsId,
              title: "Payment Failed",
              message: `Your payment of $${(amountCents / 100).toFixed(2)} could not be processed. Please update your payment method.`,
              type: "CRITICAL",
              link: "/dashboard/billing",
              emailEventType: "PAYMENT_FAILED",
              idempotencyKey: `pay_fail_${eventId}`,
              emailDetails: {
                "Amount": `$${(amountCents / 100).toFixed(2)}`,
                "Status": "PAST DUE",
                "Action Required": "Update payment card on file",
              },
            });
          }
        } catch (e) {
          console.warn("Payment failed notification deferred:", e);
        }

        action = "invoice_payment_failed";
        break;
      }

      default:
        await prisma.paymentEvent.create({
          data: {
            eventId,
            provider: "STRIPE",
            eventType: type,
            status: "IGNORED",
            payload: JSON.stringify(data),
          },
        });
        break;
    }

    return NextResponse.json({
      received: true,
      idempotent: false,
      event: type,
      action,
      ...extraData,
    });
  } catch (error) {
    console.error("Billing webhook error:", error);
    return NextResponse.json({ error: "Webhook processing error" }, { status: 500 });
  }
}
