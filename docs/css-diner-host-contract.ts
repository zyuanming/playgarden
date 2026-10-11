// SPDX-License-Identifier: GPL-3.0-only
// Snapshot of the existing Playgarden GameProps contract, included for source readers.
// Integration imports the real ../lib/types; this file is not a shared-file replacement.
export type GameProps = {
  level: number;
  freePlay?: boolean;
  paused: boolean;
  muted?: boolean;
  resetToken: number;
  freshStart?: boolean;
  hintToken: number;
  undoToken: number;
  onComplete: () => void;
  onLevelChange?: (level: number) => void;
  onStatus: (text: string) => void;
};
