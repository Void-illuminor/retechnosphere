/**
 * Email delivery via Resend (https://resend.com). If no RESEND_API_KEY is set,
 * runs in dry-run mode and just logs the message, so the whole pipeline is
 * exercisable locally without sending real mail.
 */
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

export async function sendEmail(msg: OutgoingEmail): Promise<SendResult> {
  if (!config.email.enabled) {
    console.log(`[email:dry-run] to=${msg.to} subject="${msg.subject}"`);
    return { ok: true, dryRun: true };
  }
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
