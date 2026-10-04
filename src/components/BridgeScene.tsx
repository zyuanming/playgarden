import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { exits, type Tile } from "../games/bridgeLogic";
export function BridgeScene({ tiles, won }: { tiles: Tile[]; won: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setFallback(true);
      return;
    }
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#fae4c9");
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(6, 8, 8);
    camera.lookAt(0, 0, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x527866, 3));
    const sun = new THREE.DirectionalLight(0xffffff, 3);
    sun.position.set(-3, 8, 5);
    scene.add(sun);
    const geometries: THREE.BufferGeometry[] = [],
      materials: THREE.Material[] = [];
    const box = (
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      color: string,
    ) => {
      const g = new THREE.BoxGeometry(w, h, d),
        m = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
      geometries.push(g);
      materials.push(m);
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(x, y, z);
      scene.add(mesh);
      return mesh;
    };
    box(7, 0.12, 6, 0, -0.48, 0, "#78bbc6");
    box(1.1, 0.65, 6, -3.1, -0.15, 0, "#e2b78a");
    box(1.1, 0.65, 6, 3.1, -0.15, 0, "#e2b78a");
    tiles.forEach((t) => {
      const x = t.x - 2,
        z = t.y - 2;
      box(0.9, 0.26, 0.9, x, -0.08, z, won ? "#88b951" : "#eaa34d");
      box(0.35, 0.11, 0.35, x, 0.105, z, "#fff4d8");
      exits(t).forEach((dir) => {
        const dx = [1, 0, -1, 0][dir],
          dz = [0, 1, 0, -1][dir];
        box(
          dx ? 0.38 : 0.25,
          0.11,
          dz ? 0.38 : 0.25,
          x + dx * 0.27,
          0.105,
          z + dz * 0.27,
          "#fff4d8",
        );
      });
    });
    box(0.5, 0.1, 0.6, -3.1, 0.25, 0, "#628947");
    box(0.5, 0.1, 0.6, 3.1, 0.25, 0, "#628947");
    const draw = () => {
      const w = host.clientWidth,
        h = host.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };
    const observer = new ResizeObserver(draw);
    observer.observe(host);
    draw();
    return () => {
      observer.disconnect();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [tiles, won]);
  return (
    <div
      ref={ref}
      className="bridge-scene"
      role="img"
      aria-label="积木桥梁三维预览"
    >
      {fallback && <p>此设备无法显示 3D 预览。下方二维桥面仍可正常游玩。</p>}
    </div>
  );
}
