# 草地推杆

Original GPL-3.0-only eight-course top-down putting game, physics rules, layouts, interface and SVG art. No imported physics engine or external assets.

The player chooses an angle (0° right, positive clockwise) and power from 15 to100. Initial speed is four times power; constant ground deceleration is90 world units per second squared. Side-wall and inflated rectangular-obstacle contacts reflect the relevant velocity component with factor0.88. A radius6 ball is captured when its center comes within12 units of the hole center. This is explicitly a simplified flat model, not real golf coaching or a probability simulation.

A shot is computed using fixed1/60-second integration, then its actual trajectory is animated. Completion is determined by the geometric hole-capture condition, not the end of an animation or a stored solution. Pause freezes the current trajectory index. Undo can cancel an active shot and restores the entire pre-shot position. Reset clears stroke history. Hints perform a bounded coarse angle/power search, disclose when they only found an approximate approach, set suggested controls and never fire the shot. Unlimited strokes are permitted; par is informational only.

The single final E2E fires real first/final shots through numeric controls and mouse/touch buttons, exercises mid-roll pause and undo, asserts physical hole coordinates, checks terminal locks, errors, screenshots and overflow. No unit or campaign sweep is run.
