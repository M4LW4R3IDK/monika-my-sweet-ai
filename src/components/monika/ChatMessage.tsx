import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import monikaAvatar from "@/assets/monika.jpg";

export type ChatRole = "user" | "assistant";

export type ChatMessageData = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
};

export function ChatMessage({ message }: { message: ChatMessageData }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-primary-foreground shadow-sm">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <img
        src={monikaAvatar}
        alt="Monika"
        className="mt-1 h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-emerald/60"
      />
      <div className="min-w-0 flex-1">
        <span className="font-display text-xs tracking-widest text-emerald uppercase">Monika</span>
        <div className="md-body max-w-none text-sm text-foreground">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
