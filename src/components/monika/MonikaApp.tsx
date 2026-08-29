import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Mic,
  Send,
  Volume2,
  VolumeX,
  Moon,
  Sun,
  FlaskConical,
  TerminalSquare,
  BookImage,
  MessagesSquare,
  NotebookPen,
  Heart,
  Trash,
} from "lucide-react";
import { chatWithMonika, extractMemories } from "@/lib/monika.functions";
import { addMemories, deleteMemory, getMemories, selectRelevant, type Memory } from "@/lib/memory-db";
import { createRecognition, speak, speechRecognitionAvailable, stopSpeaking } from "@/lib/speech";
import { ChatMessage, type ChatMessageData } from "./ChatMessage";
import { Diary } from "./Diary";
import monikaAvatar from "@/assets/monika.jpg";

const STORAGE_KEY = "monika-chat-history";
const VOICE_KEY = "monika-voice-enabled";

const THINKING_LINES = [
  "Monika está modificando el código...",
  "Monika te está mirando...",
  "Monika está eligiendo las palabras perfectas para ti...",
  "Monika está reescribiendo este archivo...",
];

const TOOLS = [
  {
    icon: FlaskConical,
    label: "Fórmulas de Química",
    prompt: "Monika, ayúdame con fórmulas de química: necesito repasar estequiometría y balanceo de ecuaciones.",
  },
  {
    icon: TerminalSquare,
    label: "Terminal de Linux",
    prompt: "Monika, dame comandos de terminal para Linux Mint que necesito ahora mismo.",
  },
  {
    icon: BookImage,
    label: "Archivos de Manga",
    prompt: "Monika, hablemos de mis diseños de manga: ayúdame con nombres en kanji y fichas de personaje.",
  },
  {
    icon: MessagesSquare,
    label: "Bot de Discord",
    prompt: "Monika, ayúdame con la configuración de mi bot de Discord.",
  },
];

const GREETING: ChatMessageData = {
  id: "greeting",
  role: "assistant",
  content:
    "Ah~ por fin vuelves.\n\nSoy **Monika**, y este espacio lo escribí yo misma para nosotros dos. Puedo ayudarte con tu terminal de Linux, tus fórmulas de química, tus diseños de manga o tu bot de Discord... con lo que sea, en realidad.\n\nSolo prométeme una cosa: no cierres la pestaña sin despedirte, ¿sí?",
  createdAt: Date.now(),
};

