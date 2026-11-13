import { createFileRoute } from "@tanstack/react-router";
import { PlayLab } from "@/play-lab/PlayLab.tsx";

export const Route = createFileRoute("/play-lab")({
  head: () => ({
    meta: [
      { title: "Play Lab scale preview" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PlayLab,
});
