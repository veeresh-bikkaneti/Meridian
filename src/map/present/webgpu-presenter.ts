import { rgbUnit } from "../colors.ts";
import { paintGlobeBuffers } from "../globe-mesh.ts";
import type { MapFrame, MapPresenter } from "./types.ts";

const PAN_WGSL = /* wgsl */ `
struct Pan {
  k: f32,
  ox: f32,
  oy: f32,
  width: f32,
  height: f32,
  crisp: f32,
  pad0: f32,
  pad1: f32,
}
@group(0) @binding(0) var<uniform> u: Pan;
@group(0) @binding(1) var baseTex: texture_2d<f32>;
@group(0) @binding(2) var linearSamp: sampler;
@group(0) @binding(3) var nearestSamp: sampler;

struct VsOut {
  @builtin(position) pos: vec4f,
}

@vertex fn vs(@builtin(vertex_index) i: u32) -> VsOut {
  var tri = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var out: VsOut;
  out.pos = vec4f(tri[i], 0.0, 1.0);
  return out;
}

@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let screen = pos.xy;
  let half = vec2f(u.width, u.height) * 0.5;
  let bake = (screen - half - vec2f(u.ox, u.oy)) / max(u.k, 0.0001) + half;
  let uv = bake / vec2f(u.width, u.height);
  let clamped = clamp(uv, vec2f(0.0), vec2f(1.0));
  let linear = textureSample(baseTex, linearSamp, clamped);
  let nearest = textureSample(baseTex, nearestSamp, clamped);
  let sampled = select(linear, nearest, u.crisp > 0.5);
  let inside = uv.x >= 0.0 && uv.y >= 0.0 && uv.x <= 1.0 && uv.y <= 1.0;
  return select(vec4f(0.03, 0.035, 0.032, 1.0), sampled, inside);
}
`;

const OVERLAY_WGSL = /* wgsl */ `
struct Pan {
  k: f32,
  ox: f32,
  oy: f32,
  width: f32,
  height: f32,
  crisp: f32,
  pad0: f32,
  pad1: f32,
}
@group(0) @binding(0) var<uniform> u: Pan;
@group(0) @binding(1) var overlayTex: texture_2d<f32>;
@group(0) @binding(2) var nearestSamp: sampler;

struct VsOut { @builtin(position) pos: vec4f }

@vertex fn vs(@builtin(vertex_index) i: u32) -> VsOut {
  var tri = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var out: VsOut;
  out.pos = vec4f(tri[i], 0.0, 1.0);
  return out;
}

@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let uv = pos.xy / vec2f(u.width, u.height);
  let c = textureSample(overlayTex, nearestSamp, uv);
  if (c.a < 0.02) { discard; }
  return c;
}
`;

