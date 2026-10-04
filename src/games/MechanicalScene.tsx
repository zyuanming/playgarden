import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export type MechanicalModel =
  | {
      kind: "balance";
      arm: number;
      torque: number;
      weights: { id: string; mass: number; position: number; fixed: boolean }[];
    }
  | {
      kind: "gears";
      stages: {
        driver: number;
        driven: number;
        idler: number;
        driverSpeed: number;
        drivenSpeed: number;
        idlerSpeed: number;
      }[];
    };

type Props = { model: MechanicalModel; paused: boolean; won: boolean };
type MovingGear = { mesh: THREE.Group; rpm: number };
type Assembly = {
  root: THREE.Group;
  resources: Resources;
  gears: MovingGear[];
  beam?: THREE.Group;
  tilt: number;
  bounds: THREE.Box3;
};

const colors = {
  cream: "#fff4dd",
  wood: "#dca46d",
  edge: "#b97947",
  teal: "#2e9492",
  coral: "#e67e62",
  yellow: "#efbe56",
  dark: "#405e62",
  green: "#75a874",
};

/** All scene-owned GPU resources are released together on model changes. */
class Resources {
  geometries = new Set<THREE.BufferGeometry>();
  materials = new Set<THREE.Material>();
  textures = new Set<THREE.Texture>();

  geometry<T extends THREE.BufferGeometry>(value: T): T {
    this.geometries.add(value);
    return value;
  }

  material(color: string, metalness = 0) {
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.65,
      metalness,
    });
    this.materials.add(material);
    return material;
  }

  dispose() {
    this.geometries.forEach((value) => value.dispose());
    this.materials.forEach((value) => value.dispose());
    this.textures.forEach((value) => value.dispose());
  }
}

function describe(model: MechanicalModel) {
  if (model.kind === "balance") {
    const state =
      model.torque === 0
        ? "横梁平衡"
        : model.torque > 0
          ? "右侧力矩较大，右端下沉"
          : "左侧力矩较大，左端下沉";
    return `天平三维预览：${state}。${model.weights
      .map(
        (weight) =>
          `${weight.mass} 单位砝码位于 ${weight.position > 0 ? "+" : ""}${weight.position} 格${weight.fixed ? "（固定）" : ""}`,
      )
      .join("；")}。`;
  }
  const speed = (rpm: number) =>
    `${Math.abs(rpm).toLocaleString("zh-CN", { maximumFractionDigits: 2 })} 转/分，${rpm === 0 ? "静止" : rpm > 0 ? "顺时针" : "逆时针"}`;
  return `齿轮三维预览，从正面看。${model.stages
    .map(
      (stage, index) =>
        `第 ${index + 1} 级：主动轮 ${stage.driver} 齿，${speed(stage.driverSpeed)}；${stage.idler > 0 ? `惰轮 ${stage.idler} 齿，${speed(stage.idlerSpeed)}；` : ""}从动轮 ${stage.driven} 齿，${speed(stage.drivenSpeed)}`,
    )
    .join(
      "。",
    )}${model.stages.length > 1 ? "。相邻级的从动轮和主动轮共用一根轴，位于不同前后层" : ""}。`;
}

