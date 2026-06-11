import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  identifier: z.string().trim().min(1).max(320),
  success: z.boolean(),
  error_message: z.string().trim().max(500).optional().nullable(),
  user_agent: z.string().trim().max(500).optional().nullable(),
});

/** Server-side recorder for sign-in attempts. The login_attempts table is
 *  not writable by anon/authenticated clients; this server function uses
 *  the service role to insert a sanitized row. */
export const recordLoginAttempt = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("login_attempts").insert({
      identifier: data.identifier,
      method: "email",
      success: data.success,
      error_message: data.error_message || null,
      user_agent: data.user_agent || null,
    });
    return { ok: true };
  });