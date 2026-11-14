/**
 * clue-scene-easing.ts — the one helper the clue scenes take from
 * the line-art-animation library (github.com/JDhruv14/line-art-
 * animation, commit c43d6989, MIT — licence below): `seeded`, a
 * seeded random so a scene's scattered layout is the same on every
 * load. The library's other parts were evaluated and not copied:
 * its drawing builders (lib/ink.ts) create DOM nodes imperatively,
 * which fights this app's declarative React SVG tree, and its gait
 * system (lib/gait.ts) animates walking figures the pilot does not
 * have. The scenes draw with React + CSS keyframes instead, and
 * take only this.
 *
 * MIT License
 *
 * Copyright (c) 2026 JDhruv14
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use, copy,
 * modify, merge, publish, distribute, sublicense, and/or sell copies
 * of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 */

/** Seeded random for static drawing, so a scene looks the same on every load. */
export function seeded(seed = 11): (a?: number, b?: number) => number {
  let s = seed;
  return (a = 0, b = 1) => {
    s = (s * 16807) % 2147483647;
    return a + ((s - 1) / 2147483646) * (b - a);
  };
}
