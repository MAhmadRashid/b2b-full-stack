import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

// Email validation regex (RFC 5322 simplified standard)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Disposable/spam domain check list
const BLOCKED_DOMAINS = ["mailinator.com", "tempmail.com", "10minutemail.com", "guerrillamail.com", "throwawaymail.com"];

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const isLoopback = ip === "127.0.0.1" || ip === "::1" || ip === "localhost" || ip === "unknown";
    
    // Rate limit: 5 submissions per 15 minutes per IP (200 for loopback testing)
    const rl = checkRateLimit(`lead_contact_${ip}`, {
      limit: isLoopback ? 200 : 5,
      windowMs: 15 * 60 * 1000,
    });

    if (!rl.success) {
      return rateLimitExceededResponse(
        rl,
        "Too many lead submissions from this network. Please wait before submitting again."
      );
    }

    const body = await req.json().catch(() => ({}));
    const { name, workEmail, company, teamSize, message, consent, honeypot } = body;

    // Honeypot spam check - bot trap
    if (honeypot && String(honeypot).trim().length > 0) {
      logger.warn("Spam bot submission caught via honeypot trap", { context: "LEAD_CAPTURE", data: { ip, honeypot } });
      // Return 200 to trick spam bots without storing garbage
      return NextResponse.json({ success: true, message: "Thank you for contacting sales." }, { status: 200 });
    }

    // Server-side field validations
    if (!name || typeof name !== "string" || name.trim().length < 2 || name.trim().length > 100) {
      return NextResponse.json(
        { error: "A valid full name (2-100 characters) is required." },
        { status: 400 }
      );
    }

    if (!workEmail || typeof workEmail !== "string" || !EMAIL_REGEX.test(workEmail.trim())) {
      return NextResponse.json(
        { error: "A valid business email address is required." },
        { status: 400 }
      );
    }

    const normalizedEmail = workEmail.toLowerCase().trim();
    const domain = normalizedEmail.split("@")[1];
    if (BLOCKED_DOMAINS.includes(domain)) {
      return NextResponse.json(
        { error: "Please provide a valid company work email address. Disposable email providers are not supported." },
        { status: 400 }
      );
    }

    if (!company || typeof company !== "string" || company.trim().length < 2 || company.trim().length > 100) {
      return NextResponse.json(
        { error: "A valid company or organization name (2-100 characters) is required." },
        { status: 400 }
      );
    }

    const validTeamSizes = ["1-10", "11-50", "51-200", "201-1000", "1000+"];
    if (!teamSize || !validTeamSizes.includes(String(teamSize).trim())) {
      return NextResponse.json(
        { error: "Please select a valid team size bracket (e.g. 1-10, 11-50, 51-200, 201-1000, 1000+)." },
        { status: 400 }
      );
    }

    if (!message || typeof message !== "string" || message.trim().length < 10 || message.trim().length > 2000) {
      return NextResponse.json(
        { error: "Please provide a descriptive inquiry message (between 10 and 2000 characters)." },
        { status: 400 }
      );
    }

    if (consent !== true && consent !== "true") {
      return NextResponse.json(
        { error: "You must consent to allowing PulseFlow to contact you regarding your inquiry." },
        { status: 400 }
      );
    }

    // Duplicate check: prevent rapid duplicate submissions within 1 hour with identical email and message
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentDuplicate = await prisma.leadSubmission.findFirst({
      where: {
        workEmail: normalizedEmail,
        createdAt: { gte: oneHourAgo },
      },
    });

    if (recentDuplicate) {
      return NextResponse.json(
        {
          error: "An inquiry from this email was already submitted recently. Our solutions team is reviewing your request.",
          isDuplicate: true,
        },
        { status: 409 }
      );
    }

    // Store securely in database
    const lead = await prisma.leadSubmission.create({
      data: {
        name: name.trim(),
        workEmail: normalizedEmail,
        company: company.trim(),
        teamSize: String(teamSize).trim(),
        message: message.trim(),
        consent: true,
        status: "NEW",
        source: "WEBSITE_CONTACT_SALES",
        ipAddress: ip,
      },
    });

    logger.info("New sales lead captured securely", {
      context: "LEAD_CAPTURE",
      data: {
        leadId: lead.id,
        company: lead.company,
        teamSize: lead.teamSize,
        workEmail: lead.workEmail,
      },
    });

    // Check if sales team notification provider is actually configured
    const isSalesNotificationConfigured = Boolean(process.env.RESEND_API_KEY || process.env.SMTP_HOST);
    let notificationStatus = "QUEUED_UNCONFIGURED";

    if (isSalesNotificationConfigured) {
      try {
        const { sendTransactionalEmail, generateEmailTemplate } = await import("@/lib/email-service");
        const htmlContent = generateEmailTemplate({
          category: "INFO",
          heading: `New Enterprise Lead: ${lead.company}`,
          message: `A new inquiry was received from ${lead.name} (${lead.workEmail}) at ${lead.company}.`,
          details: {
            "Contact Name": lead.name,
            "Company": lead.company,
            "Work Email": lead.workEmail,
            "Team Size": lead.teamSize,
            "Inquiry Message": lead.message,
          },
        });
        await sendTransactionalEmail({
          to: "sales@pulseflow.io",
          subject: `New Enterprise Lead: ${lead.company} (${lead.teamSize} team members)`,
          eventType: "SUBSCRIPTION_CREATED",
          htmlContent,
          idempotencyKey: `lead_${lead.id}`,
        });
        notificationStatus = "DISPATCHED";
      } catch (err: any) {
        logger.warn("Sales team email notification failed, lead stored safely in database", {
          context: "LEAD_CAPTURE",
          data: { errorMsg: err?.message || String(err) },
        });
        notificationStatus = "FAILED_PROVIDER_ERROR";
      }
    } else {
      logger.info("Sales notification provider not configured (staging/sandbox mode); lead stored safely in database.");
    }

    return NextResponse.json({
      success: true,
      message: "Thank you! Your inquiry has been received. Our solutions engineering team will review your requirements and reach out within 1 business day.",
      leadId: lead.id,
      notificationStatus,
    });
  } catch (error: any) {
    logger.error("Lead submission error", error, {
      context: "LEAD_CAPTURE",
    });
    return NextResponse.json(
      { error: "An unexpected error occurred while processing your request. Please try again later." },
      { status: 500 }
    );
  }
}

