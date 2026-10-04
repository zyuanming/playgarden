import type { GameProps } from "../lib/types";
import RouteOptimizationRound from "./RouteOptimizationRound";
import { postmanRoutesLevels } from "./routeOptimizationLevels";

export default function PostmanRoutes(props: GameProps) {
  return (
    <RouteOptimizationRound
      key={`postman:${props.level}:${props.resetToken}`}
      {...props}
      config={postmanRoutesLevels[props.level] ?? postmanRoutesLevels[0]}
    />
  );
}
