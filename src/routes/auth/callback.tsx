import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  beforeLoad: async ({ search }) => {
    const code = (search as any).code;
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error("Error exchanging code for session:", error.message);
      }
    }
    throw redirect({ to: "/" });
  },
  component: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
        <p className="text-sm font-medium text-muted-foreground">Authenticating your account...</p>
      </div>
    </div>
  ),
});
