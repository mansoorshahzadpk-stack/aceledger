import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { supabase } from "@/integrations/supabase/client";
import crypto from "crypto";

export const deleteUserAccount = createServerFn({ method: "POST" })
  .inputValidator((d: { userId: string; email: string; accessToken: string }) => d)
  .handler(async ({ data }: { data: { userId: string; email: string; accessToken: string } }) => {
    // 1. Verify caller session on server side to guarantee authority
    // We try verifying using both the public client and the admin client to bypass any environment verification quirks
    let caller: any = null;
    let authErr: any = null;

    try {
      const { data: { user }, error } = await supabase.auth.getUser(data.accessToken);
      if (user) {
        caller = user;
      } else {
        authErr = error;
      }
    } catch (e: any) {
      authErr = e;
    }

    if (!caller) {
      try {
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(data.accessToken);
        if (user) {
          caller = user;
          authErr = null;
        } else {
          authErr = error || authErr;
        }
      } catch (e: any) {
        authErr = e;
      }
    }

    if (authErr || !caller) {
      console.error("[deleteUserAccount] Caller authentication failed:", authErr);
      throw new Error(`Unauthorized: Auth validation failed. ${authErr?.message || "No valid session user found."}`);
    }

    if (caller.email !== "mansoorshahzadpk@gmail.com") {
      console.error("[deleteUserAccount] Unauthorized access attempt by:", caller.email);
      throw new Error("Unauthorized: Only the master administrator is allowed to delete user accounts.");
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
    try {
      const { error: regErr } = await supabaseAdmin
        .from("deleted_accounts_registry" as any)
        .insert({
          email: data.email,
          metadata_hash: hash
        });

      if (regErr && !regErr.message.includes("duplicate key")) {
        throw new Error(`Failed to log deleted account registry: ${regErr.message}`);
      }
    } catch (err: any) {
      console.error("[deleteUserAccount] Registry logging error:", err);
      throw new Error(`Registry logging failed: ${err.message}`);
    }

    // 4. Invoke Supabase Admin Auth API to completely delete the auth.users identity FIRST.
    // This triggers PostgreSQL database-level ON DELETE CASCADE across all user-dependent tables atomically.
    try {
      const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
      if (delErr) {
        throw new Error(`Auth deleteUser failed: ${delErr.message}`);
      }
    } catch (err: any) {
      console.error("[deleteUserAccount] Auth delete user error:", err);
      throw new Error(`User deletion failed: ${err.message}`);
    }

    // 5. Clean up any remaining records manually (as a fallback in case cascade missed anything)
    try {
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
    } catch (err: any) {
      console.warn("[deleteUserAccount] Manual cleanup warning:", err.message);
    }

    return { success: true };
  });
