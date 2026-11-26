/**
 * Minimal transactional email via the Resend HTTP API — no npm dependency.
 * A no-op (returns "skipped") unless RESEND_API_KEY and EMAIL_FROM are set and there is a recipient,
 * so the app runs unchanged when email is not configured.
 */
export interface Attachment {
  filename: string;
  /** UTF-8 text content; encoded as base64 for the API. */
  content: string;
}

export async function sendEmail(opts: {
  to: string[];
  subject: string;
  text: string;
  attachments?: Attachment[];
}): Promise<"sent" | "skipped"> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const to = opts.to.filter(Boolean);
  if (!key || !from || to.length === 0) return "skipped";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to,
      subject: opts.subject,
      text: opts.text,
      attachments: opts.attachments?.map((a) => ({ filename: a.filename, content: Buffer.from(a.content, "utf8").toString("base64") })),
    }),
  });
  if (!res.ok) throw new Error(`email failed: ${res.status} ${await res.text().catch(() => "")}`);
  return "sent";
}
