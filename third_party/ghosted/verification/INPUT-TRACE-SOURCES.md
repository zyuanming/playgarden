# Ghosted input trace sources

Original commit: `846454c3b2f7509515cbcbf8852b09f7b7d98b24`.

Original `src/leveldata.ts` SHA-256: `155d78d27fc1e420e069af9ca3fcf0bb23215f7500ce98214b69e312ca8ee4ce`.

These are static candidate input plans only. They have not been executed against the game. R/U/L/D mean one short press of the corresponding direction, released before its move completes; then wait for settled observable state. Coordinates in the fixture include the one-tile boundary added by the original Tilemap constructor.

Source rules inspected: `original/src/gameobject.ts`, `puzzlestate.ts`, `game.ts`, `tilemap.ts`, `levelmenu.ts`, `titlescreen.ts`, `controlguide.ts`, `ending.ts`, `menu.ts`, `main.ts`, `progress.ts`.

Tile legend: 0 floor; 1 wall; 2 player; 3 boulder; 4 hole; 5 collapsing tile; 6 slime; 7 coin; 8 apple; 9/10 pink button unpressed/pressed; B/C closed/open gate; D/E/F/G right/up/left/down conveyor; H/I blue button unpressed/pressed. Only 9/B–I are mixed base-32 symbols; there are no new maps.

## Original level 1

Candidate: `DUDDRRRRUUURUDLDDRDLLLLLUUUU` (28 directional inputs).

Planning stopped at first candidate after 1,693 expanded states / 0.037 seconds. Runtime verification pending.

Original packed literal: `65700107400300240131011107030040`.

```text
7 0 0 1 0 7
4 0 0 3 0 0
2 4 0 1 3 1
0 1 1 1 0 7
0 3 0 0 4 0
```

## Original level 2

Candidate: `LLULDDDLDRRRDRULLLUUURRDRUULLLL` (31 directional inputs).

Planning stopped at first candidate after 16,969 expanded states / 0.366 seconds. Runtime verification pending.

Original packed literal: `56700001030200107551113040000107`.

```text
7 0 0 0 0
1 0 3 0 2
0 0 1 0 7
5 5 1 1 1
3 0 4 0 0
0 0 1 0 7
```

## Original level 3

Candidate: `RDDDDRRULLLLLDRUULURDRRDRDRUUUU` (31 directional inputs).

Planning stopped at first candidate after 80,963 expanded states / 1.866 seconds. Runtime verification pending.

Original packed literal: `65012617706600045010664636701007`.

```text
0 1 2 6 1 7
7 0 6 6 0 0
0 4 5 0 1 0
6 6 4 6 3 6
7 0 1 0 0 7
```

## Original level 4

Candidate: `RRDRDRDDLLLULURDDRRRRLRLLLLUURRRRUU` (35 directional inputs).

Planning stopped at first candidate after 2,323 expanded states / 0.052 seconds. Runtime verification pending.

Original packed literal: `65200167113036700604061101060608`.

```text
2 0 0 1 6 7
1 1 3 0 3 6
7 0 0 6 0 4
0 6 1 1 0 1
0 6 0 6 0 8
```

## Original level 5

Candidate: `LUULLDDLUUURRLDDDLUUUUURRRLRDDDDDRRUUUUU` (40 directional inputs).

Planning stopped at first candidate after 9,024 expanded states / 0.244 seconds. Runtime verification pending.

Original packed literal: `66783417411030630415406016361615700320`.

```text
7 8 3 4 1 7
4 1 1 0 3 0
6 3 0 4 1 5
4 0 6 0 1 6
3 6 1 6 1 5
7 0 0 3 2 0
```

## Original level 6

Candidate: `DUDDDLLUURRUUUDDDDDLLLLUUUUU` (28 directional inputs).

Planning stopped at first candidate after 3,607 expanded states / 0.086 seconds. Runtime verification pending.

Original packed literal: `567430701B3B0161200000B09107B067`.

```text
7 4 3 0 7
0 1 B 3 B
0 1 6 1 2
0 0 0 0 0
B 0 9 1 0
7 B 0 6 7
```

## Original level 7

Candidate: `LLLDDLDRRURURRDDULUUULDDDLLDLURUULU` (35 directional inputs).

Planning stopped at first candidate after 72,238 expanded states / 1.726 seconds. Runtime verification pending.

Original packed literal: `6571CB7C40C02013C0900560BB70C4B7`.

```text
7 1 C B 7 C
4 0 C 0 2 0
1 3 C 0 9 0
0 5 6 0 B B
7 0 C 4 B 7
```

## Original level 8

Candidate: `RRLRLLULLUUURLDDDRRDRR` (22 directional inputs).

Planning stopped at first candidate after 3,100 expanded states / 0.059 seconds. Runtime verification pending.

Original packed literal: `750007008BB6BBBB03C1090CC0051195002C7`.

```text
0 0 0 7 0 0 8
B B 6 B B B B
0 3 C 1 0 9 0
C C 0 0 5 1 1
9 5 0 0 2 C 7
```

## Original level 9

Candidate: `RRURLRLLURRDDUULLLDDRDDRR` (25 directional inputs).

Planning stopped at first candidate after 3,259 expanded states / 0.081 seconds. Runtime verification pending.

Original packed literal: `660DDD57E1BB35E17B39E11G11CFFF6720DD06`.

```text
0 D D D 5 7
E 1 B B 3 5
E 1 7 B 3 9
E 1 1 G 1 1
C F F F 6 7
2 0 D D 0 6
```

## Original level 10

Candidate: `LLLULUUURDLUURRDRRDDRLULLULDDDDRRRLLLLLRUUURRRURU` (49 directional inputs).

Planning stopped at first candidate after 432,797 expanded states / 10.673 seconds. Runtime verification pending.

Original packed literal: `667001B7CCC55B0303010F11081001117D2D49`.

```text
7 0 0 1 B 7
C C C 5 5 B
0 3 0 3 0 1
0 F 1 1 0 8
1 0 0 1 1 1
7 D 2 D 4 9
```

## Original level 11

Candidate: `RRUUURDLDLRRDULLULUUULLRRDDDDD` (30 directional inputs).

Planning stopped at first candidate after 196,676 expanded states / 4.12 seconds. Runtime verification pending.

Original packed literal: `667BDD0HBBFF5D00E01110E0F50660F5267619`.

```text
7 B D D 0 H
B B F F 5 D
0 0 E 0 1 1
1 0 E 0 F 5
0 6 6 0 F 5
2 6 7 6 1 9
```

## Original level 12

Candidate: `UURULLDDDDRRLLUUUURRURRRDDRRLDDRRRLLLLUURRRR` (44 directional inputs).

Planning stopped at first candidate after 121,353 expanded states / 2.793 seconds. Runtime verification pending.

Original packed literal: `76H18005H00F5FF0011EGBB5100FB7E1011117324DD9`.

```text
H 1 8 0 0 5 H
0 0 F 5 F F 0
0 1 1 E G B B
5 1 0 0 F B 7
E 1 0 1 1 1 1
7 3 2 4 D D 9
```

## Original level 13

Candidate: `DLUULULDRLRRDDLRRLDRURDLLULLDL` (30 directional inputs).

Planning stopped at first candidate after 123,520 expanded states / 3.725 seconds. Runtime verification pending.

Original packed literal: `86BHB8B8195B50BB16158EGGGG0E11020361C3D037917C3D60`.

```text
B H B 8 B 8 1 9
5 B 5 0 B B 1 6
1 5 8 E G G G G
0 E 1 1 0 2 0 3
6 1 C 3 D 0 3 7
9 1 7 C 3 D 6 0
```
