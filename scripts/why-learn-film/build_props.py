"""Build the props for the "Why Do We Learn This?" card film as small GLBs.

Low-poly, flat toon colours in the same family as the Holmes & Watson
pair (scripts/detective3d/). Units are metres, +Z up in Blender
(+Y up once exported to glTF / three.js). Every prop's origin sits
where the scene grabs it: the lens at its grip, the ladder and lamp
post at their foot, the swing at the top bar, the hose at the nozzle.

Run with Blender's Python module (`pip install bpy`) from this folder:

    python build_props.py ../../public/models/why-learn

Writes one .glb per prop. No text, numbers or symbols on any prop.
"""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "glb").resolve()
OUT.mkdir(parents=True, exist_ok=True)

# Flat toon palette (sRGB hex), tuned to sit next to the pair's red and
# blue plaid and the cream card.
PAL = {
    "brass": "#d9a531",
    "brass-dark": "#9c6b1c",
    "glass": "#cfe8f2",
    "wood": "#8a5a32",
    "wood-light": "#c4884f",
    "ball-red": "#e0533c",
    "ball-cream": "#fbf1d9",
    "iron": "#2f3b45",
    "iron-light": "#4c5d6b",
    "lamp-glow": "#ffe7a3",
    "table-top": "#f4ead6",
    "plate": "#ffffff",
    "crust": "#d99a4a",
    "filling": "#b8415a",
    "swing-frame": "#3b8f6a",
    "swing-seat": "#f2b134",
    "chain": "#8d969c",
    "hose-green": "#3f9b4b",
    "nozzle": "#f0c52f",
    "nozzle-dark": "#5a5f63",
    "concrete": "#cfc6b6",
    "deck": "#7b8a96",
    "cable": "#e6e0d2",
    "bowl": "#f6f1e7",
    "bowl-band": "#4d8ec4",
    "dough": "#f1d39b",
}


def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (1.0,)


_mats = {}


def mat(name, alpha=1.0, emit=0.0):
    key = (name, alpha, emit)
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = srgb(PAL[name])
    b.inputs["Roughness"].default_value = 0.85
    b.inputs["Metallic"].default_value = 0.0
    if emit:
        b.inputs["Emission Color"].default_value = srgb(PAL[name])
        b.inputs["Emission Strength"].default_value = emit
    if alpha < 1:
        b.inputs["Alpha"].default_value = alpha
        m.blend_method = "BLEND" if hasattr(m, "blend_method") else None
    _mats[key] = m
    return m


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _mats.clear()


def finish(o, name, material, smooth=False, parent=None):
    o.name = name
    o.data.name = name
    o.data.materials.clear()
    o.data.materials.append(material)
    for p in o.data.polygons:
        p.use_smooth = smooth
    if parent is not None:
        o.parent = parent
    return o


def cyl(name, material, r, depth, loc=(0, 0, 0), rot=(0, 0, 0), verts=10, smooth=True, parent=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    return finish(bpy.context.object, name, mat(material), smooth, parent)


def box(name, material, size, loc=(0, 0, 0), rot=(0, 0, 0), parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    return finish(o, name, mat(material), False, parent)


def sphere(name, material, r, loc=(0, 0, 0), seg=12, rings=8, parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=r, location=loc)
    return finish(bpy.context.object, name, mat(material), True, parent)


def torus(name, material, R, r, loc=(0, 0, 0), rot=(0, 0, 0), major=24, minor=6, parent=None):
    bpy.ops.mesh.primitive_torus_add(major_segments=major, minor_segments=minor, major_radius=R, minor_radius=r, location=loc, rotation=rot)
    return finish(bpy.context.object, name, mat(material), True, parent)


def empty(name, loc=(0, 0, 0), parent=None):
    o = bpy.data.objects.new(name, None)
    o.location = loc
    bpy.context.scene.collection.objects.link(o)
    if parent is not None:
        o.parent = parent
    return o


def rod(name, material, a, b, r, verts=6, parent=None):
    """Cylinder from point a to point b."""
    a, b = Vector(a), Vector(b)
    d = b - a
    o = cyl(name, material, r, d.length, loc=(a + b) / 2, verts=verts, parent=parent)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d)
    return o


def export(name, root_name):
    root = bpy.data.objects.get(root_name)
    bpy.ops.object.select_all(action="SELECT")
    path = OUT / f"{name}.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_texcoords=False,
        export_normals=True,
        export_materials="EXPORT",
        export_extras=False,
        export_cameras=False,
        export_lights=False,
    )
    print(f"{path.name}: {path.stat().st_size} bytes")
    return root


