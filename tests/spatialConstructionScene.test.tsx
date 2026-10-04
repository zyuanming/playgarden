// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as THREE from "three";
import SpatialConstructionScene, {
  type SpatialConstructionModel,
} from "../src/games/SpatialConstructionScene";
import { cubeNetCertificates } from "../src/games/cubeNetLogic";
const mocks = vi.hoisted(() => ({
  fail: false,
  renderers: [] as {
    domElement: HTMLCanvasElement;
    render: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
    forceContextLoss: ReturnType<typeof vi.fn>;
    renderLists: { dispose: ReturnType<typeof vi.fn> };
  }[],
}));
vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three")>();
  return {
    ...actual,
    WebGLRenderer: class {
      domElement = document.createElement("canvas");
      render = vi.fn();
      dispose = vi.fn();
      forceContextLoss = vi.fn();
      renderLists = { dispose: vi.fn() };
      setPixelRatio = vi.fn();
      setSize = vi.fn();
      constructor() {
        if (mocks.fail) throw new Error("WebGL unavailable");
        mocks.renderers.push(this);
      }
    },
  };
});
let geometryDispose: ReturnType<typeof vi.spyOn>,
  materialDispose: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  mocks.fail = false;
  mocks.renderers.length = 0;
  vi.stubGlobal("WebGLRenderingContext", class {});
  vi.stubGlobal("requestAnimationFrame", vi.fn());
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  geometryDispose = vi.spyOn(THREE.BufferGeometry.prototype, "dispose");
  materialDispose = vi.spyOn(THREE.Material.prototype, "dispose");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const voxel: SpatialConstructionModel = {
  kind: "voxel",
  size: 2,
  board: [1, 0, 0, 0, 0, 0, 0, 0],
};
describe("persistent procedural construction renderer lifecycle", () => {
  it("keeps one renderer and shared GPU resources across construction changes", () => {
    const view = render(
        <SpatialConstructionScene model={voxel} paused={false} />,
      ),
      renderer = mocks.renderers[0];
    expect(mocks.renderers).toHaveLength(1);
    expect(document.querySelectorAll("canvas")).toHaveLength(1);
    const scene = renderer.render.mock.calls.at(-1)![0] as THREE.Scene;
    const assembly = scene.children.find(
      (child) => child instanceof THREE.Group,
    )!;
    expect(assembly.children).toHaveLength(6); // floor, four cells, one actual voxel
    for (let i = 0; i < 20; i++)
      view.rerender(
        <SpatialConstructionScene
          model={{ ...voxel, board: [1, 1, i % 2, 0, 0, 0, 0, 0] }}
          paused={false}
        />,
      );
    expect(mocks.renderers).toHaveLength(1);
    expect(geometryDispose).not.toHaveBeenCalled();
    expect(materialDispose).not.toHaveBeenCalled();
    expect(assembly.children).toHaveLength(8);
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
    view.unmount();
    expect(geometryDispose).toHaveBeenCalledTimes(2);
    expect(materialDispose).toHaveBeenCalledTimes(9);
    expect(renderer.renderLists.dispose).toHaveBeenCalledTimes(1);
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    expect(renderer.forceContextLoss).toHaveBeenCalledTimes(1);
    expect(document.querySelector("canvas")).toBeNull();
  });
  it("renders the actual labeled paper arrangement and changes only its geometry on fold", () => {
    const board = [...cubeNetCertificates[0]],
      model: SpatialConstructionModel = {
        kind: "net",
        size: 5,
        board,
        folded: false,
      };
    const view = render(
        <SpatialConstructionScene model={model} paused={false} />,
      ),
      renderer = mocks.renderers[0],
      scene = renderer.render.mock.calls.at(-1)![0] as THREE.Scene;
    const assembly = scene.children.find(
      (child) => child instanceof THREE.Group,
    )!;
    expect(assembly.children).toHaveLength(28); // board, six paper faces, 21 face-ID pips
    const paper = assembly.children[1];
    const before = paper.position.clone();
    view.rerender(
      <SpatialConstructionScene
        model={{ ...model, folded: true }}
        paused={false}
      />,
    );
    expect(mocks.renderers).toHaveLength(1);
    expect(assembly.children[1].position.equals(before)).toBe(false);
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain(
      "90 度试折",
    );
    view.rerender(
      <SpatialConstructionScene
        model={{ ...model, board: [0, 1, 2, 20, 21, 22], folded: true }}
        paused={false}
      />,
    );
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain(
      "平铺预览",
    );
  });
  it("freezes drawing while paused/hidden, resumes, and never starts a motion loop", () => {
    const view = render(
        <SpatialConstructionScene model={voxel} paused={false} />,
      ),
      renderer = mocks.renderers[0];
    view.rerender(<SpatialConstructionScene model={voxel} paused />);
    const count = renderer.render.mock.calls.length;
    fireEvent(window, new Event("resize"));
    view.rerender(
      <SpatialConstructionScene
        model={{ ...voxel, board: Array(8).fill(1) }}
        paused
      />,
    );
    expect(renderer.render).toHaveBeenCalledTimes(count);
    view.rerender(<SpatialConstructionScene model={voxel} paused={false} />);
    expect(renderer.render.mock.calls.length).toBeGreaterThan(count);
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true),
      draws = renderer.render.mock.calls.length;
    fireEvent(document, new Event("visibilitychange"));
    fireEvent(window, new Event("resize"));
    expect(renderer.render).toHaveBeenCalledTimes(draws);
    hidden.mockReturnValue(false);
    fireEvent(document, new Event("visibilitychange"));
    expect(renderer.render.mock.calls.length).toBeGreaterThan(draws);
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });
  it("handles lost/restored contexts and removes all observer/listener work on unmount", () => {
    const disconnect = vi.fn(),
      observe = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe = observe;
        disconnect = disconnect;
      },
    );
    const view = render(
        <SpatialConstructionScene model={voxel} paused={false} />,
      ),
      renderer = mocks.renderers[0],
      lost = new Event("webglcontextlost", { cancelable: true });
    fireEvent(renderer.domElement, lost);
    expect(lost.defaultPrevented).toBe(true);
    expect(screen.getByText("平面操作照常可用")).toBeTruthy();
    const count = renderer.render.mock.calls.length;
    fireEvent(window, new Event("resize"));
    expect(renderer.render).toHaveBeenCalledTimes(count);
    fireEvent(renderer.domElement, new Event("webglcontextrestored"));
    expect(screen.queryByText("平面操作照常可用")).toBeNull();
    expect(renderer.render.mock.calls.length).toBeGreaterThan(count);
    view.unmount();
    expect(observe).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
    const finalCount = renderer.render.mock.calls.length;
    fireEvent(window, new Event("resize"));
    fireEvent(document, new Event("visibilitychange"));
    fireEvent(renderer.domElement, new Event("webglcontextrestored"));
    expect(renderer.render).toHaveBeenCalledTimes(finalCount);
  });
  it("StrictMode setup/cleanup pairs dispose every renderer exactly once", () => {
    const view = render(
      <StrictMode>
        <SpatialConstructionScene model={voxel} paused={false} />
      </StrictMode>,
    );
    expect(mocks.renderers).toHaveLength(2);
    expect(mocks.renderers[0].dispose).toHaveBeenCalledTimes(1);
    expect(mocks.renderers[1].dispose).not.toHaveBeenCalled();
    expect(document.querySelectorAll("canvas")).toHaveLength(1);
    view.unmount();
    expect(mocks.renderers[1].dispose).toHaveBeenCalledTimes(1);
    expect(geometryDispose).toHaveBeenCalledTimes(4);
    expect(materialDispose).toHaveBeenCalledTimes(18);
  });
  it("returns an accessible fallback after WebGL construction failure", () => {
    mocks.fail = true;
    render(<SpatialConstructionScene model={voxel} paused={false} />);
    expect(screen.getByText("平面操作照常可用")).toBeTruthy();
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain(
      "1 个方块",
    );
    expect(document.querySelector("canvas")).toBeNull();
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });
});
