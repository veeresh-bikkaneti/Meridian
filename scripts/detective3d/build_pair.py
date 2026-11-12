"""Holmes & Watson as 3D models, built by script in Blender (bpy).

Art of record (DetectivePair.tsx): Holmes tall/thin, brick-red plaid
coat (#a52a21 base, #bc3a2c bands), rust-orange deerstalker (#b45a1b),
burgundy tie. Watson ~75% of his height and wider, royal-blue plaid
(#27408b base, #33539f bands), navy bowler (#1d2f57), gold tie
(#c9a227), cream vest, ginger moustache, magnifying glass. NO pipe.

Usage: python build_pair.py <out_dir>
Writes holmes.glb, watson.glb and preview PNGs.
"""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
OUT.mkdir(parents=True, exist_ok=True)


def hex_rgba(h, a=1.0):
    h = h.lstrip("#")
    r, g, b = (int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))
    # sRGB -> linear
    lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (lin(r), lin(g), lin(b), a)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


# ------------------------------------------------------------------ materials
_mats = {}


def mat_solid(name, color, rough=0.6, sheen=0.0):
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = hex_rgba(color)
    bsdf.inputs["Roughness"].default_value = rough
    if sheen:
        bsdf.inputs["Sheen Weight"].default_value = sheen
    _mats[name] = m
    return m


def mat_plaid(name, base, band, line, scale=9.0):
    """Tartan-ish plaid: two crossing band sets (object space) plus a
    thin dark over-check, mixed over the base colour. Procedural, so it
    exports to glTF only as a baked texture — see bake_plaid()."""
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nodes, links = nt.nodes, nt.links
    bsdf = nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.75
    bsdf.inputs["Sheen Weight"].default_value = 0.3

    coord = nodes.new("ShaderNodeTexCoord")
    sep = nodes.new("ShaderNodeSeparateXYZ")
    links.new(coord.outputs["Object"], sep.inputs[0])

    def stripes(axis_out, freq, width):
        mul = nodes.new("ShaderNodeMath")
        mul.operation = "MULTIPLY"
        mul.inputs[1].default_value = freq
        links.new(axis_out, mul.inputs[0])
        frac = nodes.new("ShaderNodeMath")
        frac.operation = "FRACT"
        links.new(mul.outputs[0], frac.inputs[0])
        lt = nodes.new("ShaderNodeMath")
        lt.operation = "LESS_THAN"
        lt.inputs[1].default_value = width
        links.new(frac.outputs[0], lt.inputs[0])
        return lt.outputs[0]

    # Wide bands on X and Z (vertical + horizontal), thin over-check.
    bx = stripes(sep.outputs["X"], scale, 0.32)
    bz = stripes(sep.outputs["Z"], scale, 0.32)
    lx = stripes(sep.outputs["X"], scale, 0.06)
    lz = stripes(sep.outputs["Z"], scale, 0.06)

    band_any = nodes.new("ShaderNodeMath")
    band_any.operation = "MAXIMUM"
    links.new(bx, band_any.inputs[0])
    links.new(bz, band_any.inputs[1])
    band_both = nodes.new("ShaderNodeMath")
    band_both.operation = "MULTIPLY"
    links.new(bx, band_both.inputs[0])
    links.new(bz, band_both.inputs[1])
    line_any = nodes.new("ShaderNodeMath")
    line_any.operation = "MAXIMUM"
    links.new(lx, line_any.inputs[0])
    links.new(lz, line_any.inputs[1])

    mix1 = nodes.new("ShaderNodeMix")
    mix1.data_type = "RGBA"
    mix1.inputs["A"].default_value = hex_rgba(base)
    mix1.inputs["B"].default_value = hex_rgba(band)
    links.new(band_any.outputs[0], mix1.inputs["Factor"])
    # Where bands cross the colour deepens a touch.
    mix2 = nodes.new("ShaderNodeMix")
    mix2.data_type = "RGBA"
    links.new(mix1.outputs["Result"], mix2.inputs["A"])
    mix2.inputs["B"].default_value = tuple(c * 0.82 for c in hex_rgba(band)[:3]) + (1,)
    links.new(band_both.outputs[0], mix2.inputs["Factor"])
    mix3 = nodes.new("ShaderNodeMix")
    mix3.data_type = "RGBA"
    links.new(mix2.outputs["Result"], mix3.inputs["A"])
    mix3.inputs["B"].default_value = hex_rgba(line)
    fac = nodes.new("ShaderNodeMath")
    fac.operation = "MULTIPLY"
    fac.inputs[1].default_value = 0.55
    links.new(line_any.outputs[0], fac.inputs[0])
    links.new(fac.outputs[0], mix3.inputs["Factor"])
    links.new(mix3.outputs["Result"], bsdf.inputs["Base Color"])
    _mats[name] = m
    return m


