import { createFileRoute } from "@tanstack/react-router";
import { WaymarkApp } from "@/components/waymark-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <WaymarkApp />;
}
