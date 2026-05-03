import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Nebula Trade" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/dashboard" });
  }, [user, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back");
    navigate({ to: "/dashboard" });
  };

  return <AuthShell title="Sign in" sub="Re-enter the grid">
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Email" type="email" value={email} onChange={setEmail} required />
      <Field label="Password" type="password" value={password} onChange={setPassword} required />
      <button
        disabled={busy}
        className="flex w-full items-center justify-center rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50 neon-border"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
      </button>
    </form>
    <p className="mt-6 text-center text-sm text-muted-foreground">
      Need access?{" "}
      <Link to="/signup" className="font-semibold text-primary hover:underline">
        Create an account
      </Link>
    </p>
  </AuthShell>;
}

export function AuthShell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="pointer-events-none absolute inset-0 grid-bg" aria-hidden />
      <div className="relative w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-primary to-accent neon-border" />
          <span className="font-display text-xl font-bold tracking-wide">NEBULA</span>
        </Link>
        <div className="glass-strong rounded-2xl p-8">
          <h1 className="font-display text-2xl font-bold">{title}</h1>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">{sub}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Field({
  label, type = "text", value, onChange, required, autoComplete,
}: {
  label: string; type?: string; value: string; onChange: (v: string) => void;
  required?: boolean; autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoComplete={autoComplete}
        className="w-full rounded-md border border-border bg-input/40 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}