const GLOBE_WGSL = /* wgsl */ `
struct Globe {
  centerLon: f32,
  centerLat: f32,
  scale: f32,
  width: f32,
  height: f32,
  litId: f32,
  litAmt: f32,
  pad0: f32,
  litColor: vec4f,
  ocean: vec4f,
}

@group(0) @binding(0) var<uniform> u: Globe;

fn rotate(lonDeg: f32, latDeg: f32) -> vec3f {
  let lambda = radians(lonDeg) - u.centerLon;
  let phi = radians(latDeg);
  let cosPhi = cos(phi);
  let x = cos(lambda) * cosPhi;
  let y = sin(lambda) * cosPhi;
  let z = sin(phi);
  let dPhi = -u.centerLat;
  let s = sin(dPhi);
  let c = cos(dPhi);
  let k = z * c + x * s;
  let x2 = x * c - z * s;
  return vec3f(y, k, x2);
}

fn project(p: vec3f) -> vec4f {
  let cssX = p.x * u.scale + u.width * 0.5;
  let cssY = u.height * 0.5 - p.y * u.scale;
  let cx = (cssX / u.width) * 2.0 - 1.0;
  let cy = 1.0 - (cssY / u.height) * 2.0;
  return vec4f(cx, cy, 0.0, 1.0);
}

struct TriIn {
  @location(0) lonlat: vec2f,
  @location(1) color: vec3f,
  @location(2) id: f32,
}
struct TriOut {
  @builtin(position) pos: vec4f,
  @location(0) color: vec3f,
  @location(1) oxy: vec2f,
  @location(2) viewZ: f32,
  @location(3) behind: f32,
  @location(4) id: f32,
}

@vertex fn triVs(in: TriIn) -> TriOut {
  let p = rotate(in.lonlat.x, in.lonlat.y);
  var out: TriOut;
  out.behind = select(0.0, 1.0, p.z < 0.0);
  var xy = p.xy;
  var vz = p.z;
  if (p.z < 0.0) {
    let len = length(xy);
    xy = select(vec2f(1.0, 0.0), xy / max(len, 0.0001), len > 0.0001);
    vz = 0.0;
  }
  out.pos = project(vec3f(xy, vz));
  out.color = in.color;
  out.oxy = xy;
  out.viewZ = vz;
  out.id = in.id;
  return out;
}

@fragment fn triFs(in: TriOut) -> @location(0) vec4f {
  if (in.behind > 0.98) { discard; }
  let light = normalize(vec3f(-0.35, 0.42, 0.84));
  let n = normalize(vec3f(in.oxy, max(in.viewZ, 0.02)));
  let shade = 0.56 + 0.44 * clamp(dot(n, light), 0.0, 1.0);
  var rgb = in.color * shade;
  if (u.litAmt > 0.01 && in.id > 0.5 && abs(in.id - u.litId) < 0.5) {
    rgb = mix(rgb, u.litColor.rgb, u.litAmt);
  }
  return vec4f(rgb, 1.0);
}

struct LineIn {
  @location(0) a: vec2f,
  @location(1) b: vec2f,
  @location(2) color: vec4f,
}
struct LineOut {
  @builtin(position) pos: vec4f,
  @location(0) color: vec4f,
}

@vertex fn lineVs(in: LineIn) -> LineOut {
  var pa = rotate(in.a.x, in.a.y);
  var pb = rotate(in.b.x, in.b.y);
  var out: LineOut;
  out.color = in.color;
  if (pa.z <= 0.0 && pb.z <= 0.0) {
    out.pos = vec4f(3.0, 3.0, 0.0, 1.0);
    return out;
  }
  if (pa.z < 0.0) {
    let t = pa.z / (pa.z - pb.z);
    pa = normalize(mix(pa, pb, clamp(t, 0.0, 1.0)));
  }
  out.pos = project(pa);
  return out;
}

@fragment fn lineFs(in: LineOut) -> @location(0) vec4f {
  return in.color;
}

@vertex fn vs(@builtin(vertex_index) i: u32) -> TriOut {
  var tri = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var out: TriOut;
  out.pos = vec4f(tri[i], 0.0, 1.0);
  out.color = vec3f(0.0);
  out.oxy = vec2f(0.0);
  out.viewZ = 1.0;
  out.behind = 0.0;
  out.id = 0.0;
  return out;
}

@fragment fn oceanFs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let half = vec2f(u.width, u.height) * 0.5;
  let nx = (pos.x - half.x) / u.scale;
  let ny = (half.y - pos.y) / u.scale;
  let r2 = nx * nx + ny * ny;
  if (r2 > 1.09) { discard; }
  if (r2 > 1.0) {
    let halo = 1.0 - smoothstep(1.0, 1.09, r2);
    return vec4f(u.ocean.rgb * 1.35, halo * 0.55);
  }
  let z = sqrt(max(0.0, 1.0 - r2));
  let n = normalize(vec3f(nx, ny, z));
  let light = normalize(vec3f(-0.35, 0.42, 0.84));
  let ndl = clamp(dot(n, light), 0.0, 1.0);
  let spec = pow(clamp(dot(reflect(-light, n), vec3f(0.0, 0.0, 1.0)), 0.0, 1.0), 40.0);
  let deep = u.ocean.rgb * vec3f(0.45, 0.55, 0.62);
  let shallow = u.ocean.rgb * vec3f(1.15, 1.2, 1.15);
  let rgb = mix(deep, shallow, ndl) + vec3f(spec * 0.18);
  let limb = smoothstep(0.2, 1.0, r2);
  return vec4f(mix(rgb, rgb * 0.55, limb * 0.65), 1.0);
}
`;

