import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({
    meta: [
      { title: "Reset password — Ace Ledger" },
      { name: "description", content: "Set a new password for your Ace Ledger account." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasSession(true);
      }
      setReady(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
      setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated");
    navigate({ to: "/", replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <KeyRound className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Reset password</CardTitle>
          <CardDescription>Enter a new password for your account</CardDescription>
        </CardHeader>
        <CardContent>
          {!ready ? (
            <p className="text-center text-sm text-muted-foreground">Loading…</p>
          ) : !hasSession ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-muted-foreground">
                This reset link is invalid or has expired. Please request a new one from the sign-in page.
              </p>
              <Button className="w-full" onClick={() => navigate({ to: "/login" })}>Back to sign in</Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newpw">New password</Label>
                <Input id="newpw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmpw">Confirm new password</Label>
                <Input id="confirmpw" type="password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>{loading ? "Updating…" : "Update password"}</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
