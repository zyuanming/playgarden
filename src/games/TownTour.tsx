import type { GameProps } from "../lib/types";
import RouteOptimizationRound from "./RouteOptimizationRound";
import { townTourLevels } from "./routeOptimizationLevels";

export default function TownTour(props: GameProps) {
  return (
    <RouteOptimizationRound
      key={`tour:${props.level}:${props.resetToken}`}
      {...props}
      config={townTourLevels[props.level] ?? townTourLevels[0]}
    />
  );
}
