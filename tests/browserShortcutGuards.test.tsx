import ArithmeticCageGarden from "../src/games/ArithmeticCageGarden";
import KakuroGarden from "../src/games/KakuroGarden";
import FutoshikiGarden from "../src/games/FutoshikiGarden";
import SkylineGarden from "../src/games/SkylineGarden";
import ShapeMosaic from "../src/games/ShapeMosaic";
import MapColors from "../src/games/MapColors";
import SudokuGarden from "../src/games/SudokuGarden";
import { GameShell } from "../src/components/GameShell";
// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, fireEvent, act } from "@testing-library/react";
import MergeGarden from "../src/games/MergeGarden";
import CubeNetWorkshop from "../src/games/CubeNetWorkshop";
import UntangleGarden from "../src/games/UntangleGarden";
import TrafficEscape from "../src/games/TrafficEscape";
import WordSearchGarden from "../src/games/WordSearchGarden";
import HashiGarden from "../src/games/HashiGarden";
import MinimumNetwork from "../src/games/MinimumNetwork";
import OneStrokeGarden from "../src/games/OneStrokeGarden";
import TownTour from "../src/games/TownTour";
import PostmanRoutes from "../src/games/PostmanRoutes";
import SlidingTiles from "../src/games/SlidingTiles";
import VoxelViews from "../src/games/VoxelViews";
import SlitherlinkGarden from "../src/games/SlitherlinkGarden";
afterEach(cleanup);
const cases = [
  ["ArithmeticCageGarden", ArithmeticCageGarden, "[data-arithmetic-cell]"],
  ["KakuroGarden", KakuroGarden, "[data-arithmetic-cell]"],
  ["FutoshikiGarden", FutoshikiGarden, "[data-constraint-cell]"],
  ["SkylineGarden", SkylineGarden, "[data-constraint-cell]"],
  ["ShapeMosaic", ShapeMosaic, "[data-mosaic-cell]"],
  ["MapColors", MapColors, "[data-node]"],
  ["SudokuGarden", SudokuGarden, "[data-cell]"],
  ["merge", MergeGarden, ".merge-board"],
  ["cube-net", CubeNetWorkshop, "[data-net-cell]"],
  ["untangle", UntangleGarden, "[data-garden-spot]"],
  ["traffic", TrafficEscape, "[data-vehicle]"],
  ["word-search", WordSearchGarden, "[data-cell]"],
  ["hashi", HashiGarden, "[data-hashi-island]"],
  ["minimum-network", MinimumNetwork, "[data-network-edge]"],
  ["one-stroke", OneStrokeGarden, "[data-node]"],
  ["town-tour", TownTour, "[data-route-road]"],
  ["postman", PostmanRoutes, "[data-route-road]"],
  ["slide", SlidingTiles, "[data-tile]"],
  ["voxel", VoxelViews, "[data-voxel-cell]"],
  ["slitherlink", SlitherlinkGarden, "[data-slitherlink-edge]"],
] as const;
describe("browser shortcut isolation", () => {
  it.each(cases)(
    "%s leaves modified browser commands untouched",
    (_id, Component, selector) => {
      const props = {
        level: 0,
        paused: false,
        resetToken: 0,
        hintToken: 0,
        undoToken: 0,
        onComplete: vi.fn(),
        onStatus: vi.fn(),
      };
      const view = render(<Component {...props} />),
        target = view.container.querySelector(`${selector}:not(:disabled)`)!;
      expect(target).not.toBeNull();
      if (_id === "MapColors") {
        fireEvent.click(target);
        expect(target.getAttribute("data-painted")).toBe("0");
      }
      act(() => (target as HTMLElement).focus());
      expect(document.activeElement).toBe(target);
      const focusBefore = document.activeElement;
      const before = view.container.innerHTML;
      for (const modifier of ["ctrlKey", "metaKey", "altKey"])
        for (const key of [
          "w",
          "s",
          "a",
          "ArrowLeft",
          "ArrowRight",
          "Home",
          "End",
          "Delete",
          "Backspace",
          "PageUp",
          "PageDown",
        ]) {
          const event = new KeyboardEvent("keydown", {
            key,
            [modifier]: true,
            bubbles: true,
            cancelable: true,
          });
          fireEvent(target, event);
          expect(event.defaultPrevented).toBe(false);
          expect(document.activeElement).toBe(focusBefore);
          expect(view.container.innerHTML).toBe(before);
        }
      expect(props.onComplete).not.toHaveBeenCalled();
    },
  );
});

it("shell preserves modified Escape and still supports plain pause", () => {
  const view = render(
    <GameShell
      id="slide"
      onBack={vi.fn()}
      onComplete={vi.fn()}
      completed={[]}
    />,
  );
  for (const modifier of ["ctrlKey", "metaKey", "altKey"]) {
    fireEvent.keyDown(window, { key: "Escape", [modifier]: true });
    expect(view.getByRole("button", { name: "暂停" })).toBeTruthy();
  }
  fireEvent.keyDown(window, { key: "Escape" });
  expect(view.getByRole("button", { name: "继续" })).toBeTruthy();
  fireEvent.keyDown(window, { key: "Escape" });
  expect(view.getByRole("button", { name: "暂停" })).toBeTruthy();
});
