import { z } from "zod";
import { createPasswordReset } from "@/lib/auth";
import { json, parseJson, route } from "@/lib/api";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requestIp } from "@/lib/audit";
import { one } from "@/lib/db";
import { appUrl } from "@/lib/env";

const Schema = z.object({ email: z.string().email().max(200) });

/**
 * Password recovery requires an operator-configured delivery channel. Without
 * one, the endpoint still returns a generic response (no account enumeration)
 * and only exposes the reset link when running in development.
 */
export const POST = route(async (request: Request) => {
  enforceRateLimit(`forgot:${requestIp(request)}`, 5, 3600);
  const { email } = await parseJson(request, Schema);
  const user = one<{ id: string }>("SELECT id FROM users WHERE email = ? AND deleted_at IS NULL", email.toLowerCase());
  let devLink: string | null = null;
  if (user) {
    const token = createPasswordReset(user.id);
    const link = `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`;
    if (process.env.NODE_ENV !== "production") {
      devLink = link;
      console.log(`[password-reset] development link: ${link}`);
    } else {
      console.warn(
        "[password-reset] A reset was requested but no mail delivery is configured. Set up SMTP/email delivery to make recovery usable in production.",
      );
    }
  }
  return json({
    ok: true,
    message:
      "If that account exists, a password reset was created. Production deployments must configure email delivery; this build does not send email.",
    devResetLink: devLink,
  });
});
