import type { GameProps } from "../lib/types";
import IslandEliminationBoard from "./IslandEliminationBoard";
export default function HitoriGarden(props: GameProps) {
  return <IslandEliminationBoard {...props} game="hitori" />;
}
