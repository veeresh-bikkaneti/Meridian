# BRANCH_STATUS.md — fix/attribution-popover-credits

The game renders `src/map/satellite-map.tsx` (lazy MapLibre component), NOT
`src/components/atlas-map.tsx` (unused legacy canvas renderer). PR #47 put the
Wikipedia CC BY-SA credit in the dead component — this branch puts the data
credits where players actually see them: the attribution popover.

## Active
- [ ] PR opened → merged → live verified (popover shows GeoNames + Wikipedia credits)

## Done
- [x] Attribution popover (`#meridian-attribution-popover`) gains a data-credits
      paragraph: `Place data: GeoNames [CC-BY 4.0] · place history: Wikipedia [CC BY-SA]`
      with license links. This also restores the GeoNames credit the new map UI
      had dropped (the old bottom-left chip had it; the popover only had Esri).
- [x] `npx tsc --noEmit` clean
- [x] `npm run build:pages` green; "place history" confirmed in the built
      satellite-map chunk (vite cache cleared before build — stale cache from
      the symlinked node_modules caused a false-negative on the first attempt)
- [x] Pushed to origin

## Notes
- PR #47's edit to `src/components/atlas-map.tsx` is harmless (factually
  correct text in a dead component). A future cleanup may delete atlas-map.tsx
  entirely; not this branch's job.
