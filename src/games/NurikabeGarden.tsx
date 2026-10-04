import type { GameProps } from "../lib/types";
import IslandEliminationBoard from "./IslandEliminationBoard";
export default function NurikabeGarden(props: GameProps) {
  return <IslandEliminationBoard {...props} game="nurikabe" />;
}