function createAssembly(model: MechanicalModel, won: boolean): Assembly {
  const resources = new Resources();
  const root = new THREE.Group();
  const gears: MovingGear[] = [];
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const material = (color: string) => {
    if (!materials.has(color)) materials.set(color, resources.material(color));
    return materials.get(color)!;
  };
  const mesh = (
    geometry: THREE.BufferGeometry,
    color: string,
    x: number,
    y: number,
    z: number,
    parent: THREE.Object3D = root,
  ) => {
    const object = new THREE.Mesh(
      resources.geometry(geometry),
      material(color),
    );
    object.position.set(x, y, z);
    parent.add(object);
    return object;
  };
  const box = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    color: string,
    parent: THREE.Object3D = root,
  ) => mesh(new THREE.BoxGeometry(w, h, d), color, x, y, z, parent);
  const cylinder = (
    radius: number,
    height: number,
    x: number,
    y: number,
    z: number,
    color: string,
    parent: THREE.Object3D = root,
    axial = false,
  ) => {
    const object = mesh(
      new THREE.CylinderGeometry(radius, radius, height, 32),
      color,
      x,
      y,
      z,
      parent,
    );
    if (axial) object.rotation.x = Math.PI / 2;
    return object;
  };
  const label = (
    text: string,
    x: number,
    y: number,
    z: number,
    size: number,
    parent: THREE.Object3D = root,
    color = colors.dark,
  ) => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 96;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.font = "700 52px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = color;
    context.fillText(text, 128, 48, 244);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    resources.textures.add(texture);
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });
    resources.materials.add(spriteMaterial);
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.set(x, y, z);
    sprite.scale.set(size * (256 / 96), size, 1);
    parent.add(sprite);
  };

  if (model.kind === "balance") {
    const arm = Math.max(1, model.arm);
    const step = 0.66;
    const width = arm * step * 2 + 1.2;
    box(width + 0.9, 0.22, 2.4, 0, 0, 0, colors.edge);
    box(width + 1, 0.13, 2.5, 0, 0.15, 0, colors.wood);
    box(width - 0.1, 0.02, 1.8, 0, 0.225, 0, "#ebc994");
    for (const x of [-width / 2 + 0.2, width / 2 - 0.2]) {
      cylinder(0.09, 0.025, x, 0.24, 0.82, colors.edge);
      cylinder(0.09, 0.025, x, 0.24, -0.82, colors.edge);
    }
    const fulcrumShape = new THREE.Shape();
    fulcrumShape.moveTo(-0.65, 0.28);
    fulcrumShape.lineTo(0.65, 0.28);
    fulcrumShape.lineTo(0, 1.78);
    fulcrumShape.closePath();
    const support = new THREE.ExtrudeGeometry(fulcrumShape, {
      depth: 0.7,
      bevelEnabled: true,
      bevelSize: 0.055,
      bevelThickness: 0.04,
      bevelSegments: 2,
      steps: 1,
    });
    mesh(support, colors.teal, 0, 0, -0.35);
    cylinder(0.19, 0.98, 0, 1.78, 0, colors.yellow, root, true);
    cylinder(0.08, 1.03, 0, 1.78, 0, colors.dark, root, true);
    const beam = new THREE.Group();
    beam.position.set(0, 1.78, 0);
    root.add(beam);
    box(
      width - 0.2,
      0.19,
      0.46,
      0,
      0,
      0,
      won ? colors.green : colors.coral,
      beam,
    );
    box(width - 0.24, 0.055, 0.48, 0, 0.08, 0, colors.cream, beam);
    for (let position = -Math.floor(arm); position <= arm; position++) {
      box(0.035, 0.13, 0.015, position * step, 0, 0.25, colors.dark, beam);
      label(
        position > 0 ? `+${position}` : `${position}`,
        position * step,
        -0.28,
        0.29,
        0.24,
        beam,
      );
    }
    // The clamps travel with the beam; stacked cylinders indicate mass directly.
    model.weights.forEach((weight) => {
      const x = weight.position * step;
      const height = Math.max(0.22, weight.mass * 0.18);
      const color = weight.fixed ? colors.teal : colors.yellow;
      box(0.34, 0.11, 0.58, x, 0.13, 0, colors.dark, beam);
      cylinder(0.23, height, x, 0.19 + height / 2, 0, color, beam);
      for (let unit = 1; unit < weight.mass; unit++) {
        cylinder(0.235, 0.016, x, 0.19 + unit * 0.18, 0, colors.cream, beam);
      }
      cylinder(0.12, 0.1, x, 0.24 + height, 0, colors.dark, beam);
      label(`${weight.mass}`, x, 0.47 + height, 0.05, 0.3, beam);
    });
    label("−", -width / 2 + 0.2, 0.55, 0.72, 0.35);
    label("+", width / 2 - 0.2, 0.55, 0.72, 0.35);
    const tilt = -Math.tanh(model.torque / Math.max(4, arm * 3)) * 0.29;
    beam.rotation.z = tilt;
    // Include both tilt extremes so the camera does not jump after every move.
    const bounds = new THREE.Box3().setFromObject(root);
    bounds.expandByPoint(new THREE.Vector3(-width / 2 - 0.3, 3.3, 0));
    bounds.expandByPoint(new THREE.Vector3(width / 2 + 0.3, 3.3, 0));
    return { root, resources, gears, beam, tilt, bounds };
  }

  // A shared tooth module means pitch radius is exactly proportional to teeth.
  const toothModule = 0.044;
  const radius = (teeth: number) => Math.max(1, teeth) * toothModule;
  let x = 0;
  let largest = 0.5;
  const layout = model.stages.map((stage, index) => {
    const driverX = x;
    const idlerX = x + radius(stage.driver) + radius(stage.idler);
    x += radius(stage.driver) + radius(stage.driven);
    if (stage.idler > 0) x += 2 * radius(stage.idler);
    largest = Math.max(
      largest,
      radius(stage.driver),
      radius(stage.driven),
      radius(stage.idler),
    );
    return { stage, driverX, drivenX: x, idlerX, z: 0.15 + index * 1.05 };
  });
  const left = -(layout[0] ? radius(layout[0].stage.driver) : 0.5);
  const right =
    x + (layout.length ? radius(layout[layout.length - 1].stage.driven) : 0.5);
  const center = (left + right) / 2;
  const width = right - left + 1.05;
  box(width, largest * 2 + 0.85, 0.18, center, 0, -0.46, "#edcf9d");
  box(width + 0.12, 0.28, 4.05, center, -largest - 0.7, 0.75, colors.edge);
  box(width + 0.25, 0.12, 4.2, center, -largest - 0.5, 0.75, colors.wood);
  for (const screwX of [left - 0.25, right + 0.25]) {
    for (const screwY of [-largest - 0.17, largest + 0.17]) {
      cylinder(0.06, 0.035, screwX, screwY, -0.34, colors.edge, root, true);
    }
  }

  const addGear = (
    teeth: number,
    rpm: number,
    cx: number,
    z: number,
    color: string,
    phase: number,
  ) => {
    const count = Math.max(1, Math.round(teeth));
    const r = radius(teeth);
    const shape = new THREE.Shape();
    // Original trapezoid teeth, with a consistent pitch and visible tooth valleys.
    for (let tooth = 0; tooth < count; tooth++) {
      const profile = [
        [0, -0.8],
        [0.2, -0.8],
        [0.34, 0.8],
        [0.66, 0.8],
        [0.8, -0.8],
      ];
      profile.forEach(([fraction, offset], point) => {
        const angle = ((tooth + fraction) / count) * Math.PI * 2;
        const rr = Math.max(0.015, r + offset * toothModule);
        const px = Math.cos(angle) * rr;
        const py = Math.sin(angle) * rr;
        if (tooth === 0 && point === 0) shape.moveTo(px, py);
        else shape.lineTo(px, py);
      });
    }
    shape.closePath();
    if (r > 0.35) {
      for (let hole = 0; hole < 3; hole++) {
        const angle = (hole / 3) * Math.PI * 2;
        const path = new THREE.Path();
        path.absarc(
          Math.cos(angle) * r * 0.51,
          Math.sin(angle) * r * 0.51,
          r * 0.17,
          0,
          Math.PI * 2,
          true,
        );
        shape.holes.push(path);
      }
    }
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.19,
      bevelEnabled: true,
      bevelSize: 0.012,
      bevelThickness: 0.018,
      bevelSegments: 1,
      curveSegments: 10,
      steps: 1,
    });
    geometry.translate(0, 0, -0.095);
    const wheel = new THREE.Group();
    wheel.position.set(cx, 0, z);
    wheel.rotation.z = phase;
    root.add(wheel);
    mesh(geometry, won ? colors.green : color, 0, 0, 0, wheel);
    cylinder(
      Math.min(r * 0.27, 0.2),
      0.27,
      0,
      0,
      0.04,
      colors.cream,
      wheel,
      true,
    );
    cylinder(
      Math.min(r * 0.12, 0.07),
      0.31,
      0,
      0,
      0.055,
      colors.dark,
      wheel,
      true,
    );
    box(
      r * 0.25,
      Math.min(0.055, r * 0.1),
      0.025,
      r * 0.73,
      0,
      0.13,
      colors.cream,
      wheel,
    );
    gears.push({ mesh: wheel, rpm });
    label(`${teeth}`, cx, -r - 0.21, z + 0.05, 0.27);
  };

  layout.forEach(({ stage, driverX, drivenX, idlerX, z }, index) => {
    // Shaft cylinders connect axial layers, never the edges of compound wheels.
    const shaftBack = -0.37;
    const shaftFront = z + 0.22;
    if (index === 0)
      cylinder(
        0.075,
        shaftFront - shaftBack,
        driverX,
        0,
        (shaftFront + shaftBack) / 2,
        colors.dark,
        root,
        true,
      );
    const nextZ =
      index < layout.length - 1 ? layout[index + 1].z + 0.22 : shaftFront;
    cylinder(
      0.075,
      nextZ - shaftBack,
      drivenX,
      0,
      (nextZ + shaftBack) / 2,
      colors.dark,
      root,
      true,
    );
    addGear(stage.driver, stage.driverSpeed, driverX, z, colors.teal, 0);
    if (stage.idler > 0) {
      cylinder(
        0.065,
        shaftFront - shaftBack,
        idlerX,
        0,
        (shaftFront + shaftBack) / 2,
        colors.dark,
        root,
        true,
      );
      addGear(
        stage.idler,
        stage.idlerSpeed,
        idlerX,
        z,
        colors.yellow,
        Math.PI - Math.PI / stage.idler,
      );
      addGear(stage.driven, stage.drivenSpeed, drivenX, z, colors.coral, 0);
    } else {
      addGear(
        stage.driven,
        stage.drivenSpeed,
        drivenX,
        z,
        colors.coral,
        Math.PI - Math.PI / stage.driven,
      );
    }
    label(`${index + 1}`, (driverX + drivenX) / 2, largest + 0.34, z, 0.29);
    if (index < layout.length - 1) {
      // A collar makes the between-plane, same-shaft connection unmistakable.
      cylinder(0.14, 0.24, drivenX, 0, z + 0.34, colors.yellow, root, true);
    }
  });
  return {
    root,
    resources,
    gears,
    tilt: 0,
    bounds: new THREE.Box3().setFromObject(root),
  };
}

