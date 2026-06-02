import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import crypto from "crypto";

export const deleteUserAccount = createServerFn({ method: "POST" })
  .inputValidator((d: { userId: string; email: string; accessToken: string }) => d)
  .handler(async ({ data }: { data: { userId: string; email: string; accessToken: string } }) => {
    // 1. Verify caller session on server side to guarantee authority
    const { data: { user: caller }, error: authErr } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authErr || !caller || caller.email !== "mansoorshahzadpk@gmail.com") {
      throw new Error("Unauthorized: Only master administrator is allowed to delete user accounts.");
    }

    // 2. Fetch target user record from auth to compute hardware/registration metadata hash
    const { data: targetRecord, error: getErr } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (getErr || !targetRecord || !targetRecord.user) {
      throw new Error(`Failed to retrieve target user record: ${getErr?.message || "User not found"}`);
    }

    const metadata = targetRecord.user.user_metadata || {};
    const metadataStr = JSON.stringify(metadata);
    const hash = crypto.createHash("sha256").update(metadataStr).digest("hex");

    // 3. Log to registry table
    const { error: regErr } = await supabaseAdmin
      .from("deleted_accounts_registry" as any)
      .insert({
        email: data.email,
        metadata_hash: hash
      });

    if (regErr) {
      // If it already exists, just continue
      if (!regErr.message.includes("duplicate key")) {
        throw new Error(`Failed to log deleted account registry: ${regErr.message}`);
      }
    }

    // 4. Cascade delete user data across core application tables
    await supabaseAdmin.from("client_payments").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("vendor_payments").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("invoices").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("vendor_grns").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("products").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("clients").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("vendors").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("businesses").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("tenant_profiles" as any).delete().eq("user_id", data.userId);
    await supabaseAdmin.from("app_settings").delete().eq("user_id", data.userId);

    // 5. Invoke Supabase Admin Auth API to completely delete the auth.users identity
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (delErr) {
      throw new Error(`Failed to delete user identity from auth: ${delErr.message}`);
    }

    return { success: true };
  });
