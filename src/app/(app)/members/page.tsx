"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Plus, Share2, Shield, UserMinus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AuthGuard } from "@/components/auth/auth-guard";
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
  const [contact, setContact] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const invite = useMutation({
    mutationFn: () => {
      const isEmail = contact.includes("@");
      return appApi.inviteMember({
        name: name.trim(),
        email: isEmail ? contact.trim() : undefined,
        phone: isEmail ? undefined : contact.trim(),
        role,
        mode: "invite_link",
      });
    },
    onSuccess: (res) => {
      setLink(res.invite_url);
      qc.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (e) => showApiError(e, "Could not add member"),
  });

  function reset() {
    setName("");
    setContact("");
    setRole("member");
    setLink(null);
    setCopied(false);
  }

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Link copied");
  }

  async function share() {
    if (!link) return;
    if (navigator.share) {
      await navigator.share({ title: "Join us on TrackBit", url: link }).catch(() => {});
    } else {
      copy();
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
      title="Add member"
    >
      {!link ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && contact.trim()) invite.mutate();
          }}
        >
          <div>
            <Label htmlFor="m-name">Name</Label>
            <Input id="m-name" autoFocus required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="m-contact">Phone or email</Label>
            <Input
              id="m-contact"
              required
              placeholder="+91… or name@email.com"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
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
            <Button type="submit" disabled={invite.isPending || !name.trim() || !contact.trim()}>
              {invite.isPending ? "Adding…" : "Add & get link"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {name} is added. Share this link so they can open TrackBit — no password needed.
          </p>
          <div className="break-all rounded-md border border-border bg-muted px-3 py-2 text-xs">{link}</div>
          <div className="flex gap-2">
            <Button onClick={copy} className="flex-1">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy link"}
            </Button>
            <Button variant="outline" onClick={share}>
              <Share2 className="h-4 w-4" /> Share
            </Button>
          </div>
          <Button variant="ghost" className="w-full" onClick={reset}>
            <Plus className="h-4 w-4" /> Add another
          </Button>
        </div>
      )}
    </Sheet>
  );
}

function MembersInner() {
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
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

  const members = data?.members ?? [];

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Members ({members.length})</h1>
        <Button size="sm" onClick={() => setInviteOpen(true)}>
          <Plus className="h-4 w-4" /> Add
        </Button>
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
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {m.email || m.phone || "no contact"} · active {timeAgo(m.last_active_at)}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
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
