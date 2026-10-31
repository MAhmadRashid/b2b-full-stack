import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const BLOCKED_DOMAINS = ["mailinator.com", "tempmail.com", "10minutemail.com", "guerrillamail.com", "throwawaymail.com"];

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const isLoopback = ip === "127.0.0.1" || ip === "::1" || ip === "localhost" || ip === "unknown";

    const rl = checkRateLimit(`demo_booking_${ip}`, {
      limit: isLoopback ? 200 : 5,
      windowMs: 15 * 60 * 1000,
    });

    if (!rl.success) {
      return rateLimitExceededResponse(
        rl,
        "Too many demo requests submitted from this network. Please try again later."
      );
    }

    const body = await req.json().catch(() => ({}));
    const { name, workEmail, company, teamSize, preferredTime, timezone, focusArea, notes, honeypot } = body;

    // Honeypot trap check
    if (honeypot && String(honeypot).trim().length > 0) {
      logger.warn("Spam bot demo request caught via honeypot trap", { context: "DEMO_BOOKING", data: { ip, honeypot } });
      return NextResponse.json({ success: true, message: "Demo request received." }, { status: 200 });
    }

    // Server-side validation
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
        { error: "A valid company or organization name is required." },
        { status: 400 }
      );
    }

    const validTeamSizes = ["1-10", "11-50", "51-200", "201-1000", "1000+"];
    if (!teamSize || !validTeamSizes.includes(String(teamSize).trim())) {
      return NextResponse.json(
        { error: "Please select a valid team size bracket." },
        { status: 400 }
      );
    }

    if (!preferredTime || typeof preferredTime !== "string" || preferredTime.trim().length < 4) {
      return NextResponse.json(
        { error: "Please provide a preferred meeting day or time slot request." },
        { status: 400 }
      );
    }

    // Prevent duplicate demo requests within 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const existing = await prisma.demoBookingRequest.findFirst({
      where: {
        workEmail: normalizedEmail,
        createdAt: { gte: twoHoursAgo },
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          error: "A demo session request for this email address has already been received. Our team will contact you shortly to coordinate calendar availability.",
          isDuplicate: true,
        },
        { status: 409 }
      );
    }

    // Save demo booking request with explicit pending review status
    const booking = await prisma.demoBookingRequest.create({
      data: {
        name: name.trim(),
        workEmail: normalizedEmail,
        company: company.trim(),
        teamSize: String(teamSize).trim(),
        preferredTime: preferredTime.trim(),
        timezone: (timezone && typeof timezone === "string") ? timezone.trim() : "UTC",
        focusArea: (focusArea && typeof focusArea === "string") ? focusArea.trim() : "GENERAL",
        notes: (notes && typeof notes === "string") ? notes.trim() : null,
        status: "PENDING_REVIEW",
        ipAddress: ip,
      },
    });

    logger.info("Demo booking request recorded", {
      context: "DEMO_BOOKING",
      data: {
        bookingId: booking.id,
        company: booking.company,
        preferredTime: booking.preferredTime,
        workEmail: booking.workEmail,
      },
    });

    // Notify sales/solutions engineering team if email provider configured
    const isSalesNotificationConfigured = Boolean(process.env.RESEND_API_KEY || process.env.SMTP_HOST);
    let notificationStatus = "QUEUED_UNCONFIGURED";

    if (isSalesNotificationConfigured) {
      try {
        const { sendTransactionalEmail, generateEmailTemplate } = await import("@/lib/email-service");
        const htmlContent = generateEmailTemplate({
          category: "INFO",
          heading: `New Demo Session Request: ${booking.company}`,
          message: `A custom demo session was requested by ${booking.name} (${booking.workEmail}) at ${booking.company}.`,
          details: {
            "Contact Name": booking.name,
            "Company": booking.company,
            "Team Size": booking.teamSize,
            "Preferred Window": booking.preferredTime,
            "Timezone": booking.timezone,
            "Focus Architecture": booking.focusArea,
            "Notes": booking.notes || "None provided",
          },
        });
        await sendTransactionalEmail({
          to: "demos@pulseflow.io",
          subject: `New Demo Session Request: ${booking.company} (${booking.preferredTime})`,
          eventType: "SUBSCRIPTION_CREATED",
          htmlContent,
          idempotencyKey: `demo_${booking.id}`,
        });
        notificationStatus = "DISPATCHED";
      } catch (err: any) {
        logger.warn("Sales demo notification email failed to dispatch, saved safely in database", {
          context: "DEMO_BOOKING",
          data: { errorMsg: err?.message || String(err) },
        });
        notificationStatus = "FAILED_PROVIDER_ERROR";
      }
    }

    return NextResponse.json({
      success: true,
      message: "Your demo request has been submitted! Because calendar availability is coordinated directly by our solutions engineering team, we have recorded your preferred time as a request (not a confirmed booking). A team member will verify calendar slots and send you a calendar invite.",
      bookingId: booking.id,
      status: "PENDING_REVIEW",
      notificationStatus,
    });
  } catch (error: any) {
    logger.error("Demo booking request error", error, {
      context: "DEMO_BOOKING",
    });
    return NextResponse.json(
      { error: "An unexpected error occurred while processing your demo request. Please try again later." },
      { status: 500 }
    );
  }
}