# ------------------------------------------------------------------ geometry
def finish(obj, mat, subsurf=2, smooth=True, parent=None):
    obj.data.materials.append(mat)
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
    if subsurf:
        mod = obj.modifiers.new("subsurf", "SUBSURF")
        mod.levels = subsurf
        mod.render_levels = subsurf
    if parent is not None:
        obj.parent = parent
        if RIG:
            obj.matrix_parent_inverse = parent.matrix_world.inverted()
    return obj


def sphere(name, loc, scale, mat, parent=None, subsurf=1, segs=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=segs // 2, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    return finish(o, mat, subsurf, parent=parent)


def capsule_between(name, a, b, r1, r2, mat, parent=None, subsurf=2, verts=16):
    """A tapered tube from point a to point b with rounded look."""
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cone_add(
        vertices=verts, radius1=r1, radius2=r2, depth=d.length, location=(a + b) / 2
    )
    o = bpy.context.active_object
    o.name = name
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    # A clean tube: bevelled cap edges + smooth shading (subsurf on a
    # cone pinches its ends into points), and a sphere at each end so
    # joints read rounded.
    finish(o, mat, 0, parent=parent)
    bev = o.modifiers.new("bevel", "BEVEL")
    bev.width = min(r1, r2) * 0.6
    bev.segments = 4
    bev.limit_method = "ANGLE"
    o.modifiers.new("wn", "WEIGHTED_NORMAL")
    if subsurf:
        for end, r in ((a, r1), (b, r2)):
            bpy.ops.mesh.primitive_uv_sphere_add(segments=verts, ring_count=verts // 2, radius=r * 0.98, location=end)
            cap = bpy.context.active_object
            cap.name = f"{name}-cap"
            finish(cap, mat, 0, parent=parent)
    return o


def torus(name, loc, major, minor, mat, rot=(0, 0, 0), scale=(1, 1, 1), parent=None):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major, minor_radius=minor, location=loc, rotation=rot,
        major_segments=40, minor_segments=12,
    )
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    return finish(o, mat, 1, parent=parent)


def empty(name):
    bpy.ops.object.empty_add(location=(0, 0, 0))
    e = bpy.context.active_object
    e.name = name
    return e


SKIN = "#f2c9a0"


RIG = False  # export_glb.py sets this: straight arms on shoulder/elbow pivots


def pivot(name, loc, parent):
    """An empty at a world location, parented without moving."""
    e = empty(name)
    e.location = loc
    bpy.context.view_layer.update()
    if parent is not None:
        e.parent = parent
        e.matrix_parent_inverse = parent.matrix_world.inverted()
    return e


def rig_arm(prefix, side, shoulder, elbow, wrist, r1, r2, coat, skin, root, hand_scale):
    """A straight hanging arm: upper on a shoulder pivot, fore + hand on an
    elbow pivot. Returns the elbow pivot so props can hang off the hand."""
    sh = pivot(f"{prefix}-shoulder-{side}", shoulder, root)
    el = pivot(f"{prefix}-elbow-{side}", elbow, sh)
    capsule_between(f"{prefix.lower()}-arm-{side}-up", shoulder, elbow, r1, r1 * 0.95, coat, sh)
    capsule_between(f"{prefix.lower()}-arm-{side}-fore", elbow, wrist, r1 * 0.95, r2, coat, el)
    hand = Vector(wrist) + (Vector(wrist) - Vector(elbow)).normalized() * hand_scale[2]
    sphere(f"{prefix.lower()}-hand-{side}", tuple(hand), hand_scale, skin, el)
    return el, hand


def eyes(prefix, head_c, head_r, spread, root, look=(0, -1, 0)):
    white = mat_solid("eye-white", "#fbf7ef", 0.3)
    dark = mat_solid("eye-dark", "#1b1612", 0.2)
    for sx in (-1, 1):
        c = Vector(head_c) + Vector((sx * spread, -head_r * 0.86, head_r * 0.12))
        sphere(f"{prefix}-eye-{sx}", c, (0.04, 0.022, 0.048), white, root, 1, 16)
        sphere(f"{prefix}-pupil-{sx}", c + Vector((0, -0.018, -0.004)), (0.024, 0.012, 0.03), dark, root, 1, 12)


# ------------------------------------------------------------------ Holmes
def build_holmes(x=0.0):
    root = empty("Holmes")
    root.location = (x, 0, 0)
    coat = mat_plaid("holmes-plaid", "#a52a21", "#bc3a2c", "#4a120e", scale=8)
    trousers = mat_solid("holmes-trousers", "#2b2a2e", 0.7)
    shoe = mat_solid("shoe", "#18140f", 0.35)
    skin = mat_solid("skin", SKIN, 0.55)
    hat = mat_plaid("deerstalker", "#b45a1b", "#c9732e", "#5a2a0a", scale=14)
    tie = mat_solid("holmes-tie", "#6b1626", 0.5)
    hair = mat_solid("holmes-hair", "#2a1d14", 0.6)
    collar = mat_solid("collar", "#f4efe4", 0.5)

    # Legs + shoes (tall and thin).
    for sx in (-1, 1):
        capsule_between(f"h-leg-{sx}", (sx * 0.11, 0, 0.1), (sx * 0.1, 0, 0.82), 0.075, 0.085, trousers, root)
        sphere(f"h-shoe-{sx}", (sx * 0.11, -0.06, 0.06), (0.09, 0.17, 0.07), shoe, root)
    # Coat: long, slightly flared to the knee, narrow shoulders.
    capsule_between("h-coat", (0, 0, 0.5), (0, 0, 1.42), 0.2, 0.15, coat, root, 0, 24)
    # Inverness cape over the shoulders — his silhouette.
    capsule_between("h-cape", (0, 0, 1.08), (0, 0, 1.46), 0.29, 0.13, coat, root, 0, 24)
    sphere("h-shoulders", (0, 0, 1.43), (0.15, 0.13, 0.06), coat, root)
    # Collar + tie.
    sphere("h-collar", (0, -0.12, 1.45), (0.1, 0.06, 0.05), collar, root)
    capsule_between("h-tie", (0, -0.2, 1.42), (0, -0.23, 1.2), 0.035, 0.05, tie, root, 1, 8)
    # Arms: one at the side, one raised to the chin (thinking).
    if RIG:
        for sx, side in ((1, "r"), (-1, "l")):
            rig_arm("H", side, (sx * 0.2, 0, 1.36), (sx * 0.25, -0.01, 1.11), (sx * 0.28, -0.02, 0.9),
                    0.06, 0.055, coat, skin, root, (0.055, 0.05, 0.065))
    else:
        capsule_between("h-arm-r", (0.2, 0, 1.36), (0.27, -0.02, 0.92), 0.06, 0.055, coat, root)
        sphere("h-hand-r", (0.28, -0.02, 0.86), (0.06, 0.05, 0.07), skin, root)
        capsule_between("h-arm-l-up", (-0.2, 0, 1.36), (-0.27, -0.1, 1.08), 0.06, 0.055, coat, root)
        capsule_between("h-arm-l-fore", (-0.28, -0.1, 1.08), (-0.1, -0.2, 1.5), 0.06, 0.055, coat, root)
        sphere("h-hand-l", (-0.08, -0.22, 1.54), (0.055, 0.05, 0.065), skin, root)
    # Neck + head: long face, sharp nose.
    capsule_between("h-neck", (0, 0, 1.45), (0, 0, 1.58), 0.055, 0.05, skin, root, 1, 12)
    head_c, head_r = (0, 0, 1.74), 0.17
    sphere("h-head", head_c, (0.15, 0.16, 0.2), skin, root)
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.035, radius2=0.005, depth=0.12,
                                    location=(0, -0.19, 1.72), rotation=(math.radians(100), 0, 0))
    nose = bpy.context.active_object
    nose.name = "h-nose"
    finish(nose, skin, 1, parent=root)
    eyes("h", head_c, head_r, 0.06, root)
    # Small closed smile: thinking, but friendly.
    capsule_between("h-mouth", (-0.035, -0.148, 1.625), (0.035, -0.148, 1.632), 0.009, 0.009, mat_solid("h-mouth", "#7a2e24", 0.5), root, 1, 8)
    # Brows: thin, a little raised — keen.
    for sx in (-1, 1):
        capsule_between(f"h-brow-{sx}", (sx * 0.035, -0.152, 1.835), (sx * 0.095, -0.128, 1.83), 0.01, 0.008, hair, root, 1, 8)
    # Hair at the back/sides under the hat.
    sphere("h-hair", (0, 0.03, 1.8), (0.16, 0.16, 0.12), hair, root)
    # Deerstalker: crown + front and back peaks + tied ear flaps.
    sphere("h-hat-crown", (0, 0, 1.9), (0.175, 0.185, 0.12), hat, root)
    sphere("h-hat-peak-front", (0, -0.2, 1.86), (0.11, 0.09, 0.018), hat, root)
    sphere("h-hat-peak-back", (0, 0.2, 1.86), (0.11, 0.09, 0.018), hat, root)
    sphere("h-hat-bow", (0, 0, 2.02), (0.04, 0.03, 0.02), mat_solid("bow", "#7a3510", 0.6), root)
    for sx in (-1, 1):
        # Ear flaps tied up against the crown (not sticking out).
        f = sphere(f"h-hat-flap-{sx}", (sx * 0.12, 0, 1.97), (0.015, 0.075, 0.05), hat, root)
        f.rotation_euler = (0, math.radians(sx * -35), 0)
    return root


