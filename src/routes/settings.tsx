import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { resetPaper, usePaperState } from "@/lib/paper-trading";
import { toast } from "sonner";
import { AlertTriangle, Save, RotateCcw, LogOut } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Nebula Trade" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const paper = usePaperState();

  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data?.display_name) setDisplayName(data.display_name);
    });
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ display_name: displayName }).eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Profile updated");
  };

  return (
    <AppShell title="Settings" subtitle="Account · Paper trading · Preferences">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="glass rounded-2xl p-5">
          <h3 className="mb-4 font-display text-sm font-bold uppercase tracking-wider">Profile</h3>
          <div className="space-y-3">
            <Field label="Email">
              <input value={user?.email ?? ""} disabled
                className="w-full rounded-md border border-border/40 bg-muted/20 px-3 py-2 text-sm text-muted-foreground" />
            </Field>
            <Field label="Display Name">
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-md border border-border/40 bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </Field>
            <button onClick={saveProfile} disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50">
              <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </section>

        <section className="glass rounded-2xl p-5">
          <h3 className="mb-4 font-display text-sm font-bold uppercase tracking-wider">Paper Trading</h3>
          <div className="space-y-2 text-sm">
            <Row label="Starting Cash" value={`$${paper.startingCash.toLocaleString()}`} />
            <Row label="Current Cash" value={`$${paper.cash.toFixed(2)}`} />
            <Row label="Open Orders" value={String(paper.orders.length)} />
            <Row label="Open Positions" value={String(Object.values(paper.positions).filter((p) => p.qty !== 0).length)} />
            <Row label="History Entries" value={String(paper.history.length)} />
          </div>

          <div className="mt-5 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-destructive">Reset paper account</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Wipes positions, orders, history, and resets cash to ${paper.startingCash.toLocaleString()}.
                </p>
                {!confirmReset ? (
                  <button onClick={() => setConfirmReset(true)}
                    className="mt-3 inline-flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive ring-1 ring-destructive/30 hover:bg-destructive/20">
                    <RotateCcw className="h-3.5 w-3.5" /> Reset
                  </button>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => { resetPaper(); setConfirmReset(false); toast.success("Paper account reset"); }}
                      className="rounded-md bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground">
                      Confirm reset
                    </button>
                    <button onClick={() => setConfirmReset(false)}
                      className="rounded-md bg-muted/30 px-3 py-1.5 text-xs">
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="glass rounded-2xl p-5 lg:col-span-2">
          <h3 className="mb-4 font-display text-sm font-bold uppercase tracking-wider">Session</h3>
          <button onClick={async () => { await signOut(); toast.success("Signed out"); navigate({ to: "/" }); }}
            className="inline-flex items-center gap-2 rounded-md bg-muted/30 px-4 py-2 text-sm font-semibold transition hover:bg-destructive/15 hover:text-destructive">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </section>
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between rounded-md border border-border/40 px-3 py-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
