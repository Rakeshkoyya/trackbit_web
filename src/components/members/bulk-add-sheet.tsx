"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { appApi } from "@/lib/app-api";
import { showApiError } from "@/lib/errors";
import type { BulkMemberInput, BulkMembersResult, OrgRole } from "@/lib/types";

type Row = BulkMemberInput;
const blankRow = (): Row => ({ name: "", username: "", password: "", role: "member" });

export function BulkAddSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[]>([blankRow(), blankRow(), blankRow()]);
  const [result, setResult] = useState<BulkMembersResult | null>(null);
  const [copied, setCopied] = useState(false);

  const save = useMutation({
    mutationFn: () => {
      const valid = rows.filter((r) => r.name.trim() && r.username.trim() && r.password.length >= 8);
      return appApi.bulkAddMembers(
        valid.map((r) => ({ ...r, name: r.name.trim(), username: r.username.trim() })),
      );
    },
    onSuccess: (res) => {
      setResult(res);
      qc.invalidateQueries({ queryKey: ["members"] });
      const failed = res.results.filter((r) => !r.ok);
      if (failed.length) toast.error(`${res.created} added · ${failed.length} failed`);
      else toast.success(`${res.created} member(s) added`);
    },
    onError: (e) => showApiError(e, "Could not add members"),
  });

  function update(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function reset() {
    setRows([blankRow(), blankRow(), blankRow()]);
    setResult(null);
    setCopied(false);
  }

  async function copySummary() {
    if (!result) return;
    const text = result.results
      .filter((r) => r.ok)
      .map((r) => `${r.name}\t${r.username}\t${r.password}`)
      .join("\n");
    await navigator.clipboard.writeText(`Name\tUsername\tPassword\n${text}`);
    setCopied(true);
    toast.success("Credentials copied");
  }

  const canSave = rows.some((r) => r.name.trim() && r.username.trim() && r.password.length >= 8);

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
      title="Bulk add staff"
    >
      {!result ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Add staff who don&apos;t have email. Each gets a username + password; they&apos;ll be
            asked to change the password on first login.
          </p>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input placeholder="Name" value={r.name} onChange={(e) => update(i, { name: e.target.value })} />
                <Input
                  placeholder="username"
                  autoCapitalize="none"
                  value={r.username}
                  onChange={(e) => update(i, { username: e.target.value })}
                />
                <Input
                  placeholder="password"
                  value={r.password}
                  onChange={(e) => update(i, { password: e.target.value })}
                />
                <select
                  className="rounded-md border border-border bg-background px-2 py-2 text-sm"
                  value={r.role}
                  onChange={(e) => update(i, { role: e.target.value as OrgRole })}
                >
                  <option value="member">member</option>
                  <option value="admin">admin</option>
                </select>
                <button
                  type="button"
                  aria-label="Remove row"
                  onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs))}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setRows((rs) => [...rs, blankRow()])}>
            <Plus className="h-4 w-4" /> Add row
          </Button>
          <div className="flex justify-end pt-2">
            <Button disabled={!canSave || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Saving…" : "Save staff"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {result.created} added. Copy these credentials and share them — passwords aren&apos;t
            shown again.
          </p>
          <div className="space-y-1 rounded-md border border-border bg-muted p-3 text-xs">
            {result.results.map((r, i) => (
              <div key={i} className={r.ok ? "" : "text-danger"}>
                {r.ok
                  ? `${r.name} — ${r.username} / ${r.password}`
                  : `${r.name} (${r.username}) — failed: ${r.error}`}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={copySummary} className="flex-1">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy credentials"}
            </Button>
            <Button variant="outline" onClick={reset}>
              Add more
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
