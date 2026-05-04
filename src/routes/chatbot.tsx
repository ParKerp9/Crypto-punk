import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Bot, Send, Sparkles, User } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/chatbot")({
  head: () => ({ meta: [{ title: "AI Chatbot — Nebula Trade" }] }),
  component: ChatbotPage,
});

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Explain RSI and how to trade with it",
  "What is a good risk:reward ratio for swing trades?",
  "How does a stop-loss differ from a stop-limit?",
  "When does an EMA crossover signal a trend change?",
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crypto-chat`;

function ChatbotPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const userMsg: Msg = { role: "user", content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    let assistantSoFar = "";
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: next }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) toast.error("Rate limit reached. Try again shortly.");
        else if (resp.status === 402) toast.error("AI credits exhausted.");
        else toast.error("Failed to reach AI");
        setLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let done = false;
      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (c) upsert(c);
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell title="AI Chatbot" subtitle="Ask anything about crypto trading, strategies & analysis">
      <div className="flex h-[calc(100vh-12rem)] flex-col gap-4 rounded-xl glass-strong p-4">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto pr-2">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
              <div className="rounded-full bg-primary/15 p-4 ring-1 ring-primary/30">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="font-display text-2xl font-bold">NebulaBot at your service</h2>
                <p className="mt-1 text-sm text-muted-foreground">Your AI co-pilot for crypto markets and trading.</p>
              </div>
              <div className="grid w-full max-w-2xl gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-lg glass px-3 py-2.5 text-left text-sm text-muted-foreground transition hover:text-foreground hover:ring-1 hover:ring-primary/40"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "assistant" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/30">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "glass text-foreground"
                }`}
              >
                {m.role === "assistant" ? (
                  <div className="prose prose-sm prose-invert max-w-none prose-p:my-2 prose-headings:my-2 prose-pre:my-2 prose-ul:my-2 prose-ol:my-2">
                    <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                  </div>
                ) : (
                  <span className="whitespace-pre-wrap">{m.content}</span>
                )}
              </div>
              {m.role === "user" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 ring-1 ring-accent/30">
                  <User className="h-4 w-4 text-accent" />
                </div>
              )}
            </div>
          ))}

          {loading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/30">
                <Bot className="h-4 w-4 text-primary animate-pulse" />
              </div>
              <div className="glass rounded-2xl px-4 py-2.5 text-sm text-muted-foreground">Thinking…</div>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="flex gap-2 rounded-xl glass p-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about RSI, BTC trends, risk management…"
            className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
            disabled={loading}
          />
          <Button type="submit" disabled={loading || !input.trim()} className="gap-2">
            <Send className="h-4 w-4" />
            Send
          </Button>
        </form>
        <p className="text-center text-xs text-muted-foreground">
          Educational only. Not financial advice.
        </p>
      </div>
    </AppShell>
  );
}