# ── Magnifying lens ────────────────────────────────────────────────────
# Origin at the grip (where Holmes's hand closes). The handle runs up
# +Z; the glass faces +Y (toward the camera once exported, -Z in three).
def lens():
    reset()
    root = empty("lens")
    cyl("lens-handle", "wood", 0.017, 0.15, loc=(0, 0, 0.0), verts=10, parent=root)
    cyl("lens-ferrule", "brass-dark", 0.021, 0.03, loc=(0, 0, 0.085), verts=10, parent=root)
    c = (0, 0, 0.205)
    torus("lens-rim", "brass", 0.105, 0.013, loc=c, rot=(math.pi / 2, 0, 0), major=28, minor=6, parent=root)
    g = cyl("lens-glass", "glass", 0.1, 0.008, loc=c, rot=(math.pi / 2, 0, 0), verts=28, parent=root)
    g.data.materials[0] = mat("glass", alpha=0.35)
    export("lens", "lens")


# ── Ball ───────────────────────────────────────────────────────────────
def ball():
    reset()
    root = empty("ball")
    sphere("ball-body", "ball-red", 0.11, seg=14, rings=9, parent=root)
    torus("ball-stripe", "ball-cream", 0.108, 0.012, major=20, minor=4, parent=root)
    export("ball", "ball")


# ── Ladder ─────────────────────────────────────────────────────────────
# Upright, 2.6 m, origin centred between the feet. The scene tilts it
# about X to lean on the lamp post.
def ladder():
    reset()
    root = empty("ladder")
    L, w = 2.6, 0.22
    box("ladder-rail-l", "wood-light", (0.045, 0.06, L), loc=(-w, 0, L / 2), parent=root)
    box("ladder-rail-r", "wood-light", (0.045, 0.06, L), loc=(w, 0, L / 2), parent=root)
    for i in range(8):
        z = 0.28 + i * 0.31
        cyl(f"ladder-rung-{i}", "wood", 0.018, 2 * w, loc=(0, 0, z), rot=(0, math.pi / 2, 0), verts=6, parent=root)
    export("ladder", "ladder")


# ── Lamp post ──────────────────────────────────────────────────────────
def lamp_post():
    reset()
    root = empty("lamp-post")
    cyl("lamp-base", "iron", 0.14, 0.3, loc=(0, 0, 0.15), verts=8, smooth=False, parent=root)
    cyl("lamp-pole", "iron", 0.055, 3.4, loc=(0, 0, 1.9), verts=8, parent=root)
    torus("lamp-collar", "iron-light", 0.065, 0.02, loc=(0, 0, 3.55), major=10, minor=4, parent=root)
    cyl("lamp-head-cap", "iron", 0.16, 0.05, loc=(0, 0, 3.98), verts=8, smooth=False, parent=root)
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.12, radius2=0.18, depth=0.32, location=(0, 0, 3.8))
    finish(bpy.context.object, "lamp-glass", mat("lamp-glow", emit=0.6), False, root)
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.2, radius2=0.0, depth=0.14, location=(0, 0, 4.08))
    finish(bpy.context.object, "lamp-roof", mat("iron"), False, root)
    sphere("lamp-finial", "iron-light", 0.035, loc=(0, 0, 4.17), seg=8, rings=5, parent=root)
    export("lamp-post", "lamp-post")


