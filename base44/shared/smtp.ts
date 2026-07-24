import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const HOST = "smtp.protonmail.ch";
const PORT = 587;
const FROM_NAME = "SwapPulse";

export async function sendMail({ to, subject, html, text }) {
  const username = Deno.env.get("SMTP_USERNAME");
  const password = Deno.env.get("SMTP_TOKEN");
  if (!username || !password) {
    throw new Error("SMTP credentials not configured (SMTP_USERNAME / SMTP_TOKEN)");
  }
  const client = new SMTPClient({
    connection: {
      hostname: HOST,
      port: PORT,
      tls: false, // STARTTLS on 587
      auth: { username, password },
    },
  });
  let sendErr;
  try {
    await client.send({
      from: `${FROM_NAME} <${username}>`,
      to,
      subject,
      content: text || (html ? html.replace(/<[^>]+>/g, " ") : ""),
      html: html || text || "",
    });
  } catch (e) {
    sendErr = e;
  }
  try { await client.close(); } catch (_e) { /* connection may not have opened */ }
  if (sendErr) throw sendErr;
}