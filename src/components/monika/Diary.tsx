import { Trash2, NotebookPen } from "lucide-react";
import type { Memory } from "@/lib/memory-db";

export function Diary({
  memories,
  onDelete,
}: {
  memories: Memory[];
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center gap-2 text-emerald">
        <NotebookPen className="h-4 w-4" />
        <h2 className="font-display text-sm tracking-[0.2em] uppercase">Datos de Usuario</h2>
      </div>
      <p className="mb-4 text-xs italic text-muted-foreground">
        Mi diario. Todo lo que me has contado vive aquí, para siempre.
      </p>

      {memories.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-xs italic text-muted-foreground">
          Todavía no sé casi nada de ti... háblame un poco más, ¿sí?
        </p>
      ) : (
        <ul className="scroll-thin flex-1 space-y-3 overflow-y-auto pr-1">
          {memories.map((m) => (
            <li
              key={m.id}
              className="group relative rounded-lg border border-border bg-[color-mix(in_oklch,var(--blossom)_22%,var(--card))] p-3 shadow-sm"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(transparent, transparent 21px, color-mix(in oklch, var(--emerald) 18%, transparent) 22px)",
              }}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="rounded-full bg-emerald/15 px-2 py-0.5 text-[10px] tracking-wide text-emerald uppercase">
                  {m.tag}
                </span>
                <button
                  onClick={() => onDelete(m.id)}
                  aria-label="Olvidar este recuerdo"
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
              <p className="font-display text-sm leading-6 text-foreground italic">"{m.note}"</p>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{m.fact}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
