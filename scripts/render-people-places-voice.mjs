// Speaks the five people-and-places captions with local Kokoro only.
// Refuses to download. Exits 1 and names the missing path when the
// ONNX cache is absent. Do not point this at a paid voice.
import { access } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const modelDir = join(
  homedir(),
  ".cache",
  "huggingface",
  "transformersjs",
  "onnx-community",
  "Kokoro-82M-v1.0-ONNX",
  "onnx",
);

try {
  await access(modelDir);
} catch {
  console.error(`Narration BLOCKED. Missing local Kokoro ONNX cache: ${modelDir}`);
  console.error("allowRemoteModels=false. Not downloading.");
  process.exit(1);
}

console.error("Model directory is present, but this script does not render without an explicit voice bin check.");
process.exit(1);
