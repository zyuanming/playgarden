import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  skylineLine,
  visibleBuildings,
  type SkylineLevel,
  type SkylineSide,
} from "./skylineLogic";
const sideNames: Record<SkylineSide, string> = {
  top: "上",
  right: "右",
  bottom: "下",
  left: "左",
};
/** Optional procedural city; no animation loop, external assets, or board dependency on WebGL. */
export default function SkylineScene({
  level,
  values,
  side,
  index,
  paused,
}: {
  level: SkylineLevel;
  values: number[];
  side: SkylineSide;
  index: number;
  paused: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);
  const updateScene = useRef<
    ((values: number[], side: SkylineSide, index: number) => void) | null
  >(null);
  const line = skylineLine(level, values, side, index),
    complete = line.every(Boolean);
  let highest = 0;
  const visible = line.map((value) => {
    const seen = value > highest;
    highest = Math.max(highest, value);
    return seen;
  });
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
    setFallback(false);
    let lost = false;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#e9efdf");
    const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 100);
    const n = level.size,
      shift = (n - 1) / 2;
    const views: Record<SkylineSide, [number, number, number]> = {
      top: [n * 0.8, n * 1.35, -n * 1.8],
      right: [n * 1.8, n * 1.35, n * 0.8],
      bottom: [-n * 0.8, n * 1.35, n * 1.8],
      left: [-n * 1.8, n * 1.35, -n * 0.8],
    };
    camera.position.set(...views[side]);
    camera.lookAt(0, 0.6, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x436050, 3));
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(-4, 9, 5);
    scene.add(sun);
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const materials = [
      new THREE.MeshStandardMaterial({ color: "#b5c7ab", roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ color: "#103c30", roughness: 0.8 }),
      new THREE.MeshStandardMaterial({ color: "#dafa3b", roughness: 0.8 }),
      new THREE.MeshStandardMaterial({ color: "#f8fbf0", roughness: 0.8 }),
    ];
    const buildings = new THREE.Group();
    scene.add(buildings);
    const addBox = (
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      material: number,
    ) => {
      const mesh = new THREE.Mesh(geometry, materials[material]);
      mesh.position.set(x, y, z);
      mesh.scale.set(w, h, d);
      buildings.add(mesh);
    };
    const draw = () => {
      if (lost) return;
      const width = Math.max(1, container.clientWidth),
        height = Math.max(1, container.clientHeight);
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };
    updateScene.current = (nextValues, nextSide, nextIndex) => {
      buildings.clear();
      camera.position.set(...views[nextSide]);
      camera.lookAt(0, 0.6, 0);
      addBox(0, -0.13, 0, n + 0.45, 0.2, n + 0.45, 0);
      nextValues.forEach((height, i) => {
        const r = Math.floor(i / n),
          c = i % n,
          x = c - shift,
          z = r - shift;
        const selected =
          nextSide === "left" || nextSide === "right"
            ? r === nextIndex
            : c === nextIndex;
        addBox(x, -0.005, z, 0.85, 0.07, 0.85, selected ? 2 : 3);
        if (!height) return;
        const h = height * 0.5;
        addBox(x, h / 2 + 0.06, z, 0.61, h, 0.61, selected ? 1 : 0);
        addBox(x, h + 0.085, z, 0.65, 0.07, 0.65, selected ? 2 : 3);
        for (let floor = 1; floor < height; floor++)
          addBox(x, floor * 0.5 + 0.08, z, 0.625, 0.025, 0.625, 3);
      });
      draw();
    };
    updateScene.current(values, side, index);
    const onLost = (event: Event) => {
      event.preventDefault();
      lost = true;
      renderer.domElement.style.display = "none";
      setFallback(true);
    };
    renderer.domElement.addEventListener("webglcontextlost", onLost);
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(draw) : null;
    observer?.observe(container);
    window.addEventListener("resize", draw);
    draw();
    return () => {
      updateScene.current = null;
      observer?.disconnect();
      window.removeEventListener("resize", draw);
      renderer.domElement.removeEventListener("webglcontextlost", onLost);
      scene.clear();
      geometry.dispose();
      materials.forEach((material) => material.dispose());
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [level.size]);
  useEffect(() => {
    updateScene.current?.(values, side, index);
  }, [values, side, index]);
  return (
    <figure className={`nc-city-preview ${paused ? "nc-preview-paused" : ""}`}>
      <div
        className="nc-city-canvas"
        ref={host}
        role="img"
        aria-label={`从${sideNames[side]}侧观察城市，第 ${index + 1} ${side === "top" || side === "bottom" ? "列" : "行"}高亮`}
      >
        {fallback && (
          <p className="nc-city-fallback">
            平面城市预览
            <br />
            <small>本设备未启用 3D，棋盘可照常游玩。</small>
          </p>
        )}
      </div>
      <figcaption>
        从{sideNames[side]}往里看 · 第 {index + 1}{" "}
        {side === "top" || side === "bottom" ? "列" : "行"}
      </figcaption>
      <ol className="nc-street" aria-label="按视线方向排列的楼高">
        {line.map((height, i) => (
          <li
            key={i}
            className={complete && visible[i] ? "nc-visible-building" : ""}
            aria-label={`${i + 1} 号位置，${height ? `${height} 层${complete ? (visible[i] ? "，可见" : "，被遮挡") : ""}` : "未填写"}`}
          >
            <span style={{ height: `${height * 13 + 6}px` }}>
              {height || "·"}
            </span>
          </li>
        ))}
      </ol>
      <p className="nc-view-caption">
        {complete
          ? `能看见 ${visibleBuildings(line)} 栋。较高的楼会挡住后方较矮的楼。`
          : "填满这条街后，可以检查能看见几栋。空格还会改变视野。"}
      </p>
    </figure>
  );
}
