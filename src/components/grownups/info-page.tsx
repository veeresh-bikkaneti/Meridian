/**
 * Shared shell for the plain grown-ups pages (/privacy, /contact).
 *
 * Deliberately simple and readable: a single column, the app's own colour
 * tokens, a "Back to the game" link. These pages are for parents and
 * teachers, so they carry no mascots, sounds, or game chrome.
 */
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

export function InfoPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-5 px-5 py-10 text-fg">
      <p>
        <Link to="/" className="text-sm underline underline-offset-4" data-testid="info-back-home">
          ← Back to the game
        </Link>
      </p>
      <h1 className="text-3xl font-semibold">{title}</h1>
      <div className="flex flex-col gap-5 leading-relaxed [&_h2]:mt-2 [&_h2]:text-xl [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-6 [&_a]:underline [&_a]:underline-offset-4">
        {children}
      </div>
    </main>
  );
}
