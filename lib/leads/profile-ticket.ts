import { createHmac, timingSafeEqual } from "node:crypto";

export interface ProfileTicket {
  runId: string; userId: string; avatarId: string; url: string; expires: number; leadId: string;
}
export function signProfileTicket(data: ProfileTicket, secret: string): string {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = createHmac("sha256", secret).update(`narada-profile-import:${payload}`).digest("base64url");
  return `${payload}.${signature}`;
}
export function verifyProfileTicket(ticket: string, secret: string, userId: string, avatarId: string): ProfileTicket {
  const [payload, signature] = ticket.split(".");
  if (!payload || !signature || ticket.length > 4000) throw new Error("Invalid lookup. Please start again.");
  const expected = signProfileTicket(JSON.parse(Buffer.from(payload, "base64url").toString()), secret).split(".")[1];
  const a = Buffer.from(signature), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("Invalid lookup. Please start again.");
  const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as ProfileTicket;
  if (data.userId !== userId || data.avatarId !== avatarId || !Number.isFinite(data.expires) || data.expires < Date.now()) {
    throw new Error("This lookup has expired. Please fetch the profile again.");
  }
  return data;
}
