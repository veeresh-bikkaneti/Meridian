# Performance baseline (lab)

Lab measurements only — the project has little traffic, so there is no field
data. Numbers rank changes; they do not predict a specific phone. No pass/fail
budgets exist yet (deliberately).

- Baseline commit: `d7a0fc8` (main), built with `npm run build:pages`
- Machine: 4 vCPU, 16 GB RAM, Node v22.22.0, Chromium 141.0.7390.37
  (`/opt/pw-browsers/chromium`; Playwright 1.63.0 driving it via `executablePath`)

## How to reproduce

```sh
npm ci
npm run build:pages
node scripts/bundle-report.mjs            # sizes of every JS/CSS/JSON asset, totals, top 10, shell page analysis
node scripts/bundle-report.mjs --json     # same, machine-readable
node scripts/perf-globe-easy.mjs --runs 5 # throttled cold load, Easy path on Globe, median of 5
```

(`npm run perf:bundle` and `npm run perf:globe-easy` are aliases.)

### What `perf-globe-easy.mjs` does

Per run: new browser context (cold HTTP cache, empty storage, service workers
blocked), CDP `Emulation.setCPUThrottlingRate` rate 4 and
`Network.emulateNetworkConditions` "Slow 4G" (150 ms latency, 1.6 Mbit/s down,
750 kbit/s up), viewport 390x844. The built `dist/client` is served by a real
loopback HTTP server with gzip (`Content-Encoding`) so the throttle actually
applies — the e2e helper `serveBuiltArtifact` fulfils responses inside
Playwright and bypasses the network stack, so it cannot be used for this.
It taps **Easy**, taps **Play the globe**, and waits for the first question.

- *question text* — aim-phase live region reads "Find X." and the run phase is `aim`.
- *first interactive question* — the above AND the MapLibre canvas is visible
  (the child answers by tapping the map). Headline number.
- *JS bytes transferred* — CDP `encodedDataLength` (bytes on the wire) summed over script requests.
- *peak JS heap* — `Runtime.getHeapUsage` sampled every 50 ms: a lower bound of the true peak.

## Baseline results (main @ d7a0fc8)

Command: `node scripts/perf-globe-easy.mjs --runs 5`

| metric (median of 5) | value |
| --- | --- |
| Home ready ("Play the globe" usable) | 5,103 ms |
| Tap Play → interactive question | 17,755 ms |
| Question text on screen | 21,251 ms |
| **First interactive question** (text + map canvas) | **23,134 ms** |
| JS bytes transferred | 2,730,330 B |
| All bytes transferred (JS + CSS + fonts + JSON + …) | 3,733,320 B |
| Peak JS heap (sampled) | 70.99 MiB |

Per-run first-interactive: 23,479 / 22,318 / 22,934 / 23,134 / 23,390 ms
(range 1.2 s). JS requests in a run, wire bytes: `globe-*.js` 1,852,304;
`routes-*.js` 655,172; `index-*.js` 138,426; `states-10m` 36,721;
`land-110m` 20,928; `satellite-map` 16,333; two storyteller chunks ~8.7 kB;
`bands`, runtime ~1.7 kB. The Globe data chunk is **68% of JS bytes** and the
tap-to-question phase (17.8 s of 23.1 s) is dominated by it.

## Bundle report (main @ d7a0fc8)

Command: `node scripts/bundle-report.mjs` (gzip = zlib level 9). 486 JS/CSS/JSON
files, 46,360,034 B raw / 8,722,552 B gzip in total.

| # | file | raw | gzip |
| --- | --- | ---: | ---: |
| 1 | `assets/globe-mraYk97O.js` | 13,696,487 | 1,825,478 |
| 2 | `loop/names.json` | 11,487,772 | 3,103,259 |
| 3 | `assets/routes-wLJvbAlR.js` | 2,248,252 | 650,001 |
| 4 | `assets/india-BdqiTTdY.js` | 1,569,472 | 203,962 |
| 5 | `assets/france-BUpv3zkP.js` | 1,517,024 | 181,751 |
| 6 | `assets/germany-D77GWRwx.js` | 1,492,818 | 184,156 |
| 7 | `assets/mexico-BoqXBUVR.js` | 1,338,565 | 169,601 |
| 8 | `assets/brazil-DH1nUkhY.js` | 1,338,165 | 161,895 |
| 9 | `assets/italy-CeZ5uhL-.js` | 1,190,198 | 154,218 |
| 10 | `assets/australia-BRyCMlLA.js` | 869,103 | 111,160 |

