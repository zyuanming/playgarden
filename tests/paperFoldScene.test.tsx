// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import PaperFoldScene from "../src/games/PaperFoldScene";
import { paperFoldLevels } from "../src/games/paperFoldLevels";
import { initialPaperBoard, paperStep } from "../src/games/paperFoldLogic";
const gpu = vi.hoisted(() => ({
  render: vi.fn(),
  rendererDispose: vi.fn(),
  geometryDispose: vi.fn(),
  materialDispose: vi.fn(),
  setSize: vi.fn(),
  observerDisconnect: vi.fn(),
  observerObserve: vi.fn(),
  groups: [] as { children: unknown[]; clear: () => void }[],
  canvases: [] as HTMLCanvasElement[],
  fail: false,
}));
vi.mock("three", () => {
  class Vector3 {
    x = 0;
    y = 0;
    z = 0;
    constructor(x = 0, y = 0, z = 0) {
      this.set(x, y, z);
    }
    set(x: number, y: number, z: number) {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    }
    copy(v: Vector3) {
      return this.set(v.x, v.y, v.z);
    }
    add(v: Vector3) {
      return this.set(this.x + v.x, this.y + v.y, this.z + v.z);
    }
  }
  class Group {
    children: unknown[] = [];
    constructor() {
      gpu.groups.push(this);
    }
    add(...objects: unknown[]) {
      this.children.push(...objects);
    }
    clear() {
      this.children = [];
    }
  }
  class Scene {
    background: unknown;
    add() {}
    clear() {}
  }
  class OrthographicCamera {
    position = new Vector3();
    left = 0;
    right = 0;
    top = 0;
    bottom = 0;
    lookAt() {}
    updateProjectionMatrix() {}
  }
  class Mesh {
    position = new Vector3();
    scale = new Vector3();
    constructor(
      public geometry: unknown,
      public material: unknown,
    ) {}
  }
  class WebGLRenderer {
    domElement: HTMLCanvasElement;
    render = gpu.render;
    dispose = gpu.rendererDispose;
    setSize = gpu.setSize;
    constructor() {
      if (gpu.fail) throw Error("Unavailable GPU");
      this.domElement = document.createElement("canvas");
      gpu.canvases.push(this.domElement);
    }
    setPixelRatio() {}
  }
  class BoxGeometry {
    dispose = gpu.geometryDispose;
  }
  class MeshStandardMaterial {
    dispose = gpu.materialDispose;
  }
  class DirectionalLight {
    position = new Vector3();
  }
  return {
    Vector3,
    Group,
    Scene,
    OrthographicCamera,
    Mesh,
    WebGLRenderer,
    BoxGeometry,
    MeshStandardMaterial,
    DirectionalLight,
    HemisphereLight: class {},
    Color: class {},
  };
});
beforeEach(() => {
  vi.clearAllMocks();
  gpu.groups.length = 0;
  gpu.canvases.length = 0;
  gpu.fail = false;
  vi.stubGlobal("WebGLRenderingContext", class {});
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = gpu.observerObserve;
      disconnect = gpu.observerDisconnect;
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("PaperFoldScene bounded mocked GPU lifecycle (not WebGL rendering)", () => {
  it("builds from actual stacks, cuts punched cells, pauses/backgrounds and releases resources", () => {
    const level = paperFoldLevels[0],
      start = initialPaperBoard(level),
      hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(false),
      v = render(<PaperFoldScene level={level} board={start} paused={false} />);
    expect(gpu.groups[0].children).toHaveLength(8);
    expect(gpu.render).toHaveBeenCalled();
    expect(gpu.observerObserve).toHaveBeenCalledTimes(1);
    const folded = paperStep(level, start, { kind: "fold", crease: "A" })!,
      punched = paperStep(level, folded, { kind: "punch", cell: 2 })!;
    v.rerender(<PaperFoldScene level={level} board={punched} paused={false} />);
    expect(gpu.groups[0].children).toHaveLength(14); // 6 intact original cells + 2 four-strip holes.
    const meshes = gpu.groups[0].children as {
      position: { x: number; y: number; z: number };
    }[];
    expect(meshes.some((m) => m.position.y > 0.05)).toBe(true);
    gpu.render.mockClear();
    v.rerender(<PaperFoldScene level={level} board={punched} paused />);
    fireEvent(window, new Event("resize"));
    fireEvent(document, new Event("visibilitychange"));
    expect(gpu.render).not.toHaveBeenCalled();
    v.rerender(<PaperFoldScene level={level} board={punched} paused={false} />);
    expect(gpu.render).toHaveBeenCalledTimes(1);
    hidden.mockReturnValue(true);
    gpu.render.mockClear();
    fireEvent(document, new Event("visibilitychange"));
    fireEvent(window, new Event("resize"));
    expect(gpu.render).not.toHaveBeenCalled();
    hidden.mockReturnValue(false);
    fireEvent(document, new Event("visibilitychange"));
    expect(gpu.render).toHaveBeenCalledTimes(1);
    const unfolded = paperStep(level, punched, { kind: "unfold" })!;
    v.rerender(
      <PaperFoldScene level={level} board={unfolded} paused={false} />,
    );
    expect(
      (gpu.groups[0].children as { position: { y: number } }[]).every(
        (m) => m.position.y === 0.05,
      ),
    ).toBe(true);
    const canvas = gpu.canvases[0];
    v.unmount();
    expect(canvas.isConnected).toBe(false);
    expect(gpu.rendererDispose).toHaveBeenCalledTimes(1);
    expect(gpu.geometryDispose).toHaveBeenCalledTimes(1);
    expect(gpu.materialDispose).toHaveBeenCalledTimes(7);
    expect(gpu.observerDisconnect).toHaveBeenCalledTimes(1);
    gpu.render.mockClear();
    fireEvent(window, new Event("resize"));
    fireEvent(document, new Event("visibilitychange"));
    expect(gpu.render).not.toHaveBeenCalled();
  });
  it("context loss reveals full fallback, prevents subsequent draw and still disposes", () => {
    const level = paperFoldLevels[0],
      board = initialPaperBoard(level),
      v = render(<PaperFoldScene level={level} board={board} paused={false} />),
      canvas = gpu.canvases[0],
      event = new Event("webglcontextlost", { cancelable: true });
    fireEvent(canvas, event);
    expect(event.defaultPrevented).toBe(true);
    expect(v.getByText("3D 预览不可用")).toBeTruthy();
    gpu.render.mockClear();
    fireEvent(window, new Event("resize"));
    v.rerender(
      <PaperFoldScene
        level={level}
        board={paperStep(level, board, { kind: "fold", crease: "A" })!}
        paused={false}
      />,
    );
    expect(gpu.render).not.toHaveBeenCalled();
    v.unmount();
    expect(gpu.rendererDispose).toHaveBeenCalledTimes(1);
    expect(gpu.geometryDispose).toHaveBeenCalledTimes(1);
    expect(gpu.materialDispose).toHaveBeenCalledTimes(7);
  });
  it("handles initialization failure without creating resources or observers", () => {
    gpu.fail = true;
    const level = paperFoldLevels[0],
      v = render(
        <PaperFoldScene
          level={level}
          board={initialPaperBoard(level)}
          paused={false}
        />,
      );
    expect(v.getByText("3D 预览不可用")).toBeTruthy();
    expect(gpu.groups).toHaveLength(0);
    expect(gpu.observerObserve).not.toHaveBeenCalled();
    v.unmount();
    expect(gpu.rendererDispose).not.toHaveBeenCalled();
  });
});
