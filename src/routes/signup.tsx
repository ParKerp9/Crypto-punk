import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AuthShell, Field } from "./login";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Create account — Nebula Trade" }] }),
  component: SignupPage,
});

function SignupPage() {
  const { signUp, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/dashboard" });
  }, [user, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    const { error } = await signUp(email, password, name || email.split("@")[0]);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created — welcome aboard");
    navigate({ to: "/dashboard" });
  };

  return (
    <AuthShell title="Create account" sub="Boot up your trading console">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Display name" value={name} onChange={setName} />
        <Field label="Email" type="email" value={email} onChange={setEmail} required />
        <Field label="Password" type="password" value={password} onChange={setPassword} required />
        <button
          disabled={busy}
          className="flex w-full items-center justify-center rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50 neon-border"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have one?{" "}
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