### First-load critical path (from `_shell.html`, parsed as text)

The shell references 2 stylesheets, 4 modulepreloads and 1 module script:

| entry | raw | gzip |
| --- | ---: | ---: |
| `index-D7ECd7OS.js` | 443,489 | 137,953 |
| `routes-wLJvbAlR.js` | 2,248,252 | 650,001 |
| `bands-D6Z7ki57.js` | 1,761 | 790 |
| `rolldown-runtime-hePW80VL.js` | 716 | 428 |
| **entry JS total** | **2,694,218** | **789,172** |
| `styles-*.css` + `routes-*.css` | 183,704 | 30,401 |

The static-import closure of those entries adds nothing (the preloads already
are the closure), and the browser run corroborates it: exactly
`index`, `routes`, `bands`, `rolldown-runtime` before the user acts.

### Findings from the brief that were checked

| claim | measured |
| --- | --- |
| globe chunk = 59,423 places | confirmed: `chunks/globe.json` has 59,423 places |
| ~13.4 MB raw / 1.8 MB gzip | 13,696,487 B raw (13.70 MB, 13.06 MiB) / 1,825,478 B gzip — gzip matches, raw is ~2% larger than the brief |
| country chunks 0.7–1.5 MB raw | 0.61 MB (canada) to 1.57 MB (india) among the largest; smaller ones below that |
| `names.json` 11 MB, 119k entries | 11,487,772 B raw, 3,103,259 B gzip, 119,038 entries |
| main route chunk ~2.2 MB / 633 kB gz | 2,248,252 B raw / 650,001 B gzip level 9 (= 634.8 KiB; the brief's 633 kB is not reproduced exactly) |
| `maplibre-gl-shared.mjs` 516 kB | 515,924 B raw / 147,737 B gzip; **not requested at all** during the Easy-Globe flow in this run |

## After Task 2 — Globe data split by fame tier

Command (same build, same machine, idle): `npm run build:pages && node scripts/perf-globe-easy.mjs --runs 5`

| metric (median of 5) | before (main) | after | change |
| --- | ---: | ---: | ---: |
| Home ready | 5,103 ms | 5,080 ms | ~0 |
| Tap Play → interactive question | 17,755 ms | 8,755 ms | −9,000 ms |
| Question text on screen | 21,251 ms | 12,553 ms | −8,698 ms |
| **First interactive question** | **23,134 ms** | **14,075 ms** | **−9,059 ms (−39%)** |
| JS bytes transferred | 2,730,330 | 1,334,440 | −1,395,890 (−51%) |
| All bytes transferred | 3,733,320 | 2,337,432 | −1,395,888 (−37%) |
| Peak JS heap (sampled) | 70.99 MiB | 60.34 MiB | −10.65 MiB (−15%) |

Globe data on the wire for Easy: 1,852,304 B (`globe-*.js`) → 455,940 B
(`globe-t1` 141,154 + `globe-t2` 314,786), −75%. What did **not** shrink: the
655 kB `routes-*.js` + 138 kB `index-*.js` entry bundles, still ~59% of the
remaining JS bytes, and the 5.1 s to a usable home screen. The remaining
Easy-path load is now mostly the app itself, not the data.

Build output (`node scripts/bundle-report.mjs`): total JS/CSS/JSON 46,360,034 →
46,363,030 raw bytes (the tier files replace `globe-*.js` 1:1; gzip total
8,722,552 → 8,827,854 because five smaller files compress slightly worse).
Medium and Hard still download t2–t4 / t4–t5 (44,213 / 30,629 places); only
Easy is dramatically smaller (11,388 of 59,423 places, 19%).

## Not measured (yet)

- Real devices; this is a CPU multiplier on a desktop-class VM.
- Imagery tile traffic (host unreachable from the VM; stubbed, as in the e2e helpers).
- Warm/return visits (service worker blocked) and Cloudflare/GitHub Pages
  compression levels (the script uses gzip level 6; the report uses level 9).
- Parse/compile time of the Globe chunk in isolation, and heap transients
  shorter than the 50 ms sample period.