# ── Café table ─────────────────────────────────────────────────────────
def cafe_table():
    reset()
    root = empty("cafe-table")
    cyl("table-top", "table-top", 0.42, 0.04, loc=(0, 0, 0.75), verts=24, parent=root)
    torus("table-edge", "iron", 0.42, 0.012, loc=(0, 0, 0.75), major=24, minor=4, parent=root)
    cyl("table-stem", "iron", 0.03, 0.72, loc=(0, 0, 0.37), verts=8, parent=root)
    cyl("table-foot", "iron", 0.22, 0.03, loc=(0, 0, 0.015), verts=12, parent=root)
    export("cafe-table", "cafe-table")


# ── Pie (8 slice meshes) ───────────────────────────────────────────────
# Origin at the plate's centre, base on z=0. Each slice-N is its own
# mesh so the film can lift or slide one; the gold slice lines are drawn
# by the scene, not baked in.
def wedge(name, i, n, R, h, z0, material, parent):
    a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
    steps = 4
    verts = [(0, 0, z0), (0, 0, z0 + h)]
    for k in range(steps + 1):
        a = a0 + (a1 - a0) * k / steps
        verts += [(R * math.cos(a), R * math.sin(a), z0), (R * math.cos(a), R * math.sin(a), z0 + h)]
    faces = []
    m = steps + 1
    for k in range(steps):
        b, t, b2, t2 = 2 + 2 * k, 3 + 2 * k, 4 + 2 * k, 5 + 2 * k
        faces += [(b, b2, t2, t), (0, b2, b), (1, t, t2)]
    faces += [(0, 2, 3, 1), (0, 1, 2 * m + 1, 2 * m)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.parent = parent
    o.data.materials.append(mat(material))
    return o


def pie():
    reset()
    root = empty("pie")
    cyl("pie-plate", "plate", 0.25, 0.015, loc=(0, 0, 0.0075), verts=24, parent=root)
    for i in range(8):
        s = wedge(f"slice-{i}", i, 8, 0.2, 0.05, 0.015, "filling", root)
        # A crust lip on each slice so a lifted slice still reads as pie.
        a = 2 * math.pi * (i + 0.5) / 8
        lip = cyl(f"slice-{i}-crust", "crust", 0.02, 0.15, loc=(0.19 * math.cos(a), 0.19 * math.sin(a), 0.065),
                  rot=(math.pi / 2, 0, a), verts=6, parent=s)
    export("pie", "pie")


# ── Swing set (7-10 band) ──────────────────────────────────────────────
# Origin on the ground under the top bar's middle. `swing-pivot` is an
# empty on the top bar: rotate it about X to swing the seat.
def swing_set():
    reset()
    root = empty("swing-set")
    H, W, spread = 2.2, 1.0, 0.7
    for sx in (-W, W):
        rod(f"swing-leg-{'l' if sx < 0 else 'r'}-front", "swing-frame", (sx, -spread, 0), (sx, 0, H), 0.04, 8, root)
        rod(f"swing-leg-{'l' if sx < 0 else 'r'}-back", "swing-frame", (sx, spread, 0), (sx, 0, H), 0.04, 8, root)
    cyl("swing-bar", "swing-frame", 0.045, 2 * W + 0.12, loc=(0, 0, H), rot=(0, math.pi / 2, 0), verts=8, parent=root)
    pivot = empty("swing-pivot", loc=(0, 0, H), parent=root)
    for sx in (-0.22, 0.22):
        rod(f"swing-chain-{'l' if sx < 0 else 'r'}", "chain", (sx, 0, 0), (sx, 0, -1.65), 0.01, 4, pivot)
    box("swing-seat", "swing-seat", (0.52, 0.2, 0.04), loc=(0, 0, -1.66), parent=pivot)
    export("swing-set", "swing-set")


# ── Garden hose nozzle (18+ band) ──────────────────────────────────────
# Origin at the nozzle tip; it points along +Y (toward the camera in
# glTF, so the scene turns it to aim).
def hose_nozzle():
    reset()
    root = empty("hose-nozzle")
    cyl("nozzle-tip", "nozzle", 0.022, 0.06, loc=(0, -0.03, 0), rot=(math.pi / 2, 0, 0), verts=10, parent=root)
    cyl("nozzle-barrel", "nozzle-dark", 0.03, 0.14, loc=(0, -0.13, 0), rot=(math.pi / 2, 0, 0), verts=10, parent=root)
    box("nozzle-grip", "nozzle", (0.04, 0.05, 0.13), loc=(0, -0.2, -0.07), rot=(math.radians(-15), 0, 0), parent=root)
    pts = [(0, -0.22, -0.13), (0.05, -0.32, -0.3), (0.2, -0.3, -0.5), (0.35, -0.15, -0.62)]
    for i in range(len(pts) - 1):
        rod(f"hose-{i}", "hose-green", pts[i], pts[i + 1], 0.022, 8, root)
    export("hose-nozzle", "hose-nozzle")


# ── Bridge segment with cables (18+ band) ──────────────────────────────
# Origin at the deck's middle; deck runs along X. The cables are named
# cable-* so the scene can trace them as gold triangles.
def bridge():
    reset()
    root = empty("bridge")
    L, wd, tz = 3.2, 0.7, 1.4
    box("bridge-deck", "deck", (L, wd, 0.12), loc=(0, 0, 0), parent=root)
    box("bridge-rail-front", "iron-light", (L, 0.03, 0.08), loc=(0, -wd / 2, 0.14), parent=root)
    box("bridge-rail-back", "iron-light", (L, 0.03, 0.08), loc=(0, wd / 2, 0.14), parent=root)
    box("bridge-tower", "concrete", (0.16, wd + 0.12, tz + 0.5), loc=(0, 0, (tz + 0.5) / 2 - 0.3), parent=root)
    box("bridge-pier", "concrete", (0.3, wd + 0.2, 0.9), loc=(0, 0, -0.75), parent=root)
    i = 0
    for side in (-1, 1):
        for k in (0.5, 1.0, 1.5):
            x = side * k
            for y in (-wd / 2 + 0.02, wd / 2 - 0.02):
                rod(f"cable-{i}", "cable", (0, y, tz), (x, y, 0.06), 0.012, 4, root)
                i += 1
    export("bridge", "bridge")


# ── Three equal bowls (18+ band) ───────────────────────────────────────
# bowl-0 sits at the origin; bowl-1 and bowl-2 sit either side so the
# scene can hide them and slide them out ("one bowl becomes three").
def bowls():
    reset()
    root = empty("bowls")
    for i, x in enumerate((0.0, -0.3, 0.3)):
        b = empty(f"bowl-{i}", loc=(x, 0, 0), parent=root)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=0.11, location=(x, 0, 0.11))
        o = bpy.context.object
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="DESELECT")
        bpy.ops.object.mode_set(mode="OBJECT")
        for v in o.data.vertices:
            v.select = v.co.z > 0.0
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.delete(type="VERT")
        bpy.ops.object.mode_set(mode="OBJECT")
        s = o.modifiers.new("s", "SOLIDIFY")
        s.thickness = 0.012
        bpy.ops.object.convert(target="MESH")
        finish(o, f"bowl-{i}-body", mat("bowl"), True, None)
        mw = o.matrix_world.copy()
        o.parent = b
        o.matrix_world = mw
        torus(f"bowl-{i}-band", "bowl-band", 0.105, 0.008, loc=(0, 0, 0.07), major=18, minor=4, parent=b)
        cyl(f"bowl-{i}-dough", "dough", 0.095, 0.02, loc=(0, 0, 0.095), verts=16, parent=b)
    export("bowls", "bowls")


for build in (lens, ball, ladder, lamp_post, cafe_table, pie, swing_set, hose_nozzle, bridge, bowls):
    build()
print("done")
