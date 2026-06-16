/**
 * Email delivery. Three transports, chosen automatically (see config.emailMode):
 *   - "smtp"   : nodemailer over SMTP — e.g. Gmail with an App Password. This is
 *                how you email a whole family WITHOUT owning a domain.
 *   - "resend" : Resend HTTP API (needs a verified domain to reach non-owners).
 *   - "dry-run": no credentials set — messages are logged, not sent.
 */
import * as nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { config } from "./config";

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
  dryRun?: boolean;
}

let transporter: Transporter | null = null;
function smtp(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });
  }
  return transporter;
}

export async function sendEmail(msg: OutgoingEmail): Promise<SendResult> {
  const mode = config.emailMode;

  if (mode === "dry-run") {
    console.log(`[email:dry-run] to=${msg.to} subject="${msg.subject}"`);
    return { ok: true, dryRun: true };
  }

  if (mode === "smtp") {
    try {
      const info = await smtp().sendMail({
        from: config.email.from,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      });
      return { ok: true, id: info.messageId };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  // Resend HTTP API.
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.email.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.email.from,
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 300)}` };
    }
    const data = (await res.json()) as { id?: string };
    return { ok: true, id: data.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