export function MechanicalScene({ model, paused, won }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controller = useRef<{ update: (props: Props) => void } | null>(null);
  const [fallback, setFallback] = useState(false);
  const description = describe(model);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (typeof window.WebGL2RenderingContext === "undefined") {
      setFallback(true);
      return;
    }
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setFallback(true);
      return;
    }
    setFallback(false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.style.cssText =
      "display:block;width:100%;height:100%;pointer-events:none";
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f7ead4");
    scene.add(new THREE.HemisphereLight(0xfffbef, 0x667c73, 2.9));
    const sun = new THREE.DirectionalLight(0xffedce, 3.2);
    sun.position.set(-5, 9, 12);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffffff, 1);
    fill.position.set(7, 2, -3);
    scene.add(fill);
    const camera = new THREE.OrthographicCamera(-5, 5, 3, -3, 0.1, 100);
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let reducedMotion = media?.matches ?? false;
    let assembly: Assembly | null = null;
    let currentSignature = "";
    let isPaused = false;
    let frame = 0;
    let lastTime = 0;
    let disposed = false;
    let contextLost = false;

    const draw = () => {
      if (!disposed && !contextLost) renderer.render(scene, camera);
    };
    const resize = () => {
      if (disposed || contextLost) return;
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      if (assembly) {
        const center = assembly.bounds.getCenter(new THREE.Vector3());
        camera.position.copy(center).add(new THREE.Vector3(3.5, 7.5, 20));
        camera.lookAt(center);
        camera.updateMatrixWorld(true);
        let spanX = 0;
        let spanY = 0;
        for (const x of [assembly.bounds.min.x, assembly.bounds.max.x]) {
          for (const y of [assembly.bounds.min.y, assembly.bounds.max.y]) {
            for (const z of [assembly.bounds.min.z, assembly.bounds.max.z]) {
              const point = new THREE.Vector3(x, y, z).applyMatrix4(
                camera.matrixWorldInverse,
              );
              spanX = Math.max(spanX, Math.abs(point.x));
              spanY = Math.max(spanY, Math.abs(point.y));
            }
          }
        }
        const aspect = width / height;
        const halfHeight = Math.max(spanY * 1.09, (spanX * 1.07) / aspect, 1);
        camera.left = -halfHeight * aspect;
        camera.right = halfHeight * aspect;
        camera.top = halfHeight;
        camera.bottom = -halfHeight;
        camera.updateProjectionMatrix();
      }
      draw();
    };
    const canAnimate = () =>
      !disposed &&
      !contextLost &&
      !isPaused &&
      !reducedMotion &&
      !document.hidden;
    const hasMotion = () =>
      !!assembly &&
      (assembly.gears.some((gear) => gear.rpm !== 0) ||
        (!!assembly.beam &&
          Math.abs(assembly.beam.rotation.z - assembly.tilt) > 0.0001));
    const tick = (time: number) => {
      frame = 0;
      if (!canAnimate() || !assembly) return;
      const delta = lastTime ? (time - lastTime) / 1000 : 0;
      lastTime = time;
      assembly.gears.forEach(({ mesh: wheel, rpm }) => {
        // +RPM is clockwise when looking at the gear's front (+Z).
        wheel.rotation.z =
          (wheel.rotation.z - (rpm * Math.PI * 2 * delta) / 60) % (Math.PI * 2);
      });
      if (assembly.beam) {
        const diff = assembly.tilt - assembly.beam.rotation.z;
        assembly.beam.rotation.z += diff * (1 - Math.exp(-delta * 9));
        if (Math.abs(diff) < 0.0001) assembly.beam.rotation.z = assembly.tilt;
      }
      draw();
      if (hasMotion()) frame = window.requestAnimationFrame(tick);
    };
    const schedule = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
      if (canAnimate() && hasMotion())
        frame = window.requestAnimationFrame(tick);
    };
    const motionChanged = () => {
      reducedMotion = media?.matches ?? false;
      if (reducedMotion && assembly?.beam)
        assembly.beam.rotation.z = assembly.tilt;
      draw();
      schedule();
    };
    const visibilityChanged = () => schedule();
    const lost = (event: Event) => {
      event.preventDefault();
      contextLost = true;
      schedule();
      setFallback(true);
      renderer.domElement.style.display = "none";
    };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    media?.addEventListener?.("change", motionChanged);
    document.addEventListener("visibilitychange", visibilityChanged);
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    observer?.observe(host);
    window.addEventListener("resize", resize);
    controller.current = {
      update(props) {
        isPaused = props.paused;
        const signature = JSON.stringify([props.model, props.won]);
        if (signature !== currentSignature) {
          const previousTilt = assembly?.beam?.rotation.z;
          if (assembly) {
            scene.remove(assembly.root);
            assembly.resources.dispose();
          }
          assembly = createAssembly(props.model, props.won);
          if (assembly.beam && previousTilt !== undefined && !reducedMotion)
            assembly.beam.rotation.z = previousTilt;
          scene.add(assembly.root);
          currentSignature = signature;
          resize();
        }
        draw();
        schedule();
      },
    };
    resize();
    return () => {
      disposed = true;
      controller.current = null;
      if (frame) window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", visibilityChanged);
      media?.removeEventListener?.("change", motionChanged);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      assembly?.resources.dispose();
      scene.clear();
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    controller.current?.update({ model, paused, won });
  }, [model, paused, won]);

  return (
    <div
      ref={hostRef}
      className="mechanical-scene"
      role="img"
      aria-label={description}
    >
      {fallback && (
        <div style={{ padding: "1.25rem", lineHeight: 1.7 }}>
          <strong>
            {model.kind === "balance" ? "天平状态" : "齿轮传动状态"}
          </strong>
          <p>{description}</p>
          <p>此设备无法显示 3D 预览。下方按钮与数据仍可正常完成实验。</p>
        </div>
      )}
    </div>
  );
}
