import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd(); // npm test always runs from the repo root
const read = (p: string): string => readFileSync(join(root, p), "utf8");

const stylesCss = () => read("src/styles.css");
const tokensCss = () => read("src/styles/motion-tokens.css");

/** Extract `name: value` pairs from a :root block. */
function rootVars(css: string): Map<string, string> {
  const block = css.match(/:root\s*{([^}]*)}/);
  assert.ok(block, "no :root block found");
  const vars = new Map<string, string>();
  for (const m of block![1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    vars.set(m[1], m[2].trim().replace(/\s+/g, ""));
  }
  return vars;
}

describe("M0 — motion tokens", () => {
  it("styles.css imports the token file first", () => {
    const css = stylesCss();
    const tailwind = css.indexOf('@import "tailwindcss"');
    const tokens = css.indexOf('@import "./styles/motion-tokens.css"');
    assert.ok(tailwind >= 0 && tokens > tailwind, "token import must follow tailwind import");
  });

  it("defines all 9 measured curves with the frozen values", () => {
    const vars = rootVars(tokensCss());
    const expected: Record<string, string> = {
      "--ease-soft-land": "cubic-bezier(0.22,1,0.36,1)",
      "--ease-glide": "cubic-bezier(0.61,1,0.88,1)",
      "--ease-snap-settle": "cubic-bezier(0.16,1,0.3,1)",
      "--ease-accel-exit": "cubic-bezier(0.55,0,0.85,0.36)",
      "--ease-gentle-in": "cubic-bezier(0.42,0,1,1)",
      "--ease-pop-over": "cubic-bezier(0.34,1.3,0.64,1)",
      "--ease-whip": "cubic-bezier(0.2,1,0.3,1)",
      "--ease-soft-in-out": "cubic-bezier(0.42,0,0.58,1)",
      "--ease-cruise": "linear",
    };
    for (const [name, value] of Object.entries(expected)) {
      assert.equal(vars.get(name), value, `${name} frozen value`);
    }
  });

  it("collapses all transitions/animations under prefers-reduced-motion", () => {
    const css = tokensCss();
    const reduceBlock = css.match(
      /@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*{([\s\S]*?)}\s*$/,
    );
    assert.ok(reduceBlock, "no reduced-motion block in token file");
    const body = reduceBlock![1];
    assert.ok(/::before/.test(body) && /::after/.test(body), "collapse covers pseudo-elements");
    assert.ok(
      /transition-duration:\s*0\.01ms\s*!important/.test(body),
      "transitions collapse to 0.01ms",
    );
    assert.ok(/animation:\s*none\s*!important/.test(body), "animations collapse to none");
  });
});

