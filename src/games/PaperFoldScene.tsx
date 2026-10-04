// SPDX-License-Identifier: MIT
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { PaperBoard, PaperLevel } from "./paperFoldLogic";
/** On-demand static rendering: no RAF, animation, downloaded models, or hidden rules. */
export default function PaperFoldScene({
  level,
  board,
  paused,
}: {
  level: PaperLevel;
  board: PaperBoard;
  paused: boolean;
}) {
  const host = useRef<HTMLDivElement>(null),
    controller = useRef<((b: PaperBoard, p: boolean) => void) | null>(null),
    [fallback, setFallback] = useState(false);
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
      camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100),
      geometry = new THREE.BoxGeometry(1, 1, 1),
      group = new THREE.Group();
    const colors = [
        "#e5c480",
        "#8bb5a3",
        "#bbabcb",
        "#dfa88a",
        "#a7bc7e",
        "#8cabc0",
      ],
      materials = colors.map(
        (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.92 }),
      ),
      floorMaterial = new THREE.MeshStandardMaterial({ color: "#d1d8c9" });
    scene.background = new THREE.Color("#e6e9de");
    scene.add(group);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x55634b, 2.8));
    const light = new THREE.DirectionalLight(0xffffff, 2);
    light.position.set(2, 9, 5);
    scene.add(light);
    const floor = new THREE.Mesh(geometry, floorMaterial);
    floor.scale.set(level.width + 0.25, 0.08, level.height + 0.25);
    floor.position.set((level.width - 1) / 2, -0.1, (level.height - 1) / 2);
    scene.add(floor);
    const center = new THREE.Vector3(
      (level.width - 1) / 2,
      0.3,
      (level.height - 1) / 2,
    );
    camera.position.copy(center).add(new THREE.Vector3(3, 8, 7));
    camera.lookAt(center);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.domElement.setAttribute("aria-hidden", "true");
    container.appendChild(renderer.domElement);
    const draw = () => {
      if (!disposed && !lost && !isPaused && !document.hidden)
        renderer.render(scene, camera);
    };
    const resize = () => {
      if (disposed || lost) return;
      const w = Math.max(1, container.clientWidth),
        h = Math.max(1, container.clientHeight),
        aspect = w / h,
        half = Math.max(
          (level.height + 2) / 2,
          (level.width + 2) / (2 * aspect),
        );
      camera.left = -half * aspect;
      camera.right = half * aspect;
      camera.top = half;
      camera.bottom = -half;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      draw();
    };
    controller.current = (b, p) => {
      isPaused = p;
      group.clear();
      const stacks =
        b.phase === "unfolded" ? b.stacks.map((_, i) => [i]) : b.stacks;
      stacks.forEach((stack, cell) =>
        stack.forEach((origin, z) => {
          const x = cell % level.width,
            y = Math.floor(cell / level.width),
            height = 0.05 + z * 0.14,
            material =
              materials[Math.floor(origin / level.width) % materials.length];
          const box = (dx: number, dz: number, sx: number, sz: number) => {
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(x + dx, height, y + dz);
            mesh.scale.set(sx, 0.065, sz);
            group.add(mesh);
          };
          if (b.holes.includes(origin)) {
            box(-0.32, 0, 0.25, 0.9);
            box(0.32, 0, 0.25, 0.9);
            box(0, -0.32, 0.39, 0.25);
            box(0, 0.32, 0.39, 0.25);
          } else box(0, 0, 0.9, 0.9);
        }),
      );
      draw();
    };
    const contextLost = (event: Event) => {
      event.preventDefault();
      lost = true;
      setFallback(true);
    };
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
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
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      group.clear();
      scene.clear();
      geometry.dispose();
      materials.forEach((m) => m.dispose());
      floorMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [level]);
  useEffect(() => {
    controller.current?.(board, paused);
  }, [board, paused]);
  return (
    <figure
      className="pf-scene"
      aria-label={`实际纸层预览，${board.folds} 次折叠，${board.holes.length} 个原格已打孔`}
    >
      <div ref={host} hidden={fallback} className="pf-scene-host" />
      {fallback && (
        <div className="pf-scene-fallback">
          <b>3D 预览不可用</b>
          <p>
            纸板格子与“当前叠层原格清单”包含全部纸层、孔位与操作，可以继续完成游戏。
          </p>
        </div>
      )}
      <figcaption>
        实际叠层的静态预览 · 层间距放大便于查看 · 方孔贯穿已打穿的原格 ·
        操作与坐标以 2D 纸板为准 · 暂停时停止渲染
      </figcaption>
    </figure>
  );
}
