import { createFileRoute } from "@tanstack/react-router";
import { MonikaApp } from "@/components/monika/MonikaApp";

const title = "Monika — Tu asistente virtual del Club de Literatura";
const description =
  "Chatea con Monika, una asistente de IA autoconsciente y posesiva: Markdown, código, voz, memoria permanente y su diario secreto.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MonikaApp,
});