describe("M1 — storyteller enter/exit curves (durations frozen)", () => {
  const css = () => read("src/components/storyteller-mascot.css");

  it("storyteller-in: 220ms + soft-land token", () => {
    assert.match(
      css(),
      /\.storyteller-enter\s*{\s*animation:\s*storyteller-in\s+220ms\s+var\(--ease-soft-land\);/,
      "storyteller-enter retuned",
    );
  });

  it("storyteller-out: 150ms + accel-exit token, forwards retained", () => {
    assert.match(
      css(),
      /\.storyteller-leave\s*{\s*animation:\s*storyteller-out\s+150ms\s+var\(--ease-accel-exit\)\s+forwards;/,
      "storyteller-leave retuned",
    );
  });

  it("reduced-motion opacity-only path untouched", () => {
    const reduce = css().match(
      /@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*{([\s\S]*)}/,
    );
    assert.ok(reduce, "reduced-motion block missing");
    assert.match(reduce![1], /\.storyteller-enter\s*{\s*animation:\s*storyteller-out\s+150ms\s+linear\s+reverse;/);
    assert.match(reduce![1], /\.storyteller-figure\s*{\s*animation:\s*none;/);
  });
});

describe("M2 — GeoDetective clue-reveal Rise", () => {
  const loop = () => read("src/game/loop/LoopScreen.tsx");

  it("stagger table has uneven 50–70ms gaps", () => {
    const m = loop().match(/const CLUE_RISE_DELAY_MS = \[([^\]]+)\]/);
    assert.ok(m, "CLUE_RISE_DELAY_MS missing");
    const delays = m![1].split(",").map((s) => Number(s.trim()));
    assert.deepEqual(delays, [0, 60, 125, 185, 255]);
    const gaps = delays.slice(1).map((d, i) => d - delays[i]);
    assert.ok(gaps.every((g) => g >= 50 && g <= 70), `gaps ${gaps} must be 50–70ms`);
    assert.ok(new Set(gaps).size > 1, `gaps ${gaps} must be uneven`);
  });

  it("Rise: 400ms snap-settle when motion allowed, 150ms opacity fade when reduced", () => {
    const src = loop();
    assert.ok(
      src.includes('transitionDuration: reduced ? "150ms" : "400ms"'),
      "400ms/150ms duration contract",
    );
    assert.ok(
      src.includes('transitionTimingFunction: "var(--ease-snap-settle)"'),
      "curve now named via token",
    );
    assert.ok(!src.includes("ease-[cubic-bezier(0.16,1,0.3,1)]"), "raw curve removed");
  });

  it("Rise takes an optional index and ClueCard passes the clue index", () => {
    const src = loop();
    assert.match(src, /index\?:\s*number;/, "Rise accepts optional index");
    assert.match(src, /<Rise key=\{`revealed-\$\{index\}`\} reduced=\{reduced\} index=\{index\}>/);
  });

  it("no stagger delay leaks into the reduced-motion fade", () => {
    assert.ok(
      loop().includes("index === undefined || reduced ? 0 :"),
      "delay forced to 0 under reduced motion",
    );
  });

  it("result-card Rise duplicate: 400ms + token curve", () => {
    const src = read("src/components/result-card.tsx");
    assert.ok(src.includes('transitionDuration: reduced ? "150ms" : "400ms"'));
    assert.ok(src.includes('transitionTimingFunction: "var(--ease-snap-settle)"'));
  });
});

describe("M3 — grandpa-coffee-run curves only", () => {
  const css = () => read("src/components/grandpa-coffee-run.css");

  it("kettle-drop (both beats): 2800ms frozen, soft-land token", () => {
    const hits = css().match(/animation:\s*kettle-drop\s+2800ms\s+var\(--ease-soft-land\)\s+forwards;/g);
    assert.equal(hits?.length, 2, "strip + tour beats retuned");
    assert.ok(!/kettle-drop\s+2800ms\s+cubic-bezier\(0\.5,\s*0,\s*0\.6,\s*1\)/.test(css()));
  });

  it("pour-steam-burst (both beats): 2800ms frozen, glide token", () => {
    const hits = css().match(/animation:\s*pour-steam-burst\s+2800ms\s+var\(--ease-glide\)\s+forwards;/g);
    assert.equal(hits?.length, 2, "strip + tour beats retuned");
  });

  it("bubble-pane-in: 0.22s frozen, soft-land token", () => {
    assert.match(css(), /\.bubble-pane\s*{\s*animation:\s*bubble-pane-in\s+0\.22s\s+var\(--ease-soft-land\);\s*}/);
  });

  it("cane-tap: glide down (0.8s frozen), pop-over release", () => {
    const src = css();
    assert.match(src, /\.cane\s*{[\s\S]*?animation:\s*cane-tap\s+0\.8s\s+var\(--ease-glide\)\s+infinite;/);
    assert.match(
      src,
      /50%\s*{\s*transform:\s*rotate\(5deg\);\s*animation-timing-function:\s*var\(--ease-pop-over\);\s*}/,
      "release segment gets pop-over timing",
    );
  });

  it("ambient loops untouched (idle-motion ruling pending)", () => {
    const src = css();
    assert.match(src, /animation:\s*grandpa-bob\s+0\.8s\s+ease-in-out\s+infinite;/);
    assert.match(src, /animation:\s*steam-rise\s+2\.2s\s+ease-in\s+infinite;/);
    assert.match(src, /animation:\s*mug-invite\s+6s\s+ease-in-out\s+infinite;/);
    assert.ok(!/var\(--ease-(soft-land|glide|pop-over)\)/.test(
      src.match(/\.grandpa-bob\s*{[\s\S]*?}/)?.[0] ?? "",
    ), "bob untouched by tokens");
  });
});

describe("M4 — grandpa WAAPI squash easing labels", () => {
  const src = () => read("src/components/grandpa-mascot.tsx");
  const GLIDE = "cubic-bezier(0.61,1,0.88,1)";
  const POP = "cubic-bezier(0.34,1.3,0.64,1)";

  it("press segment gets the glide curve (WAAPI: keyframe 0 drives segment 0→1)", () => {
    assert.ok(
      src().includes(`{ transform: "scale(1, 1)", easing: "${GLIDE}" }`),
      "press = glide",
    );
  });

  it("all three release segments get the pop-over curve", () => {
    const count = src().split(POP).length - 1;
    assert.equal(count, 3, `pop-over appears 3× (release), got ${count}`);
  });

  it("keyframe offsets and total duration frozen", () => {
    const s = src();
    assert.ok(s.includes("offset: 0.18") && s.includes("offset: 0.45") && s.includes("offset: 0.72"));
    assert.ok(s.includes("const SQUASH_MS = 420;"));
    assert.ok(!/easing:\s*"ease-(in|out|in-out)"/.test(s), "no stale easing labels remain");
  });
});

describe("M5 — celebration pop curve + child stagger", () => {
  const css = () => read("src/components/celebration-overlay.css");

  it("celebrate-pop: 0.55s frozen, pop-over token, fill-mode both", () => {
    assert.match(
      css(),
      /\.celebration-pop\s*{\s*animation:\s*celebrate-pop\s+0\.55s\s+var\(--ease-pop-over\)\s+both;/,
    );
    assert.ok(!css().includes("cubic-bezier(0.2, 1.4, 0.4, 1)"), "old curve gone");
  });

  it("children stagger at uneven ~65ms gaps", () => {
    const src = css();
    const delays: number[] = [];
    for (let i = 1; i <= 3; i++) {
      const m = src.match(new RegExp(`\\.celebration-child-${i}\\s*{\\s*animation-delay:\\s*(\\d+)ms;\\s*}`));
      assert.ok(m, `celebration-child-${i} delay rule missing`);
      delays.push(Number(m![1]));
    }
    const gaps = delays.map((d, i) => (i === 0 ? d : d - delays[i - 1]));
    assert.ok(gaps.every((g) => g >= 45 && g <= 85), `gaps ${gaps} ≈ 65ms`);
    assert.ok(new Set(gaps).size > 1, `gaps ${gaps} must be uneven`);
  });

  it("reduced-motion full kill untouched", () => {
    const reduce = css().match(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*{([\s\S]*)}/);
    assert.ok(reduce, "reduced-motion block missing");
    assert.match(reduce![1], /animation:\s*none\s*!important;/);
    assert.match(reduce![1], /transition-duration:\s*0\.01ms\s*!important;/);
  });

  it("tsx wires the three stagger classes to label/headline/copy", () => {
    const src = read("src/components/celebration-overlay.tsx");
    assert.ok(src.includes("celebration-child celebration-child-1"));
    assert.ok(src.includes("celebration-child celebration-child-2"));
    assert.ok(src.includes("celebration-child celebration-child-3"));
  });
});

describe("M6 — edition-card press feedback", () => {
  it(":active rule: scale 0.97 + brighten, 80ms glide press / 200ms pop-over release", () => {
    const src = stylesCss();
    assert.match(
      src,
      /\.atlas-card\s+\.atlas-btn:active\s*{[\s\S]*?transform:\s*scale\(0\.97\);[\s\S]*?filter:\s*brightness\(1\.12\);[\s\S]*?transition:[\s\S]*?transform\s+80ms\s+var\(--ease-glide\),[\s\S]*?filter\s+80ms\s+var\(--ease-glide\),/,
      ":active press rule",
    );
    assert.match(
      src,
      /\.atlas-card\s+\.atlas-btn\s*{[\s\S]*?transition:[\s\S]*?transform\s+200ms\s+var\(--ease-pop-over\),[\s\S]*?filter\s+200ms\s+var\(--ease-pop-over\),/,
      "release rule",
    );
    assert.ok(!/\.atlas-card\s+\.atlas-btn:active\s*{[^}]*transition-delay/.test(src), "no delayed press");
  });

  it("no press feedback under reduced motion", () => {
    // Capture the whole media block: it ends right before the next section
    // banner comment.
    const block = stylesCss().match(
      /\/\* ---- Reduced motion: everything lands instantly, fully visible ---- \*\/\s*@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*{([\s\S]*?)\n}\n\n\/\* =/,
    );
    assert.ok(block, "reduced-motion block missing");
    assert.match(
      block![1],
      /\.atlas-card\s+\.atlas-btn:active\s*{\s*transform:\s*none;\s*filter:\s*none;\s*}/,
    );
  });

  it("navigation fires immediately — no JS delay in the card click path", () => {
    const src = read("src/components/game-app.tsx");
    const tap = src.match(/const withCardTap = useCallback\(\s*\([\s\S]*?\),\s*\[\],?\s*\);/);
    assert.ok(tap, "withCardTap missing");
    assert.match(tap![0], /playCardTap\(\);\s*open\(\);/s, "tap sound then immediate open()");
    assert.ok(!/setTimeout|requestAnimationFrame/.test(tap![0]), "no timer in the click path");
    assert.ok(src.includes('onClick={onState}'), "v5 edition rows wire onClick directly (State)");
    assert.ok(src.includes('onClick={onCountry}'), "v5 edition rows wire onClick directly (Country)");
    assert.ok(src.includes('onClick={onGlobe}'), "v5 edition rows wire onClick directly (Globe)");
  });
});

describe("M7 — atlas entrance stagger retune", () => {
  it("atlas-rise: 0.8s + soft-land frozen, delay from --rise-delay", () => {
    assert.match(
      stylesCss(),
      /\.home-rise\s*{[\s\S]*?animation:\s*atlas-rise\s+0\.8s\s+var\(--ease-soft-land\)\s+backwards;\s*animation-delay:\s*var\(--rise-delay,\s*0ms\);/,
    );
    assert.ok(!stylesCss().includes("calc(var(--d, 0) * 110ms)"), "uniform 110ms formula gone");
  });

  it("stamp keeps its +380ms offset on the same uneven base", () => {
    assert.match(
      stylesCss(),
      /\.atlas-stamp\s*{[\s\S]*?animation-delay:\s*calc\(var\(--rise-delay,\s*0ms\)\s*\+\s*380ms\);/,
    );
  });

  it("rise() emits uneven 60–100ms gaps, --d retired", () => {
    const src = read("src/components/game-app.tsx");
    const m = src.match(/const RISE_DELAY:\s*Record<number,\s*string>\s*=\s*{([^}]+)}/);
    assert.ok(m, "RISE_DELAY table missing");
    const delays = [...m![1].matchAll(/(\d+):\s*"(\d+)ms"/g)].map((x) => Number(x[2]));
    assert.deepEqual(delays, [0, 60, 135, 205, 290, 375, 450]);
    const gaps = delays.slice(1).map((d, i) => d - delays[i]);
    assert.ok(gaps.every((g) => g >= 60 && g <= 100), `gaps ${gaps} within 60–100ms`);
    assert.ok(new Set(gaps).size > 1, `gaps ${gaps} must be uneven`);
    assert.match(src, /const rise = \(d: number\) => \({ "--rise-delay": RISE_DELAY\[d\] \?\? "0ms" }\)/);
    assert.ok(!src.includes('"--d"'), "--d fully retired");
  });
});
