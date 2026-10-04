import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { foldCubeNet, type NetVector } from "./cubeNetLogic";
import { voxelCoordinates } from "./voxelViewsLogic";
export type SpatialConstructionModel =
  | { kind: "voxel"; size: number; board: number[] }
  | { kind: "net"; size: number; board: number[]; folded: boolean };
export const SPATIAL_FACE_COLORS = [
  "#e39a76",
  "#72a7a2",
  "#d9bb58",
  "#9a8cba",
  "#8fac76",
  "#79a8c8",
];
type Controller = {
  update: (model: SpatialConstructionModel, paused: boolean) => void;
};
/** One renderer for the entire mounted round. All geometry is procedural and scene-owned.
 * No animation loop, easing, external assets, or reduced-motion exceptions are needed. */
export default function SpatialConstructionScene({
  model,
  paused,
}: {
  model: SpatialConstructionModel;
  paused: boolean;
}) {
  const host = useRef<HTMLDivElement>(null),
    controller = useRef<Controller | null>(null);
  const [fallback, setFallback] = useState(false);
  const fold =
    model.kind === "net" ? foldCubeNet(model.size, model.board) : null;
  const showFolded =
    model.kind === "net" && model.folded && fold?.connected && fold.consistent;
  const description =
    model.kind === "voxel"
      ? `当前体素作品，${model.board.reduce((a, b) => a + b, 0)} 个方块。各层位置与左侧按钮一致。`
      : `当前 ${model.board.filter((p) => p >= 0).length} 片纸面${showFolded ? "的 90 度试折预览" : "的平铺预览"}。${fold && !fold.distinct ? "有面会重叠，请查看文字检查结果。" : ""}A 到 F 分别用 1 到 6 个点标记。`;
  useEffect(() => {
    const container = host.current;
    if (!container) return;
    if (typeof WebGLRenderingContext === "undefined") {
      setFallback(true);
      return;
    }
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "low-power",
      });
    } catch {
      setFallback(true);
      return;
    }
    let disposed = false,
      lost = false,
      isPaused = false,
      signature = "";
    const scene = new THREE.Scene(),
      group = new THREE.Group();
    scene.background = new THREE.Color("#f1eee2");
    scene.add(group, new THREE.HemisphereLight(0xffffff, 0x576f65, 3));
    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(4, 8, 5);
    scene.add(light);
    const camera = new THREE.OrthographicCamera(-4, 4, 4, -4, 0.1, 100);
    const cube = new THREE.BoxGeometry(1, 1, 1),
      dot = new THREE.SphereGeometry(0.055, 8, 6);
    const materials = [
      ...SPATIAL_FACE_COLORS,
      "#eee5cf",
      "#38564c",
      "#cfbea0",
    ].map(
      (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.88 }),
    );
    let bounds = new THREE.Box3(
      new THREE.Vector3(-3, 0, -3),
      new THREE.Vector3(3, 3, 3),
    );
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");
    const draw = () => {
      if (!disposed && !lost && !isPaused && !document.hidden)
        renderer.render(scene, camera);
    };
    const resize = () => {
      if (disposed || lost) return;
      const width = Math.max(1, container.clientWidth),
        height = Math.max(1, container.clientHeight);
      renderer.setSize(width, height, false);
      const center = bounds.getCenter(new THREE.Vector3());
      camera.position.copy(center).add(new THREE.Vector3(7, 9, 12));
      camera.lookAt(center);
      camera.updateMatrixWorld(true);
      let spanX = 0,
        spanY = 0;
      for (const x of [bounds.min.x, bounds.max.x])
        for (const y of [bounds.min.y, bounds.max.y])
          for (const z of [bounds.min.z, bounds.max.z]) {
            const p = new THREE.Vector3(x, y, z).applyMatrix4(
              camera.matrixWorldInverse,
            );
            spanX = Math.max(spanX, Math.abs(p.x));
            spanY = Math.max(spanY, Math.abs(p.y));
          }
      const aspect = width / height,
        half = Math.max(1, spanY * 1.1, (spanX * 1.1) / aspect);
      camera.left = -half * aspect;
      camera.right = half * aspect;
      camera.top = half;
      camera.bottom = -half;
      camera.updateProjectionMatrix();
      draw();
    };
    const mesh = (
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      color: number,
    ) => {
      const m = new THREE.Mesh(cube, materials[color]);
      m.position.set(x, y, z);
      m.scale.set(w, h, d);
      group.add(m);
      return m;
    };
    const world = (v: NetVector) => new THREE.Vector3(v[0], v[2], -v[1]);
    controller.current = {
      update(next, nextPaused) {
        isPaused = nextPaused;
        const key = JSON.stringify(next);
        if (key !== signature) {
          // Geometry/materials are shared for the lifetime of this renderer. Removing
          // old meshes releases their CPU references without recreating GPU resources.
          group.clear();
          signature = key;
          const n = next.size,
            shift = (n - 1) / 2;
          mesh(0, -0.15, 0, n + 0.35, 0.22, n + 0.35, 8);
          if (next.kind === "voxel") {
            for (let x = 0; x < n; x++)
              for (let y = 0; y < n; y++)
                mesh(x - shift, -0.02, y - shift, 0.96, 0.04, 0.96, 6);
            next.board.forEach((v, i) => {
              if (v === 1) {
                const [x, y, z] = voxelCoordinates(n, i);
                mesh(x - shift, z + 0.5, y - shift, 0.87, 0.87, 0.87, z);
              }
            });
            bounds = new THREE.Box3(
              new THREE.Vector3(-n / 2 - 0.2, -0.3, -n / 2 - 0.2),
              new THREE.Vector3(n / 2 + 0.2, n, n / 2 + 0.2),
            );
          } else {
            const folded = foldCubeNet(n, next.board),
              foldNow = next.folded && folded.connected && folded.consistent;
            next.board.forEach((p, face) => {
              if (p < 0) return;
              const frame = folded.frames[face];
              const center =
                foldNow && frame
                  ? world(frame.normal)
                      .multiplyScalar(0.52 + face * 0.001)
                      .add(new THREE.Vector3(0, 0.72, 0))
                  : new THREE.Vector3(
                      (p % n) - shift,
                      0.045,
                      Math.floor(p / n) - shift,
                    );
              const u =
                  foldNow && frame
                    ? world(frame.u)
                    : new THREE.Vector3(1, 0, 0),
                v =
                  foldNow && frame
                    ? world(frame.v)
                    : new THREE.Vector3(0, 0, -1),
                normal =
                  foldNow && frame
                    ? world(frame.normal)
                    : new THREE.Vector3(0, 1, 0);
              const paper = mesh(
                center.x,
                center.y,
                center.z,
                0.93,
                0.93,
                0.04,
                face,
              );
              paper.quaternion.setFromRotationMatrix(
                new THREE.Matrix4().makeBasis(u, v, normal),
              );
              for (let k = 0; k <= face; k++) {
                const pip = new THREE.Mesh(dot, materials[7]);
                const px = face === 0 ? 0 : k % 2 ? 0.19 : -0.19,
                  py =
                    face < 2
                      ? 0
                      : (Math.floor(k / 2) - Math.floor(face / 2) / 2) * 0.24;
                pip.position
                  .copy(center)
                  .addScaledVector(u, px)
                  .addScaledVector(v, py)
                  .addScaledVector(normal, 0.025);
                group.add(pip);
              }
            });
            bounds = foldNow
              ? new THREE.Box3(
                  new THREE.Vector3(-1.4, -0.3, -1.4),
                  new THREE.Vector3(1.4, 1.45, 1.4),
                )
              : new THREE.Box3(
                  new THREE.Vector3(-n / 2 - 0.2, -0.3, -n / 2 - 0.2),
                  new THREE.Vector3(n / 2 + 0.2, 0.3, n / 2 + 0.2),
                );
            if (foldNow) {
              const floor = group.children[0] as THREE.Mesh;
              floor.scale.set(2.6, 0.22, 2.6);
            }
          }
          resize();
        }
        draw();
      },
    };
    const onLost = (event: Event) => {
      event.preventDefault();
      lost = true;
      renderer.domElement.style.display = "none";
      setFallback(true);
    };
    const onRestored = () => {
      if (disposed) return;
      lost = false;
      renderer.domElement.style.display = "";
      setFallback(false);
      resize();
    };
    renderer.domElement.addEventListener("webglcontextlost", onLost);
    renderer.domElement.addEventListener("webglcontextrestored", onRestored);
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    observer?.observe(container);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", draw);
    setFallback(false);
    return () => {
      disposed = true;
      controller.current = null;
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", draw);
      renderer.domElement.removeEventListener("webglcontextlost", onLost);
      renderer.domElement.removeEventListener(
        "webglcontextrestored",
        onRestored,
      );
      scene.clear();
      group.clear();
      cube.dispose();
      dot.dispose();
      materials.forEach((m) => m.dispose());
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);
  useEffect(() => {
    controller.current?.update(model, paused);
  }, [model, paused]);
  return (
    <figure className={`sc-scene ${paused ? "sc-scene-paused" : ""}`}>
      <div
        ref={host}
        className="sc-scene-host"
        role="img"
        aria-label={description}
      >
        {fallback && (
          <div className="sc-fallback">
            <strong>平面操作照常可用</strong>
            <p>
              此设备未启用 3D 预览。所有方块、纸面与检查结果都能在左侧读到。
            </p>
          </div>
        )}
      </div>
      <figcaption>{paused ? "预览已暂停。" : description}</figcaption>
    </figure>
  );
}