# ------------------------------------------------------------------ Watson
def build_watson(x=0.0):
    root = empty("Watson")
    root.location = (x, 0, 0)
    s = 0.75  # ~3/4 of Holmes's height, wider
    coat = mat_plaid("watson-plaid", "#27408b", "#33539f", "#111d3d", scale=9)
    trousers = mat_solid("watson-trousers", "#2a2f3d", 0.7)
    shoe = mat_solid("shoe", "#18140f", 0.35)
    skin = mat_solid("skin", SKIN, 0.55)
    vest = mat_solid("watson-vest", "#efe3c4", 0.6)
    tie = mat_solid("watson-tie", "#c9a227", 0.4)
    hat = mat_solid("bowler", "#1d2f57", 0.35)
    tache = mat_solid("moustache", "#c0652a", 0.7)
    brass = mat_solid("brass", "#c9a227", 0.25)
    glass = bpy.data.materials.new("lens")
    glass.use_nodes = True
    gb = glass.node_tree.nodes["Principled BSDF"]
    gb.inputs["Base Color"].default_value = hex_rgba("#cfe8f5")
    gb.inputs["Roughness"].default_value = 0.05
    gb.inputs["Transmission Weight"].default_value = 0.9
    gb.inputs["Alpha"].default_value = 0.5
    notebook = mat_solid("notebook", "#5a3a22", 0.6)

    def z(v):
        return v * s * 1.0

    for sx in (-1, 1):
        capsule_between(f"w-leg-{sx}", (sx * 0.13, 0, 0.09), (sx * 0.13, 0, z(0.8)), 0.09, 0.1, trousers, root)
        sphere(f"w-shoe-{sx}", (sx * 0.13, -0.06, 0.06), (0.1, 0.17, 0.07), shoe, root)
    # Round body: jacket + cream vest front.
    sphere("w-body", (0, 0, z(1.1)), (0.33, 0.27, 0.36), coat, root)
    sphere("w-vest", (0, -0.15, z(1.1)), (0.18, 0.14, 0.27), vest, root)
    capsule_between("w-tie", (0, -0.27, z(1.4)), (0, -0.29, z(1.2)), 0.03, 0.045, tie, root, 1, 8)
    sphere("w-collar", (0, -0.13, z(1.43)), (0.11, 0.07, 0.05), mat_solid("collar", "#f4efe4", 0.5), root)
    # Arms: left holds the notebook, right lifts the magnifier.
    if RIG:
        el_l, hand_l = rig_arm("W", "l", (-0.3, 0, z(1.36)), (-0.36, -0.02, z(1.14)), (-0.39, -0.04, z(0.95)),
                               0.08, 0.075, coat, skin, root, (0.07, 0.06, 0.07))
        el_r, hand_r = rig_arm("W", "r", (0.3, 0, z(1.36)), (0.36, -0.02, z(1.14)), (0.39, -0.04, z(0.95)),
                               0.08, 0.075, coat, skin, root, (0.07, 0.06, 0.07))
        # Notebook flat against the left palm, facing out.
        bpy.ops.mesh.primitive_cube_add(size=1, location=tuple(hand_l + Vector((0.0, -0.07, 0.02))))
        nb = bpy.context.active_object
        nb.name = "w-notebook"
        nb.scale = (0.12, 0.03, 0.16)
        finish(nb, notebook, 1, smooth=False, parent=el_l)
        # Magnifier: handle carries on along the forearm out of the fist.
        d = (hand_r - Vector((0.36, -0.02, z(1.14)))).normalized()
        h0 = hand_r + d * 0.03
        h1 = hand_r + d * 0.2
        capsule_between("w-glass-handle", tuple(h0), tuple(h1), 0.02, 0.02, notebook, el_r, 1, 8)
        ring_c = tuple(hand_r + d * 0.32)
        torus("w-glass-ring", ring_c, 0.11, 0.016, brass, rot=(math.radians(90), 0, 0), parent=el_r)
        bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.1, depth=0.01, location=ring_c,
                                            rotation=(math.radians(90), 0, 0))
        lens = bpy.context.active_object
        lens.name = "w-glass-lens"
        finish(lens, glass, 0, parent=el_r)
    else:
        capsule_between("w-arm-l", (-0.3, 0, z(1.36)), (-0.36, -0.08, z(0.98)), 0.08, 0.075, coat, root)
        sphere("w-hand-l", (-0.36, -0.12, z(0.93)), (0.07, 0.06, 0.07), skin, root)
        bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.33, -0.2, z(0.98)))
        nb = bpy.context.active_object
        nb.name = "w-notebook"
        nb.scale = (0.12, 0.03, 0.16)
        nb.rotation_euler = (0, math.radians(-12), 0)
        finish(nb, notebook, 1, smooth=False, parent=root)
        capsule_between("w-arm-r-up", (0.3, 0, z(1.36)), (0.4, -0.08, z(1.1)), 0.08, 0.075, coat, root)
        capsule_between("w-arm-r-fore", (0.4, -0.08, z(1.1)), (0.36, -0.24, z(1.38)), 0.075, 0.07, coat, root)
        sphere("w-hand-r", (0.35, -0.27, z(1.42)), (0.07, 0.06, 0.07), skin, root)
        # Magnifying glass: handle from the hand, brass ring, lens.
        capsule_between("w-glass-handle", (0.35, -0.28, z(1.42)), (0.33, -0.33, z(1.62)), 0.02, 0.02, notebook, root, 1, 8)
        ring_c = (0.32, -0.36, z(1.76))
        torus("w-glass-ring", ring_c, 0.11, 0.016, brass, rot=(math.radians(90), 0, 0), parent=root)
        bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.1, depth=0.01, location=ring_c,
                                            rotation=(math.radians(90), 0, 0))
        lens = bpy.context.active_object
        lens.name = "w-glass-lens"
        finish(lens, glass, 0, parent=root)
    # Head: round, friendly; moustache with a visible mouth beneath.
    head_c, head_r = (0, 0, z(1.62)), 0.19
    capsule_between("w-neck", (0, 0, z(1.42)), (0, 0, z(1.5)), 0.07, 0.065, skin, root, 1, 12)
    sphere("w-head", head_c, (0.19, 0.18, 0.19), skin, root)
    sphere("w-nose", (0, -0.19, z(1.6)), (0.04, 0.04, 0.04), skin, root)
    eyes("w", head_c, head_r, 0.07, root)
    for sx in (-1, 1):
        sphere(f"w-tache-{sx}", (sx * 0.05, -0.18, z(1.555)), (0.06, 0.03, 0.022), tache, root)
    sphere("w-mouth", (0, -0.175, z(1.51)), (0.035, 0.01, 0.012), mat_solid("mouth", "#7a2e24", 0.5), root)
    # Bowler: dome + rolled brim.
    sphere("w-hat-dome", (0, 0, z(1.78)), (0.17, 0.17, 0.13), hat, root)
    torus("w-hat-brim", (0, 0, z(1.73)), 0.2, 0.025, hat, scale=(1, 1.05, 0.6), parent=root)
    torus("w-hat-band", (0, 0, z(1.75)), 0.165, 0.018, mat_solid("hat-band", "#101a33", 0.4), parent=root)
    return root


