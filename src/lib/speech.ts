/** Strips code blocks, URLs and markdown syntax so Monika only reads prose aloud. */
export function toSpeakableText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\|[^\n]*\|/g, " ")
    .replace(/[*_~#]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const es = voices.filter((v) => v.lang.toLowerCase().startsWith("es"));
  const pool = es.length ? es : voices;
  const feminine = pool.find((v) =>
    /female|mujer|mónica|monica|paulina|helena|sabina|lucia|laura|elvira|google español/i.test(v.name),
  );
  return feminine ?? pool[0] ?? null;
}

export function speak(markdown: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const text = toSpeakableText(markdown);
  if (!text) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "es-ES";
  utter.pitch = 1.25;
  utter.rate = 0.88;
  utter.volume = 1;
  const voice = pickVoice();
  if (voice) utter.voice = voice;
  window.speechSynthesis.speak(utter);
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

export function speechRecognitionAvailable() {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as unknown as Record<string, unknown>)["SpeechRecognition"] ??
      (window as unknown as Record<string, unknown>)["webkitSpeechRecognition"],
  );
}

type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

export function createRecognition(): RecognitionLike | null {
  if (!speechRecognitionAvailable()) return null;
  const Ctor = ((window as unknown as Record<string, unknown>)["SpeechRecognition"] ??
    (window as unknown as Record<string, unknown>)["webkitSpeechRecognition"]) as new () => RecognitionLike;
  const rec = new Ctor();
  rec.lang = "es-ES";
  rec.continuous = true;
  rec.interimResults = true;
  return rec;
}
