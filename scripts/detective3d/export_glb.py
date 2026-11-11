"""Export Holmes and Watson as posable GLBs for the game.

Each character is built with straight arms on shoulder/elbow pivots,
head and hip pivots are added, modifiers are applied, the procedural
plaid is baked into one texture per character, meshes are joined per
pivot, and the result is written as <out>/holmes.glb and watson.glb.

Run: ../bvenv/bin/python export_glb.py <out-dir>
"""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

import build_pair as bp

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "glb").resolve()
OUT.mkdir(parents=True, exist_ok=True)
bp.RIG = True

PLAID = {"holmes-plaid", "deerstalker", "watson-plaid"}


def reparent(prefixes, pivot, root):
    for o in list(root.children_recursive):
        if o.type == "MESH" and o.parent == root and o.name.startswith(prefixes):
            mw = o.matrix_world.copy()
            o.parent = pivot
            o.matrix_world = mw


def apply_modifiers(objs):
    for o in objs:
        bpy.ops.object.select_all(action="DESELECT")
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.convert(target="MESH")
        tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
        if tris > 240:
            d = o.modifiers.new("dec", "DECIMATE")
            d.ratio = max(0.12, 240 / tris)
            bpy.ops.object.convert(target="MESH")
        for p in o.data.polygons:
            p.use_smooth = True


def bake_plaid(meshes, tag, size=1024):
    plaid = [o for o in meshes if o.data.materials and o.data.materials[0].name.split(".")[0] in PLAID]
    if not plaid:
        return
    bpy.ops.object.select_all(action="DESELECT")
    for o in plaid:
        o.select_set(True)
    bpy.context.view_layer.objects.active = plaid[0]
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.01, scale_to_bounds=True)
    bpy.ops.object.mode_set(mode="OBJECT")
    img = bpy.data.images.new(f"{tag}-plaid", size, size)
    mats = {o.data.materials[0] for o in plaid}
    for m in mats:
        n = m.node_tree.nodes.new("ShaderNodeTexImage")
        n.image = img
        m.node_tree.nodes.active = n
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 4
    sc.render.bake.use_pass_direct = False
    sc.render.bake.use_pass_indirect = False
    sc.render.bake.use_pass_color = True
    sc.render.bake.margin = 6
    bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"})
    # Swap each plaid material for a plain textured one.
    for m in mats:
        nt = m.node_tree
        for n in list(nt.nodes):
            nt.nodes.remove(n)
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = img
        bsdf.inputs["Roughness"].default_value = 0.7
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])


def simplify_lens():
    m = bpy.data.materials.get("lens")
    if not m:
        return
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Transmission Weight"].default_value = 0.0
    b.inputs["Alpha"].default_value = 0.4
    try:
        m.surface_render_method = "BLENDED"
    except AttributeError:
        m.blend_method = "BLEND"


def join_per_parent(root, keep):
    groups = {}
    for o in root.children_recursive:
        if o.type == "MESH" and o.name not in keep:
            groups.setdefault(o.parent.name, []).append(o)
    for parent_name, objs in groups.items():
        bpy.ops.object.select_all(action="DESELECT")
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        if len(objs) > 1:
            bpy.ops.object.join()
        joined = bpy.context.view_layer.objects.active
        joined.name = f"{parent_name}-mesh"
        joined.data.name = joined.name


def export(root, path):
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for o in root.children_recursive:
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_image_format="WEBP",
        export_yup=True,
        export_apply=False,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
    )


def tri_count(root):
    n = 0
    for o in root.children_recursive:
        if o.type == "MESH":
            n += sum(len(p.vertices) - 2 for p in o.data.polygons)
    return n


def make(name):
    bp.reset()
    bp._mats.clear() if hasattr(bp, "_mats") else None
    if name == "holmes":
        root = bp.build_holmes(0.0)
        tag, mouth = "H", "h-mouth"
        head = bp.pivot("H-head", (0, 0, 1.58), root)
        reparent(("h-head", "h-nose", "h-eye", "h-pupil", "h-brow", "h-hair", "h-hat", "h-mouth"), head, root)
        for sx, side in ((-1, "l"), (1, "r")):
            hip = bp.pivot(f"H-hip-{side}", (sx * 0.1, 0, 0.82), root)
            reparent((f"h-leg-{sx}", f"h-shoe-{sx}"), hip, root)
    else:
        root = bp.build_watson(0.0)
        tag, mouth = "W", "w-mouth"
        s = 0.75
        head = bp.pivot("W-head", (0, 0, 1.5 * s), root)
        reparent(("w-head", "w-nose", "w-eye", "w-pupil", "w-tache", "w-hat", "w-mouth"), head, root)
        for sx, side in ((-1, "l"), (1, "r")):
            hip = bp.pivot(f"W-hip-{side}", (sx * 0.13, 0, 0.8 * s), root)
            reparent((f"w-leg-{sx}", f"w-shoe-{sx}"), hip, root)
    root.name = tag
    meshes = [o for o in root.children_recursive if o.type == "MESH"]
    apply_modifiers(meshes)
    meshes = [o for o in root.children_recursive if o.type == "MESH"]
    bake_plaid(meshes, tag)
    simplify_lens()
    m = bpy.data.objects.get(mouth)
    if m:
        m.name = f"{tag}-mouth"
        # Identity rotation/scale on the node so the game can open the
        # mouth by scaling its Y (up) axis.
        bpy.ops.object.select_all(action="DESELECT")
        m.select_set(True)
        bpy.context.view_layer.objects.active = m
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    join_per_parent(root, {f"{tag}-mouth"})
    print(f"{name}: {tri_count(root)} triangles")
    export(root, OUT / f"{name}.glb")


for who in ("holmes", "watson"):
    make(who)
print("done")
