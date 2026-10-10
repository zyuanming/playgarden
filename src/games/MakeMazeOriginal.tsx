// SPDX-License-Identifier: GPL-3.0-only
import type { GameProps } from "../lib/types";
import CrispOriginalFrame from "./CrispOriginalFrame";
export default function MakeMazeOriginal(props: GameProps) { return <CrispOriginalFrame {...props} game="makemaze" />; }
