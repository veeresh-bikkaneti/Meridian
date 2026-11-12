# 3D Holmes & Watson

The 3D pair in `public/models/detective/` is modelled by script in Blender, so the look can be changed and rebuilt rather than hand-sculpted.

- `build_pair.py` builds both characters and renders the preview images (front, three-quarter, faces).
- `export_glb.py` rebuilds them with posable joints (head, shoulders, elbows, hips, mouth), bakes the plaid into one texture per character, and writes `holmes.glb` and `watson.glb`.
- `check_poses.py` renders every game pose from the exported GLBs using the game's own pose table, so a change can be checked before it ships.

Run with Blender's Python module (`pip install bpy`) from this folder:

```
python build_pair.py out            # previews
python export_glb.py glb            # GLBs; copy glb/*.glb to public/models/detective/
node --experimental-strip-types -e 'import("../../src/game/loop/detective/pair3d-poses.ts").then(m=>console.log(JSON.stringify({holmes:m.HOLMES_POSES_3D,watson:m.WATSON_POSES_3D,frame:m.FRAME_3D})))' > check/poses.json
python check_poses.py glb check     # one PNG per pose
```

The game draws the GLBs over the SVG rigs (`src/game/loop/detective/pair3d.ts`) behind the `pair3d` flag. The SVG rigs stay as the fallback. Holmes never has a pipe.
