// SPDX-License-Identifier: GPL-3.0-only
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  rollFaceLabel,
  type RollBoard,
  type RollingLevel,
} from "./rollingFacesLogic";
const colors = [
  "#d98864",
  "#79a9a2",
  "#d3b957",
  "#9b8bb7",
  "#87a572",
  "#7b9fbb",
];
export default function RollingFacesScene({
  level,
  board,
  paused,
}: {
  level: RollingLevel;
  board: RollBoard;
  paused: boolean;
}) {
  const host = useRef<HTMLDivElement>(null),
    controller = useRef<((b: RollBoard, p: boolean) => void) | null>(null);
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    const container = host.current;
    if (!container || typeof WebGLRenderingContext === "undefined") {
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
      isPaused = paused;
    const scene = new THREE.Scene(),
      camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
    scene.background = new THREE.Color("#eeeade");
    scene.add(new THREE.HemisphereLight(0xffffff, 0x53645b, 3));
    const light = new THREE.DirectionalLight(0xffffff, 2);
    light.position.set(3, 8, 5);
    scene.add(light);
    const geometry = new THREE.BoxGeometry(1, 1, 1),
      textures: THREE.CanvasTexture[] = [],
      materials: THREE.MeshStandardMaterial[] = [];
    function material(color: string, label?: string) {
      let map: THREE.CanvasTexture | undefined;
      if (label) {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 128;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, 128, 128);
          ctx.strokeStyle = "#263e36";
          ctx.lineWidth = 7;
          ctx.strokeRect(5, 5, 118, 118);
          ctx.fillStyle = "#18382f";
          ctx.font = "bold 72px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(label, 64, 66);
          map = new THREE.CanvasTexture(canvas);
          textures.push(map);
        }
      }
      const m = new THREE.MeshStandardMaterial({
        color: map ? "#ffffff" : color,
        map,
        roughness: 0.85,
      });
      materials.push(m);
      return m;
    }
    const floor = material("#e0dac7"),
      wall = material("#bcb8a8"),
      exit = material("#b1c8a2"),
      gate = material("#bfa5cd"),
      plateOff = material("#e9d696"),
      plateOn = material("#8ebc9e");
    const faceMaterials = colors.map((c, i) => material(c, rollFaceLabel(i)));
    const cube = new THREE.Mesh(geometry, [
      faceMaterials[3],
      faceMaterials[2],
      faceMaterials[0],
      faceMaterials[5],
      faceMaterials[4],
      faceMaterials[1],
    ]);
    cube.scale.set(0.82, 0.82, 0.82);
    scene.add(cube);
    const plateMeshes: THREE.Mesh[] = [];
    for (let y = 0; y < level.rows.length; y++)
      for (let x = 0; x < level.rows[0].length; x++) {
        const tile = new THREE.Mesh(
          geometry,
          level.rows[y][x] === "#"
            ? wall
            : x === level.exit.x && y === level.exit.y
              ? exit
              : floor,
        );
        tile.position.set(x, level.rows[y][x] === "#" ? -0.04 : -0.15, y);
        tile.scale.set(0.94, level.rows[y][x] === "#" ? 0.42 : 0.16, 0.94);
        scene.add(tile);
      }
    level.plates.forEach((p) => {
      const mesh = new THREE.Mesh(geometry, plateOff);
      mesh.position.set(p.x, -0.025, p.y);
      mesh.scale.set(0.67, 0.09, 0.67);
      scene.add(mesh);
      plateMeshes.push(mesh);
    });
    level.gates.forEach((g) => {
      for (const dx of [-0.43, 0.43]) {
        const mesh = new THREE.Mesh(geometry, gate);
        mesh.position.set(g.x + dx, 0.2, g.y);
        mesh.scale.set(0.09, 0.6, 0.7);
        scene.add(mesh);
      }
    });
    const center = new THREE.Vector3(
      (level.rows[0].length - 1) / 2,
      0,
      (level.rows.length - 1) / 2,
    );
    // Looking from the south: north is always the far edge, east always the right.
    camera.position.copy(center).add(new THREE.Vector3(0, 8, 8));
    camera.lookAt(center);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.setAttribute("aria-hidden", "true");
    container.appendChild(renderer.domElement);
    const draw = () => {
      if (!disposed && !lost && !isPaused && !document.hidden)
        renderer.render(scene, camera);
    };
    const resize = () => {
      if (disposed) return;
      const w = Math.max(1, container.clientWidth),
        h = Math.max(1, container.clientHeight),
        aspect = w / h,
        projectedHeight = level.rows.length / Math.sqrt(2) + 1.4,
        projectedWidth = level.rows[0].length + 0.8,
        half = Math.max(projectedHeight / 2, projectedWidth / (2 * aspect));
      camera.left = -half * aspect;
      camera.right = half * aspect;
      camera.top = half;
      camera.bottom = -half;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      draw();
    };
    const vectors = [
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, -1],
      [0, 0, 1],
      [-1, 0, 0],
      [1, 0, 0],
    ];
    controller.current = (b, p) => {
      isPaused = p;
      cube.position.set(b.x, 0.39, b.y);
      const vector = (face: number) =>
        new THREE.Vector3(
          ...(vectors[b.faces.indexOf(face)] as [number, number, number]),
        );
      cube.setRotationFromMatrix(
        new THREE.Matrix4().makeBasis(vector(3), vector(0), vector(4)),
      );
      plateMeshes.forEach((m, i) => {
        m.material = b.plates & (1 << i) ? plateOn : plateOff;
      });
      draw();
    };
    const onLost = (event: Event) => {
      event.preventDefault();
      lost = true;
      setFallback(true);
    };
    renderer.domElement.addEventListener("webglcontextlost", onLost);
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    observer?.observe(container);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", draw);
    resize();
    controller.current(board, paused);
    return () => {
      disposed = true;
      controller.current = null;
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", draw);
      renderer.domElement.removeEventListener("webglcontextlost", onLost);
      geometry.dispose();
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      scene.clear();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [level]);
  useEffect(() => {
    controller.current?.(board, paused);
  }, [board, paused]);
  return (
    <figure
      className="rf-scene"
      aria-label={`实时立方体预览：${board.y + 1} 行 ${board.x + 1} 列，底面 ${rollFaceLabel(board.faces[1])}，北面 ${rollFaceLabel(board.faces[2])}`}
    >
      <div ref={host} className="rf-scene-host" hidden={fallback} />
      {fallback && (
        <div className="rf-fallback">
          <b>六面地图仍然完整</b>
          <p>3D 预览不可用。下方棋盘、面图与方向按钮包含全部规则与操作。</p>
        </div>
      )}
      <figcaption>
        固定视角 · 远端是北 ↑ · 右侧是东 → · 静态更新，无滚动动画
      </figcaption>
    </figure>
  );
}
