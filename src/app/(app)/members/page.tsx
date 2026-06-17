"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Shield, UserMinus, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AuthGuard } from "@/components/auth/auth-guard";
import { BulkAddSheet } from "@/components/members/bulk-add-sheet";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet } from "@/components/ui/sheet";
import { ApiError } from "@/lib/api-client";
import { appApi } from "@/lib/app-api";
import { showApiError } from "@/lib/errors";
import type { Member } from "@/lib/types";

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function InviteSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [sent, setSent] = useState(false);

  const invite = useMutation({
    mutationFn: () => appApi.inviteMember({ name: name.trim(), email: email.trim(), role }),
    onSuccess: () => {
      setSent(true);
      qc.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (e) => showApiError(e, "Could not invite"),
  });

  function reset() {
    setName("");
    setEmail("");
    setRole("member");
    setSent(false);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
      title="Invite by email"
    >
      {!sent ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && email.trim()) invite.mutate();
          }}
        >
          <div>
            <Label htmlFor="m-name">Name</Label>
            <Input id="m-name" autoFocus required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="m-email">Email</Label>
            <Input
              id="m-email"
              type="email"
              required
              placeholder="name@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label>Role</Label>
            <div className="flex gap-2">
              {(["member", "admin"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`flex-1 rounded-md border px-3 py-2.5 text-sm capitalize ${
                    role === r ? "border-primary bg-accent" : "border-border"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="submit" disabled={invite.isPending || !name.trim() || !email.trim()}>
              {invite.isPending ? "Sending…" : "Send invite"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Invite sent to {email}. They&apos;ll get an email link to set a password and sign in.
          </p>
          <Button variant="ghost" className="w-full" onClick={reset}>
            <Plus className="h-4 w-4" /> Invite another
          </Button>
        </div>
      )}
    </Sheet>
  );
}

function MembersInner() {
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const { data } = useQuery({ queryKey: ["members"], queryFn: appApi.members });

  const changeRole = useMutation({
    mutationFn: (m: Member) => appApi.changeRole(m.user_id, m.role === "admin" ? "member" : "admin"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
      toast.success("Role updated");
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not change role"),
  });
  const remove = useMutation({
    mutationFn: (m: Member) => appApi.removeMember(m.user_id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["members"] });
      toast.success(
        res.orphaned_tasks > 0
          ? `Removed · ${res.orphaned_tasks} task(s) now unassigned`
          : "Member removed",
      );
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not remove"),
  });
  const resetPw = useMutation({
    mutationFn: ({ m, password }: { m: Member; password?: string }) =>
      appApi.resetMemberPassword(m.user_id, password),
    onSuccess: (res) => {
      if (res.mode === "link_sent") toast.success("Reset link sent");
      else toast.success(`Temp password set: ${res.password}`);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not reset"),
  });

  function onReset(m: Member) {
    if (m.email) {
      resetPw.mutate({ m });
      return;
    }
    const pw = window.prompt(`New temporary password for ${m.name} (min 8 chars):`);
    if (pw === null) return;
    if (pw.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    resetPw.mutate({ m, password: pw });
  }

  const members = data?.members ?? [];

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Members ({members.length})</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}>
            <Users className="h-4 w-4" /> Bulk add
          </Button>
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <Plus className="h-4 w-4" /> Invite
          </Button>
        </div>
      </header>

      <div className="space-y-2">
        {members.map((m) => (
          <div key={m.user_id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
            <Avatar name={m.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {m.name}
                {m.role === "admin" ? (
                  <Badge tone="primary" className="ml-2">
                    <Shield className="h-3 w-3" /> admin
                  </Badge>
                ) : null}
                {m.pending ? <Badge className="ml-2">pending</Badge> : null}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {m.email || m.username || m.phone || "no contact"} · active {timeAgo(m.last_active_at)}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button variant="ghost" size="sm" onClick={() => onReset(m)}>
                Reset password
              </Button>
              <Button variant="ghost" size="sm" onClick={() => changeRole.mutate(m)}>
                {m.role === "admin" ? "Make member" : "Make admin"}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove member"
                onClick={() => remove.mutate(m)}
              >
                <UserMinus className="h-4 w-4 text-danger" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <InviteSheet open={inviteOpen} onOpenChange={setInviteOpen} />
      <BulkAddSheet open={bulkOpen} onOpenChange={setBulkOpen} />
    </div>
  );
}

export default function MembersPage() {
  return (
    <AuthGuard requireRole="admin">
      <MembersInner />
    </AuthGuard>
  );
}