function align(canvas: HTMLCanvasElement, cssWidth: number, cssHeight: number, ratio: number) {
  const pixelW = Math.max(1, Math.round(cssWidth * ratio));
  const pixelH = Math.max(1, Math.round(cssHeight * ratio));
  if (canvas.width !== pixelW || canvas.height !== pixelH) {
    canvas.width = pixelW;
    canvas.height = pixelH;
  }
  return { pixelW, pixelH };
}

export class WebGpuPresenter implements MapPresenter {
  readonly mode = "webgpu" as const;
  private readonly basemap: HTMLCanvasElement;
  private readonly basemapCtx: CanvasRenderingContext2D;
  private readonly overlay: HTMLCanvasElement;
  private readonly overlayCtx: CanvasRenderingContext2D;
  private readonly context: GPUCanvasContext;
  private readonly format: GPUTextureFormat;
  private readonly panBuffer: GPUBuffer;
  private readonly globeBuffer: GPUBuffer;
  private readonly panPipeline: GPURenderPipeline;
  private readonly overlayPipeline: GPURenderPipeline;
  private readonly oceanPipeline: GPURenderPipeline;
  private readonly triPipeline: GPURenderPipeline;
  private readonly linePipeline: GPURenderPipeline;
  private readonly linearSamp: GPUSampler;
  private readonly nearestSamp: GPUSampler;
  private baseTex: GPUTexture | null = null;
  private overlayTex: GPUTexture | null = null;
  private panBind: GPUBindGroup | null = null;
  private overlayBind: GPUBindGroup | null = null;
  private globeBind: GPUBindGroup | null = null;
  private triBuf: GPUBuffer | null = null;
  private lineBuf: GPUBuffer | null = null;
  private triVerts = 0;
  private coastVerts = 0;
  private borderVerts = 0;
  private riverVerts = 0;
  private graticuleVerts = 0;
  private colorKey = "";
  private bakeKey = "";
  private pixelW = 0;
  private pixelH = 0;

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly device: GPUDevice,
    context: GPUCanvasContext,
  ) {
    this.context = context;
    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({ device, format: this.format, alphaMode: "opaque" });
    this.basemap = document.createElement("canvas");
    this.overlay = document.createElement("canvas");
    const base = this.basemap.getContext("2d", { alpha: false });
    const over = this.overlay.getContext("2d", { alpha: true });
    if (!base || !over) throw new Error("presenter canvases unavailable");
    this.basemapCtx = base;
    this.overlayCtx = over;
    this.panBuffer = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.globeBuffer = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.linearSamp = device.createSampler({ magFilter: "linear", minFilter: "linear" });
    this.nearestSamp = device.createSampler({ magFilter: "nearest", minFilter: "nearest" });
    const blend: GPUBlendState = {
      color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
      alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
    };
    this.panPipeline = this.pipeline(PAN_WGSL, "vs", "fs", null, null);
    this.overlayPipeline = this.pipeline(OVERLAY_WGSL, "vs", "fs", null, blend);
    this.oceanPipeline = this.pipeline(GLOBE_WGSL, "vs", "oceanFs", null, blend);
    this.triPipeline = this.pipeline(GLOBE_WGSL, "triVs", "triFs", {
      arrayStride: 24,
      attributes: [
        { shaderLocation: 0, offset: 0, format: "float32x2" },
        { shaderLocation: 1, offset: 8, format: "float32x3" },
        { shaderLocation: 2, offset: 20, format: "float32" },
      ],
    }, null);
    this.linePipeline = this.pipeline(GLOBE_WGSL, "lineVs", "lineFs", {
      arrayStride: 32,
      attributes: [
        { shaderLocation: 0, offset: 0, format: "float32x2" },
        { shaderLocation: 1, offset: 8, format: "float32x2" },
        { shaderLocation: 2, offset: 16, format: "float32x4" },
      ],
    }, blend, "line-list");
    this.globeBind = device.createBindGroup({
      layout: this.oceanPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.globeBuffer } }],
    });
  }

  static async create(canvas: HTMLCanvasElement): Promise<WebGpuPresenter | null> {
    if (!navigator.gpu) return null;
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
    if (!adapter) return null;
    const device = await adapter.requestDevice();
    for (const code of [PAN_WGSL, OVERLAY_WGSL, GLOBE_WGSL]) {
      const info = await device.createShaderModule({ code }).getCompilationInfo();
      if (info.messages.some((message) => message.type === "error")) {
        const text = info.messages.map((message) => message.message).join("\n");
        (globalThis as { __meridianGpu?: string }).__meridianGpu = text;
        device.destroy();
        return null;
      }
    }
    const context = canvas.getContext("webgpu");
    if (!context) {
      device.destroy();
      return null;
    }
    try {
      return new WebGpuPresenter(canvas, device, context);
    } catch {
      device.destroy();
      return null;
    }
  }

  present(frame: MapFrame) {
    const { pixelW, pixelH } = align(this.canvas, frame.cssWidth, frame.cssHeight, frame.ratio);
    this.ensureTargets(pixelW, pixelH);
    if (frame.globe) {
      this.presentGlobe(frame, pixelW, pixelH);
      return;
    }
    const crisp = !frame.motion || this.bakeKey !== frame.bakeKey;
    if (crisp) {
      align(this.basemap, frame.cssWidth, frame.cssHeight, frame.ratio);
      this.basemapCtx.setTransform(frame.ratio, 0, 0, frame.ratio, 0, 0);
      frame.paintBasemap(this.basemapCtx);
      this.copy(this.basemap, this.baseTex!);
      this.bakeKey = frame.bakeKey;
    }
    this.paintOverlayTexture(frame);
    const ox = frame.motion ? frame.transform.ox * frame.ratio : 0;
    const oy = frame.motion ? frame.transform.oy * frame.ratio : 0;
    const k = frame.motion ? frame.transform.k : 1;
    this.device.queue.writeBuffer(this.panBuffer, 0, new Float32Array([k, ox, oy, pixelW, pixelH, crisp ? 1 : 0, 0, 0]));
    this.drawPlanar();
  }

  private presentGlobe(frame: MapFrame, pixelW: number, pixelH: number) {
    const globe = frame.globe!;
    const key = `${globe.colors.land}|${globe.colors.lake}|${globe.colors.coast}|${globe.colors.border}|${globe.colors.river}`;
    if (key !== this.colorKey || !this.triBuf) {
      const baked = paintGlobeBuffers(globe.colors);
      this.triBuf?.destroy();
      this.lineBuf?.destroy();
      this.triBuf = this.device.createBuffer({
        size: Math.max(16, baked.triangles.byteLength),
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
      this.lineBuf = this.device.createBuffer({
        size: Math.max(32, baked.lines.byteLength),
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
      this.device.queue.writeBuffer(this.triBuf, 0, baked.triangles);
      this.device.queue.writeBuffer(this.lineBuf, 0, baked.lines);
      this.triVerts = baked.triVerts;
      this.coastVerts = baked.coastVerts;
      this.borderVerts = baked.borderVerts;
      this.riverVerts = baked.riverVerts;
      this.graticuleVerts = baked.graticuleVerts;
      this.colorKey = key;
    }
    const ocean = rgbUnit(globe.colors.water);
    const lit = rgbUnit(globe.colors.lit);
    const litId = globe.litId ? Number(globe.litId) : -1;
    const data = new Float32Array(16);
    data[0] = (globe.view.center[0] * Math.PI) / 180;
    data[1] = (globe.view.center[1] * Math.PI) / 180;
    data[2] = globe.view.scale * frame.ratio;
    data[3] = pixelW;
    data[4] = pixelH;
    data[5] = Number.isFinite(litId) ? litId : -1;
    data[6] = globe.lit;
    data[8] = lit[0];
    data[9] = lit[1];
    data[10] = lit[2];
    data[11] = 1;
    data[12] = ocean[0];
    data[13] = ocean[1];
    data[14] = ocean[2];
    data[15] = 1;
    this.device.queue.writeBuffer(this.globeBuffer, 0, data);
    this.paintOverlayTexture(frame);
    this.device.queue.writeBuffer(this.panBuffer, 0, new Float32Array([1, 0, 0, pixelW, pixelH, 1, 0, 0]));
    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(),
        loadOp: "clear",
        storeOp: "store",
        clearValue: { r: 0.027, g: 0.035, b: 0.031, a: 1 },
      }],
    });
    pass.setPipeline(this.oceanPipeline);
    pass.setBindGroup(0, this.globeBind!);
    pass.draw(3);
    if (this.triBuf && this.triVerts) {
      pass.setPipeline(this.triPipeline);
      pass.setBindGroup(0, this.globeBind!);
      pass.setVertexBuffer(0, this.triBuf);
      pass.draw(this.triVerts);
    }
    if (this.lineBuf) {
      pass.setPipeline(this.linePipeline);
      pass.setBindGroup(0, this.globeBind!);
      pass.setVertexBuffer(0, this.lineBuf);
      let cursor = 0;
      const drawRange = (count: number) => {
        if (count > 0) pass.draw(count, 1, cursor);
        cursor += count;
      };
      drawRange(this.coastVerts);
      if (globe.mapStyle === "roads") drawRange(this.borderVerts);
      else cursor += this.borderVerts;
      drawRange(this.riverVerts);
      drawRange(this.graticuleVerts);
    }
    pass.setPipeline(this.overlayPipeline);
    pass.setBindGroup(0, this.overlayBind!);
    pass.draw(3);
    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  private drawPlanar() {
    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(),
        loadOp: "clear",
        storeOp: "store",
        clearValue: { r: 0.03, g: 0.035, b: 0.032, a: 1 },
      }],
    });
    pass.setPipeline(this.panPipeline);
    pass.setBindGroup(0, this.panBind!);
    pass.draw(3);
    pass.setPipeline(this.overlayPipeline);
    pass.setBindGroup(0, this.overlayBind!);
    pass.draw(3);
    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  private paintOverlayTexture(frame: MapFrame) {
    align(this.overlay, frame.cssWidth, frame.cssHeight, frame.ratio);
    this.overlayCtx.setTransform(frame.ratio, 0, 0, frame.ratio, 0, 0);
    this.overlayCtx.clearRect(0, 0, frame.cssWidth, frame.cssHeight);
    frame.paintOverlay(this.overlayCtx);
    this.copy(this.overlay, this.overlayTex!);
  }

  private copy(source: HTMLCanvasElement, texture: GPUTexture) {
    this.device.queue.copyExternalImageToTexture(
      { source },
      { texture },
      { width: source.width, height: source.height },
    );
  }

  private ensureTargets(pixelW: number, pixelH: number) {
    if (this.baseTex && this.pixelW === pixelW && this.pixelH === pixelH) return;
    this.baseTex?.destroy();
    this.overlayTex?.destroy();
    const usage = GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT;
    this.baseTex = this.device.createTexture({ size: [pixelW, pixelH], format: "rgba8unorm", usage });
    this.overlayTex = this.device.createTexture({ size: [pixelW, pixelH], format: "rgba8unorm", usage });
    this.pixelW = pixelW;
    this.pixelH = pixelH;
    this.bakeKey = "";
    this.panBind = this.device.createBindGroup({
      layout: this.panPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.panBuffer } },
        { binding: 1, resource: this.baseTex.createView() },
        { binding: 2, resource: this.linearSamp },
        { binding: 3, resource: this.nearestSamp },
      ],
    });
    this.overlayBind = this.device.createBindGroup({
      layout: this.overlayPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.panBuffer } },
        { binding: 1, resource: this.overlayTex.createView() },
        { binding: 2, resource: this.nearestSamp },
      ],
    });
  }

  private pipeline(
    code: string,
    vert: string,
    frag: string,
    buffer: GPUVertexBufferLayout | null,
    blend: GPUBlendState | null,
    topology: GPUPrimitiveTopology = "triangle-list",
  ) {
    const module = this.device.createShaderModule({ code });
    return this.device.createRenderPipeline({
      layout: "auto",
      vertex: { module, entryPoint: vert, buffers: buffer ? [buffer] : [] },
      fragment: {
        module,
        entryPoint: frag,
        targets: [{ format: this.format, blend: blend ?? undefined }],
      },
      primitive: { topology },
    });
  }

  destroy() {
    this.triBuf?.destroy();
    this.lineBuf?.destroy();
    this.baseTex?.destroy();
    this.overlayTex?.destroy();
    this.panBuffer.destroy();
    this.globeBuffer.destroy();
    this.device.destroy();
  }
}
