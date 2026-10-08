# 花田快拍

Original GPL-3.0-only visual reaction game. All code, the 12 authored schedules,
Chinese text and SVG graphics are original Playgarden contributions. No
third-party game code, image, dictionary or dependency is included.

Flowers and ladybirds appear in nine holes on a deterministic schedule. Tap each
flower once before it leaves. Do not tap ladybirds. Missing a flower or disturbing
a ladybird counts as one mistake; empty/repeated taps do not score or penalize.
At the end of the schedule, the goal must be met within the mistake allowance.
Unlimited retries and a 75% leisurely speed support comfortable phone play.

The 12 short teaching schedules vary positions, visitor types, overlap and
reaction windows; they are not rotated copies or random seeds presented as levels.
Counts are actual finite authored rounds, not a claimed 100-level campaign.

Tap buttons or use keys 1–9. The shell pause and local pause freeze simulation;
hidden tabs, window blur and long frame gaps safely stop the round. Resume is
explicit after returning. Time updates are capped, animation is cancelled on
unmount and repeated collection of one visitor is rejected. Per-level saves are
small versioned snapshots, checked for stage, time bounds, unique visitor indices,
visitor type and appearance time. In-progress rounds restore paused; completed or
failed rounds restart. There is no account, network, timer penalty outside a round,
or leaderboard. Completion remains in the shared local progress record.

The final scoped E2E is `e2e/bloom-tap.spec.ts`: actual timed flower collection,
repeat safety, paused return, completed round, ladybird mistake/retry and one final
stage preview, with desktop and touch controls. No unit suite, solver sweep or
all-campaign proof is part of this release.