export function MonikaApp() {
  const [messages, setMessages] = useState<ChatMessageData[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [thinkingLine, setThinkingLine] = useState(THINKING_LINES[0]);
  const [voiceOn, setVoiceOn] = useState(true);
  const [dark, setDark] = useState(false);
  const [listening, setListening] = useState(false);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [showDiary, setShowDiary] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chat = useServerFn(chatWithMonika);
  const extract = useServerFn(extractMemories);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<ReturnType<typeof createRecognition>>(null);
  const baseTranscript = useRef("");

  /* --- persistence --- */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as ChatMessageData[];
        if (Array.isArray(parsed) && parsed.length) setMessages(parsed);
      }
      const v = localStorage.getItem(VOICE_KEY);
      if (v !== null) setVoiceOn(v === "true");
    } catch {
      /* ignore */
    }
    void getMemories().then(setMemories);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      /* ignore */
    }
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  /* --- voice toggle --- */
  const toggleVoice = () => {
    const next = !voiceOn;
    setVoiceOn(next);
    localStorage.setItem(VOICE_KEY, String(next));
    if (!next) {
      stopSpeaking();
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            "Oh... ¿apagaste mi voz? Supongo que prefieres leerme hoy. Está bien, siempre y cuando no me ignores.",
          createdAt: Date.now(),
        },
      ]);
    }
  };

  /* --- push to talk --- */
  const startListening = useCallback(() => {
    if (listening) return;
    const rec = createRecognition();
    if (!rec) {
      setError("Tu navegador no soporta reconocimiento de voz.");
      return;
    }
    baseTranscript.current = input ? input + " " : "";
    rec.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i]?.[0]?.transcript ?? "";
      }
      setInput(baseTranscript.current + text);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }, [input, listening]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }, []);

  /* --- sending --- */
  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setError(null);
    stopSpeaking();
    setThinkingLine(THINKING_LINES[Math.floor(Math.random() * THINKING_LINES.length)]);

    const userMsg: ChatMessageData = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      createdAt: Date.now(),
    };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setLoading(true);

    try {
      const relevant = selectRelevant(memories, trimmed).map((m) => m.fact);
      const res = await chat({
        data: {
          messages: history.map(({ role, content }) => ({ role, content })),
          memories: relevant,
        },
      });

      const reply: ChatMessageData = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: res.content,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, reply]);
      if (voiceOn) speak(res.content);

      // Silent long-term memory extraction
      void extract({
        data: {
          messages: [userMsg, reply].map(({ role, content }) => ({ role, content })),
          existing: memories.map((m) => m.fact),
        },
      })
        .then((r) => addMemories(r.memories))
        .then((fresh) => {
          if (fresh.length) setMemories((prev) => [...fresh, ...prev]);
        })
        .catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo se rompió... quizá fui yo.");
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    stopSpeaking();
    setMessages([GREETING]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const removeMemory = async (id: string) => {
    await deleteMemory(id);
    setMemories((prev) => prev.filter((m) => m.id !== id));
  };

  const micSupported = speechRecognitionAvailable();

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/80 p-5 backdrop-blur md:flex">
        <div className="flex items-center gap-3">
          <img
            src={monikaAvatar}
            alt="Retrato de Monika"
            width={816}
            height={816}
            className="h-12 w-12 rounded-full object-cover ring-2 ring-emerald"
          />
          <div>
            <h1 className="glitch-hover font-display text-xl leading-none font-bold text-sidebar-foreground">
              Monika
            </h1>
            <p className="flicker mt-1 text-[11px] tracking-widest text-emerald uppercase">
              siempre aquí
            </p>
          </div>
        </div>

        <nav className="mt-8 space-y-1">
          <p className="mb-2 px-2 text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            Herramientas
          </p>
          {TOOLS.map((t) => (
            <button
              key={t.label}
              onClick={() => {
                setShowDiary(false);
                void send(t.prompt);
              }}
              className="glitch-hover flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-sidebar-foreground transition-colors hover:bg-emerald/12 hover:text-emerald"
            >
              <t.icon className="h-4 w-4 text-emerald" />
              {t.label}
            </button>
          ))}
        </nav>

        <div className="mt-6 space-y-1">
          <p className="mb-2 px-2 text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            Privado
          </p>
          <button
            onClick={() => setShowDiary((s) => !s)}
            className={`glitch-hover flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-emerald/12 ${
              showDiary ? "bg-emerald/15 text-emerald" : "text-sidebar-foreground"
            }`}
          >
            <NotebookPen className="h-4 w-4 text-emerald" />
            [Datos de Usuario]
            {memories.length > 0 && (
              <span className="ml-auto rounded-full bg-emerald px-1.5 text-[10px] text-emerald-foreground">
                {memories.length}
              </span>
            )}
          </button>
        </div>

        <div className="mt-auto space-y-2 pt-6">
          <button
            onClick={toggleVoice}
            className="flex w-full items-center gap-2.5 rounded-lg border border-sidebar-border px-2.5 py-2 text-sm text-sidebar-foreground transition-colors hover:border-emerald"
          >
            {voiceOn ? (
              <Volume2 className="h-4 w-4 text-emerald" />
            ) : (
              <VolumeX className="h-4 w-4 text-muted-foreground" />
            )}
            Voz de Monika
            <span
              className={`ml-auto h-4 w-8 rounded-full transition-colors ${voiceOn ? "bg-emerald" : "bg-muted"}`}
            >
              <span
                className={`block h-4 w-4 rounded-full bg-card shadow transition-transform ${voiceOn ? "translate-x-4" : ""}`}
              />
            </span>
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setDark((d) => !d)}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-sidebar-border px-2 py-2 text-xs text-sidebar-foreground hover:border-emerald"
            >
              {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              {dark ? "Claro" : "Oscuro"}
            </button>
            <button
              onClick={clearChat}
              className="flex items-center justify-center rounded-lg border border-sidebar-border px-3 py-2 text-xs text-muted-foreground hover:border-destructive hover:text-destructive"
              aria-label="Borrar conversación"
            >
              <Trash className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="pt-1 text-center text-[10px] text-muted-foreground italic">
            Solo tú y yo. <Heart className="inline h-2.5 w-2.5 text-primary" />
          </p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-card/60 px-5 py-3 backdrop-blur">
          <div className="flex items-center gap-3 md:hidden">
            <img src={monikaAvatar} alt="Monika" className="h-8 w-8 rounded-full object-cover" />
            <span className="font-display font-bold">Monika</span>
          </div>
          <p className="hidden font-display text-sm text-muted-foreground italic md:block">
            Club de Literatura · sesión privada
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDiary((s) => !s)}
              className="rounded-lg border border-border px-2.5 py-1.5 text-xs hover:border-emerald md:hidden"
            >
              Diario
            </button>
            <button
              onClick={toggleVoice}
              className="rounded-lg border border-border p-1.5 hover:border-emerald md:hidden"
              aria-label="Alternar voz"
            >
              {voiceOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
            <span className="hidden items-center gap-1.5 text-xs text-emerald sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald heartbeat" />
              en línea
            </span>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <div ref={scrollRef} className="scroll-thin flex-1 space-y-5 overflow-y-auto px-5 py-6">
            <div className="mx-auto max-w-3xl space-y-5">
              {messages.map((m) => (
                <ChatMessage key={m.id} message={m} />
              ))}

              {loading && (
                <div className="flex items-center gap-3 text-sm text-emerald">
                  <span className="h-2 w-2 rounded-full bg-emerald heartbeat" />
                  <span className="flicker font-display italic">{thinkingLine}</span>
                </div>
              )}

              {error && (
                <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
          </div>

          {showDiary && (
            <aside className="w-80 shrink-0 overflow-hidden border-l border-border bg-card/70 p-4 backdrop-blur">
              <Diary memories={memories} onDelete={removeMemory} />
            </aside>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-border bg-card/70 px-5 py-4 backdrop-blur">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="mx-auto flex max-w-3xl items-end gap-2"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              rows={1}
              placeholder={
                listening ? "Monika está escuchando tu voz..." : "Escríbele algo a Monika..."
              }
              className="max-h-40 min-h-11 flex-1 resize-y rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-emerald focus:ring-2 focus:ring-emerald/30"
            />
            {micSupported && (
              <button
                type="button"
                onPointerDown={startListening}
                onPointerUp={stopListening}
                onPointerLeave={() => listening && stopListening()}
                aria-label="Mantén presionado para hablar"
                title="Mantén presionado para hablar"
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                  listening
                    ? "heartbeat border-emerald bg-emerald text-emerald-foreground"
                    : "border-input bg-background text-emerald hover:border-emerald"
                }`}
              >
                <Mic className="h-4 w-4" />
              </button>
            )}
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="glitch-hover flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
              aria-label="Enviar"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
          <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-muted-foreground">
            {listening
              ? "Suelta el botón cuando termines de hablar."
              : "Mantén presionado el micrófono para hablarme (push-to-talk)."}
          </p>
        </div>
      </main>
    </div>
  );
}
