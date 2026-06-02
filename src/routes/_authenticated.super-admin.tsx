import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-context";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Shield, Search, RefreshCw, Users, Activity, AlertTriangle, CalendarDays, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/super-admin")({
  component: SuperAdminPage,
  head: () => ({
    meta: [
      { title: "Super Admin Panel — Ace Ledger" },
      { name: "description", content: "Global user account tracking and subscription access control." },
    ],
  }),
});

interface TenantProfile {
  user_id: string;
  email: string;
  created_at: string;
  trial_ends_at: string;
  status: "trialing" | "active" | "suspended";
  last_active_at: string;
}

function SuperAdminPage() {
  const { user } = useApp();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [extendUser, setExtendUser] = useState<TenantProfile | null>(null);
  const [daysInput, setDaysInput] = useState("30");

  // Route Guard: only permit mansoorshahzadpk@gmail.com
  if (user?.email !== "mansoorshahzadpk@gmail.com") {
    return <Navigate to="/" replace />;
  }

  // Fetch all user tenant profiles
  const { data: users = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["admin_tenant_profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_get_tenant_profiles" as any);
      if (error) {
        toast.error("Failed to load tenant profiles: " + error.message);
        throw error;
      }
      return (data || []) as TenantProfile[];
    },
  });

  // Toggle user active status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ userId, nextStatus }: { userId: string; nextStatus: string }) => {
      const { error } = await supabase.rpc("admin_update_tenant_status" as any, {
        _target_user_id: userId,
        _new_status: nextStatus,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("User access status updated");
      qc.invalidateQueries({ queryKey: ["admin_tenant_profiles"] });
    },
    onError: (err: any) => {
      toast.error("Status update failed: " + err.message);
    },
  });

  const handleToggle = (userId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "suspended" ? "active" : "suspended";
    toggleStatusMutation.mutate({ userId, nextStatus });
  };

  const extendTrialMutation = useMutation({
    mutationFn: async ({ userId, days }: { userId: string; days: number }) => {
      const { error } = await supabase.rpc("admin_extend_trial" as any, {
        _target_user_id: userId,
        _days: days,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("User access extended successfully");
      setExtendUser(null);
      qc.invalidateQueries({ queryKey: ["admin_tenant_profiles"] });
    },
    onError: (err: any) => {
      toast.error("Failed to extend access: " + err.message);
    },
  });

  const handleExtendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendUser) return;
    const days = parseInt(daysInput);
    if (isNaN(days) || days <= 0) {
      toast.error("Please enter a valid number of days");
      return;
    }
    extendTrialMutation.mutate({ userId: extendUser.user_id, days });
  };

  const deleteMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string; email: string }) => {
      const { error } = await supabase.rpc("admin_delete_user" as any, {
        _target_user_id: userId,
      });
      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      toast.success("User account and associated records deleted successfully");
      qc.invalidateQueries({ queryKey: ["admin_tenant_profiles"] });
    },
    onError: (err: any) => {
      toast.error("Failed to delete user account: " + err.message);
    }
  });

  const handleDeleteUser = (userId: string, email: string) => {
    deleteMutation.mutate({ userId, email });
  };

  // Compute stats
  const totalAccounts = users.length;
  const activeUsers24h = users.filter((u) => {
    if (!u.last_active_at) return false;
    const lastActive = new Date(u.last_active_at);
    const diffMs = Date.now() - lastActive.getTime();
    return diffMs <= 24 * 60 * 60 * 1000;
  }).length;

  const getTrialDaysRemaining = (trialEndsAt: string) => {
    const trialEnds = new Date(trialEndsAt);
    const diffMs = trialEnds.getTime() - Date.now();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  // Filter users by search input
  const filteredUsers = users.filter((u) =>
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary shrink-0" />
            Super Admin Control Panel
          </h1>
          <p className="text-sm text-muted-foreground">
            System-wide user administration, subscription statuses, and account suspension controls.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading || isRefetching}
          className="self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
          Refresh Data
        </Button>
      </div>

      {/* Metrics Section */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Total Registered Accounts
                </p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">
                  {isLoading ? "..." : totalAccounts}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="h-6 w-6" />
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Total signups in your platform database</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Currently Active Users
                </p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-success">
                  {isLoading ? "..." : activeUsers24h}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10 text-success">
                <Activity className="h-6 w-6" />
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Users who logged in or were active in the last 24 hours</p>
          </CardContent>
        </Card>
      </div>

      {/* User Accounts Table */}
      <Card>
        <CardHeader>
          <CardTitle>User Directory</CardTitle>
          <CardDescription>
            Search, inspect trial balances, and manage status constraints. Suspended accounts are limited to read-only views.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by user email address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-full sm:max-w-md"
            />
          </div>

          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User Email</TableHead>
                  <TableHead>Account Created</TableHead>
                  <TableHead className="text-center">Access Days Remaining</TableHead>
                  <TableHead className="text-center">Database Status</TableHead>
                  <TableHead className="w-48 text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                      Loading users list...
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                      No user accounts found matching your query.
                    </TableCell>
                  </TableRow>
                )}
                {filteredUsers.map((u) => {
                  const trialDays = getTrialDaysRemaining(u.trial_ends_at);
                  const isTrialExpired = new Date(u.trial_ends_at) < new Date();
                  const isUserSuspended = u.status === "suspended";

                  return (
                    <TableRow key={u.user_id}>
                      <TableCell className="font-medium">{u.email}</TableCell>
                      <TableCell className="tabular">{formatDate(u.created_at)}</TableCell>
                      <TableCell className="text-center tabular">
                        {u.status === "active" ? (
                          new Date(u.trial_ends_at).getFullYear() >= 2090 ? (
                            <Badge variant="outline" className="border-emerald-500/30 text-emerald-500 bg-emerald-500/5">
                              Unlimited (Paid)
                            </Badge>
                          ) : isTrialExpired ? (
                            <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/10">
                              Expired (0 days)
                            </Badge>
                          ) : (
                            <span className="font-semibold text-emerald-600">{trialDays} days</span>
                          )
                        ) : isTrialExpired ? (
                          <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/10">
                            Expired (0 days)
                          </Badge>
                        ) : (
                          <span className="font-semibold">{trialDays} days</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {isUserSuspended ? (
                          <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/10 flex items-center gap-1 w-fit mx-auto">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            Suspended
                          </Badge>
                        ) : u.status === "active" ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 border-emerald-500/30 font-medium">
                            Active
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-500/10 text-blue-600 hover:bg-blue-500/10 border-blue-500/20 font-medium">
                            Trialing
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-3">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={!isUserSuspended}
                              onCheckedChange={() => handleToggle(u.user_id, u.status)}
                              disabled={toggleStatusMutation.isPending}
                              className="cursor-pointer"
                            />
                            <span className="text-xs text-muted-foreground w-12 text-left">
                              {!isUserSuspended ? "Enabled" : "Disabled"}
                            </span>
                          </div>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary cursor-pointer shrink-0"
                            onClick={() => {
                              setExtendUser(u);
                              setDaysInput("30");
                            }}
                            title="Enable for Selected Days"
                          >
                            <CalendarDays className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 cursor-pointer shrink-0"
                            onClick={() => {
                              if (confirm(`Are you absolutely sure you want to completely delete the account for ${u.email}? This action is permanent and will delete all their data.`)) {
                                handleDeleteUser(u.user_id, u.email);
                              }
                            }}
                            title="Delete Account"
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Extend access dialog */}
      <Dialog open={!!extendUser} onOpenChange={(o) => !o && setExtendUser(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleExtendSubmit}>
            <DialogHeader>
              <DialogTitle>Enable for Selected Days</DialogTitle>
              <DialogDescription>
                Set a specific number of access days for <span className="font-semibold text-foreground text-sm">{extendUser?.email}</span>.
                This will set their status to active and update their expiration date.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="days-input" className="text-right">
                  Days
                </Label>
                <Input
                  id="days-input"
                  type="number"
                  min="1"
                  required
                  value={daysInput}
                  onChange={(e) => setDaysInput(e.target.value)}
                  className="col-span-3"
                  placeholder="e.g. 7, 30, 90"
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setExtendUser(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={extendTrialMutation.isPending}>
                {extendTrialMutation.isPending ? "Updating..." : "Grant Access"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
