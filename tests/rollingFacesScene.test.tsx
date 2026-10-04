// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
const mock = vi.hoisted(() => ({
  renderers: [] as any[],
  geometries: [] as any[],
  materials: [] as any[],
  textures: [] as any[],
  meshes: [] as any[],
  matrices: [] as any[],
  fail: false,
}));
vi.mock("three", () => {
  class Vector3 {
    constructor(
      public x = 0,
      public y = 0,
      public z = 0,
    ) {}
    copy(v: Vector3) {
      this.x = v.x;
      this.y = v.y;
      this.z = v.z;
      return this;
    }
    add(v: Vector3) {
      this.x += v.x;
      this.y += v.y;
      this.z += v.z;
      return this;
    }
    set = vi.fn();
  }
  class WebGLRenderer {
    domElement = document.createElement("canvas");
    render = vi.fn();
    setSize = vi.fn();
    setPixelRatio = vi.fn();
    dispose = vi.fn();
    constructor() {
      if (mock.fail) throw Error("WebGL unavailable");
      mock.renderers.push(this);
    }
  }
  class Scene {
    add = vi.fn();
    clear = vi.fn();
    background: unknown;
  }
  class Mesh {
    position = new Vector3();
    scale = new Vector3();
    setRotationFromMatrix = vi.fn();
    constructor(
      public geometry: any,
      public material: any,
    ) {
      mock.meshes.push(this);
    }
  }
  class BoxGeometry {
    dispose = vi.fn();
    constructor() {
      mock.geometries.push(this);
    }
  }
  class MeshStandardMaterial {
    dispose = vi.fn();
    constructor(public options: any) {
      mock.materials.push(this);
    }
  }
  class CanvasTexture {
    dispose = vi.fn();
    constructor() {
      mock.textures.push(this);
    }
  }
  class Matrix4 {
    makeBasis = vi.fn((...basis: Vector3[]) => {
      mock.matrices.push(basis);
      return this;
    });
  }
  class OrthographicCamera {
    position = new Vector3();
    lookAt = vi.fn();
    updateProjectionMatrix = vi.fn();
    left = 0;
    right = 0;
    top = 0;
    bottom = 0;
  }
  class DirectionalLight {
    position = new Vector3();
  }
  return {
    Vector3,
    WebGLRenderer,
    Scene,
    Mesh,
    BoxGeometry,
    MeshStandardMaterial,
    CanvasTexture,
    Matrix4,
    OrthographicCamera,
    DirectionalLight,
    HemisphereLight: class {},
    Color: class {},
  };
});
import RollingFacesScene from "../src/games/RollingFacesScene";
import { rollingFacesLevels } from "../src/games/rollingFacesLevels";
import { initialRollBoard, rollStep } from "../src/games/rollingFacesLogic";
beforeEach(() => {
  for (const key of [
    "renderers",
    "geometries",
    "materials",
    "textures",
    "meshes",
    "matrices",
  ] as const)
    mock[key].length = 0;
  mock.fail = false;
  vi.stubGlobal("WebGLRenderingContext", class {});
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("RollingFaces scene-owned resources and world orientation", () => {
  it("uses the real board position and rotation basis, never a decorative animation", () => {
    const level = rollingFacesLevels[0],
      start = initialRollBoard(level),
      v = render(
        <RollingFacesScene level={level} board={start} paused={false} />,
      );
    const renderer = mock.renderers[0],
      cube = mock.meshes[0];
    expect(cube.position.set).toHaveBeenLastCalledWith(0, 0.39, 0);
    const moved = rollStep(level, start, "E")!;
    v.rerender(
      <RollingFacesScene level={level} board={moved} paused={false} />,
    );
    expect(cube.position.set).toHaveBeenLastCalledWith(1, 0.39, 0);
    const basis = mock.matrices.at(-1).map((v: any) => [v.x, v.y, v.z]);
    expect(basis).toEqual([
      [0, -1, 0],
      [1, 0, 0],
      [0, 0, 1],
    ]);
    expect(renderer.render).toHaveBeenCalled();
    expect(mock.renderers).toHaveLength(1);
    expect(mock.textures).toHaveLength(6);
    expect(
      v.container.querySelector("canvas")?.getAttribute("aria-hidden"),
    ).toBe("true");
  });
  it("freezes drawing during pause, resumes on demand and removes all listeners/resources", () => {
    const observer = { observe: vi.fn(), disconnect: vi.fn() };
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe = observer.observe;
        disconnect = observer.disconnect;
      },
    );
    const removeWindow = vi.spyOn(window, "removeEventListener"),
      removeDoc = vi.spyOn(document, "removeEventListener");
    const level = rollingFacesLevels[0],
      start = initialRollBoard(level),
      v = render(
        <RollingFacesScene level={level} board={start} paused={false} />,
      );
    const renderer = mock.renderers[0],
      before = renderer.render.mock.calls.length;
    v.rerender(<RollingFacesScene level={level} board={start} paused />);
    fireEvent(window, new Event("resize"));
    expect(renderer.render.mock.calls.length).toBe(before);
    v.rerender(
      <RollingFacesScene level={level} board={start} paused={false} />,
    );
    expect(renderer.render.mock.calls.length).toBeGreaterThan(before);
    v.unmount();
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
    expect(removeWindow).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(removeDoc).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function),
    );
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    for (const resource of [
      ...mock.materials,
      ...mock.geometries,
      ...mock.textures,
    ])
      expect(resource.dispose).toHaveBeenCalledTimes(1);
    const count = renderer.render.mock.calls.length;
    fireEvent(window, new Event("resize"));
    expect(renderer.render.mock.calls.length).toBe(count);
    expect(renderer.domElement.isConnected).toBe(false);
  });
  it("falls back after renderer failure or lost context and remains cleanup-safe in StrictMode", () => {
    const level = rollingFacesLevels[0],
      board = initialRollBoard(level);
    mock.fail = true;
    const failed = render(
      <RollingFacesScene level={level} board={board} paused={false} />,
    );
    expect(failed.getByText("六面地图仍然完整")).toBeTruthy();
    failed.unmount();
    mock.fail = false;
    const view = render(
      <StrictMode>
        <RollingFacesScene level={level} board={board} paused={false} />
      </StrictMode>,
    );
    expect(mock.renderers).toHaveLength(2);
    expect(mock.renderers[0].dispose).toHaveBeenCalledTimes(1);
    const renderer = mock.renderers[1],
      event = new Event("webglcontextlost", { cancelable: true });
    fireEvent(renderer.domElement, event);
    expect(event.defaultPrevented).toBe(true);
    expect(view.getByText("六面地图仍然完整")).toBeTruthy();
    const count = renderer.render.mock.calls.length;
    fireEvent(window, new Event("resize"));
    expect(renderer.render.mock.calls.length).toBe(count);
    view.unmount();
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
  });
});
