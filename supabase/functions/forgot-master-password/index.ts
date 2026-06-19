import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Initialize Supabase Client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Get User from JWT
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(authHeader.replace("Bearer ", ""));

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized user session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const userEmail = user.email;

    if (!userEmail) {
      return new Response(JSON.stringify({ error: "User email not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Generate token via RPC
    const { data: token, error: rpcError } = await supabaseClient.rpc(
      "request_master_password_recovery",
      { p_user_id: userId },
    );

    if (rpcError || !token) {
      return new Response(
        JSON.stringify({ error: rpcError?.message ?? "Failed to request token from database" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 4. Build Reset URL
    const resetUrl = `https://aceledger.top/settings?reset_token=${token}`;

    // 5. Send recovery email (resend.com API integration by default, falls back to SendGrid or SMTP)
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const sendgridApiKey = Deno.env.get("SENDGRID_API_KEY");
    const smtpFrom = Deno.env.get("SMTP_FROM") ?? "noreply@aceledger.top";

    const subject = "Reset Master Password — Ace Ledger";
    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f5f6; margin: 0; padding: 40px 0; color: #1f2937;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e5e7eb;">
          <div style="background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Ace Ledger</h1>
          </div>
          <div style="padding: 40px 30px; line-height: 1.6;">
            <p>Hello,</p>
            <p>We received a request to reset the <strong>Master Password</strong> for your Ace Ledger settings. Privileged operations like audit log and amendment history deletion require this password.</p>
            
            <div style="padding: 16px; background-color: #fef3c7; border-left: 4px solid #d97706; border-radius: 6px; margin: 24px 0; color: #92400e; font-size: 14px;">
              <strong>Important:</strong> This recovery link will expire in <strong>15 minutes</strong> and is valid for a single use only.
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="display: inline-block; padding: 14px 28px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">Reset Master Password</a>
            </div>
            
            <p>If the button doesn't work, copy and paste this URL into your browser:</p>
            <p style="word-break: break-all;"><a href="${resetUrl}" style="color: #2563eb;">${resetUrl}</a></p>
          </div>
          <div style="background-color: #f9fafb; padding: 20px 30px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6;">
            <p>&copy; ${new Date().getFullYear()} Ace Ledger. All rights reserved.</p>
          </div>
        </div>
      </div>
    `;

    let emailSent = false;
    let method = "";

    if (resendApiKey) {
      method = "Resend API";
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: smtpFrom,
          to: [userEmail],
          subject: subject,
          html: htmlContent,
        }),
      });
      if (response.ok) emailSent = true;
    } else if (sendgridApiKey) {
      method = "SendGrid API";
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sendgridApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: userEmail }] }],
          from: { email: smtpFrom, name: "Ace Ledger" },
          subject: subject,
          content: [{ type: "text/html", value: htmlContent }],
        }),
      });
      if (response.ok) emailSent = true;
    } else {
      // Return details for local dev or simulation when secrets aren't set
      return new Response(
        JSON.stringify({
          success: true,
          message: `[DEV/TEST ONLY] Reset link generated but email sending credentials are not set in Supabase secrets. Reset URL: ${resetUrl}`,
          recipient: userEmail,
          devUrl: resetUrl,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (emailSent) {
      return new Response(
        JSON.stringify({
          success: true,
          message: `A secure master password reset link has been dispatched to ${userEmail}.`,
          recipient: userEmail,
          method: method,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } else {
      return new Response(
        JSON.stringify({
          error: `Failed to deliver email via ${method}. Please check email service logs.`,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "An unexpected error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
