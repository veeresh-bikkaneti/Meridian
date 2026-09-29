export async function rewriteStory(input: {
  placeId: string;
  authored: string;
  cached: string | null;
  availability: "available" | "downloadable" | "downloading" | "unavailable";
  ask: (authored: string) => Promise<string>;
}): Promise<{ text: string; store: string | null }> {
  if (input.cached !== null && input.cached.trim() !== "") {
    return { text: input.cached, store: null };
  }
  if (input.availability !== "available") {
    return { text: input.authored, store: null };
  }
  try {
    const text = (await input.ask(input.authored)).trim();
    const endings = text.match(/[.!?]/g);
    if (text === "" || (endings !== null && endings.length > 2)) {
      return { text: input.authored, store: null };
    }
    return { text, store: text };
  } catch {
    return { text: input.authored, store: null };
  }
}
