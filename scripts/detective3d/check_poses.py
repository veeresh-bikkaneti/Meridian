"""Render every pose from the exported GLBs into a contact sheet.

Applies the game's pose table (check/poses.json, dumped from
pair3d-poses.ts) to the GLB pivots exactly as pair3d.ts does, so the
sheet shows what the game will draw. three.js axes map to Blender as
X -> X, Y -> Z, Z -> -Y.
Run: ../bvenv/bin/python check_poses.py <glb-dir> <out-dir>
"""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix

GLB = Path(sys.argv[1]).resolve()
OUT = Path(sys.argv[2]).resolve()
OUT.mkdir(parents=True, exist_ok=True)
P = json.loads((OUT / "poses.json").read_text())


def three_euler(v):
    x, y, z = (math.radians(a) for a in v)
    return Matrix.Rotation(x, 4, "X") @ Matrix.Rotation(y, 4, "Z") @ Matrix.Rotation(-z, 4, "Y")


def setup():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 12
    sc.view_settings.view_transform = "Standard"
    sc.render.film_transparent = False
    w = bpy.data.worlds.new("w")
    w.color = (0.8, 0.8, 0.8)
    sc.world = w
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.85, 0.85, 0.85, 1)
    w.node_tree.nodes["Background"].inputs[1].default_value = 1.0
    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy = 3
    so = bpy.data.objects.new("sun", sun)
    so.rotation_euler = (math.radians(50), 0, math.radians(20))
    sc.collection.objects.link(so)
    cam = bpy.data.cameras.new("cam")
    cam.type = "ORTHO"
    co = bpy.data.objects.new("cam", cam)
    sc.collection.objects.link(co)
    sc.camera = co
    return co


def load(name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(GLB / f"{name}.glb"))
    new = set(bpy.data.objects) - before
    return {o.name: o for o in new}


def render_sheet(name, tag, poses, frame):
    co = setup()
    nodes = load(name)
    cam = co.data
    cam.ortho_scale = frame["height"]
    sc = bpy.context.scene
    h = 360
    sc.render.resolution_y = h
    sc.render.resolution_x = int(h * frame["aspect"])
    cam.sensor_fit = "VERTICAL"
    co.location = (0, -10, frame["bottom"] + frame["height"] / 2)
    co.rotation_euler = (math.radians(90), 0, 0)
    rest = {k: o.matrix_basis.copy() for k, o in nodes.items()}
    for pose_name, p in poses.items():
        for k, o in nodes.items():
            o.matrix_basis = rest[k]
        joints = {
            f"{tag}-shoulder-l": p["shoulderL"],
            f"{tag}-shoulder-r": p["shoulderR"],
            f"{tag}-elbow-l": [p["elbowL"], 0, 0],
            f"{tag}-elbow-r": [p["elbowR"], 0, 0],
            f"{tag}-head": p["head"],
        }
        for jn, v in joints.items():
            o = nodes.get(jn)
            if o is None:
                print("missing", jn)
                continue
            loc = rest[jn].to_translation()
            o.matrix_basis = Matrix.Translation(loc) @ three_euler(v)
        sc.render.filepath = str(OUT / f"{name}-{pose_name}.png")
        bpy.ops.render.render(write_still=True)


render_sheet("holmes", "H", P["holmes"], P["frame"]["holmes"])
render_sheet("watson", "W", P["watson"], P["frame"]["watson"])
print("done")
