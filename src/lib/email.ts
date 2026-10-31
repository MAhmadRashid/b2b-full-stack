/**
 * Email delivery module for PulseFlow SaaS.
 * Handles dispatching invitations and transactional notifications.
 */

interface SendInvitationEmailParams {
  to: string;
  inviterName?: string | null;
  inviterEmail?: string | null;
  targetName: string; // Organization or Workspace name
  targetType: "organization" | "workspace";
  role: string;
  inviteUrl: string;
}

interface EmailDeliveryResult {
  delivered: boolean;
  provider: string;
  messageId?: string;
  error?: string;
  simulated?: boolean;
}

export async function sendInvitationEmail(
  params: SendInvitationEmailParams
): Promise<EmailDeliveryResult> {
  const { to, inviterName, inviterEmail, targetName, targetType, role, inviteUrl } = params;

  // Check if Resend or SMTP provider is configured
  const resendApiKey = process.env.RESEND_API_KEY;
  const smtpHost = process.env.SMTP_HOST;
  const sendgridApiKey = process.env.SENDGRID_API_KEY;

  const inviterDisplay = inviterName ? `${inviterName} (${inviterEmail || ""})` : inviterEmail || "A team administrator";

  const emailSubject = `You've been invited to join ${targetName} on Nexora`;
  const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f3f4f6; padding: 24px; }
          .container { max-width: 540px; margin: 0 auto; background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 32px; }
          .badge { display: inline-block; padding: 4px 10px; background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.3); color: #818cf8; border-radius: 6px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
          h2 { color: #ffffff; font-size: 22px; margin-top: 0; }
          p { color: #9ca3af; line-height: 1.6; font-size: 15px; }
          .btn { display: inline-block; padding: 12px 24px; background: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
          .footer { margin-top: 32px; border-top: 1px solid #1f2937; padding-top: 16px; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="badge">Team Invitation</div>
          <h2>Join ${targetName}</h2>
          <p>Hello,</p>
          <p><strong>${inviterDisplay}</strong> has invited you to join the ${targetType} <strong>${targetName}</strong> as a <strong>${role}</strong>.</p>
          <p>Click the button below to accept your invitation and activate your account:</p>
          <a href="${inviteUrl}" class="btn" target="_blank">Accept Invitation & Join</a>
          <p>If you don't recognize this request or believe it was sent by mistake, you can simply ignore or decline it.</p>
          <div class="footer">
            Nexora Observability & Platform &copy; 2026. All rights reserved.
          </div>
        </div>
      </body>
    </html>
  `;

  // 1. If Resend API Key is configured
  if (resendApiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "Nexora <no-reply@nexora.io>",
          to: [to],
          subject: emailSubject,
          html: emailHtml,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          delivered: true,
          provider: "resend",
          messageId: data.id,
        };
      } else {
        const errData = await response.text();
        console.error("Resend delivery failed:", errData);
        return {
          delivered: false,
          provider: "resend",
          error: `Resend error: ${errData}`,
        };
      }
    } catch (err: any) {
      console.error("Resend API exception:", err);
      return {
        delivered: false,
        provider: "resend",
        error: err.message,
      };
    }
  }

  // 2. If SendGrid is configured
  if (sendgridApiKey) {
    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sendgridApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: process.env.EMAIL_FROM || "no-reply@nexora.io", name: "Nexora" },
          subject: emailSubject,
          content: [{ type: "text/html", value: emailHtml }],
        }),
      });

      if (response.status >= 200 && response.status < 300) {
        return {
          delivered: true,
          provider: "sendgrid",
        };
      } else {
        const errText = await response.text();
        return {
          delivered: false,
          provider: "sendgrid",
          error: `SendGrid error: ${errText}`,
        };
      }
    } catch (err: any) {
      return {
        delivered: false,
        provider: "sendgrid",
        error: err.message,
      };
    }
  }

  // 3. Fallback when no external email service is configured
  // In development/test mode without SMTP/Resend, return simulated response accurately
  return {
    delivered: false,
    provider: "unconfigured",
    simulated: true,
    error: "No transactional email provider (RESEND_API_KEY / SENDGRID_API_KEY / SMTP_HOST) configured in environment.",
  };
}