# ------------------------------------------------------------------ scene + render
def setup_scene():
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = int(__import__("os").environ.get("HW_SAMPLES", "48"))
    try:
        sc.cycles.use_denoising = True
    except Exception:
        pass
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.exposure = -0.35
    world = bpy.data.worlds.new("w")
    sc.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = hex_rgba("#fbf3e2")
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.45
    # Key, fill, rim.
    def light(name, loc, energy, size=2.0):
        bpy.ops.object.light_add(type="AREA", location=loc)
        l = bpy.context.active_object
        l.name = name
        l.data.energy = energy
        l.data.size = size
        l.rotation_euler = (Vector((0, 0, 1.2)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        return l
    light("key", (-2.5, -3.5, 3.5), 380)
    light("fill", (3, -3, 2), 140)
    light("rim", (0, 3, 3), 260)
    # Floor shadow catcher-ish plane.
    bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, 0))
    floor = bpy.context.active_object
    floor.data.materials.append(mat_solid("floor", "#f1e4c8", 0.9))
    return floor


def camera_at(loc, target, lens=50):
    cam = bpy.data.objects.get("cam")
    if cam is None:
        bpy.ops.object.camera_add()
        cam = bpy.context.active_object
        cam.name = "cam"
    cam.location = loc
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = lens
    bpy.context.scene.camera = cam
    return cam


def render(path, w=1200, h=900):
    sc = bpy.context.scene
    sc.render.resolution_x = w
    sc.render.resolution_y = h
    sc.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def main():
    reset()
    floor = setup_scene()
    holmes = build_holmes(x=-0.45)
    watson = build_watson(x=0.5)
    # Face the camera a touch toward each other.
    holmes.rotation_euler = (0, 0, math.radians(12))
    watson.rotation_euler = (0, 0, math.radians(-14))
    tgt = (0.02, 0, 1.0)
    camera_at((0.4, -5.2, 1.5), tgt, 50)
    render(OUT / "pair-front.png")
    camera_at((3.4, -4.0, 1.7), tgt, 50)
    render(OUT / "pair-three-quarter.png")
    camera_at((-0.3, -2.4, 1.75), (-0.2, 0, 1.45), 60)
    render(OUT / "pair-faces.png")
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "holmes-watson.blend"))


if __name__ == "__main__":
    main()
