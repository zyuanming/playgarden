## CAST N / BAMBOO / PARKING and shared original libraries

These are three independent complete endless games by ABA Games (2021), copied byte-for-byte from crisp-game-lib-games commit cfb39d2f988feb5918eb83697145b5a35adabf58. Each contributes zero finite levels.

Shared runtime: crisp-game-lib 1.0.2 (ABA Games 2019), sounds-some-sounds 2.0.0 (ABA Games 2022), ABA Games’ modified jsfx (Egon Elbre 2017), and embedded mml-iterator (Nao Yonamine). Their MIT texts, actual copyright records, and original jsfx modification notice are in public/crisp-original/LICENSES.txt. Preferred original sources, immutable URLs, version provenance and limits are listed in docs/crisp-runtime-source-addendum.json, docs/crisp-mml-source-addendum.json and vendor/crisp-original/source-manifest.json.

Playgarden Chinese shell, input/audio/lifecycle modifications, source transformation scripts and new vector cards are GPL-3.0-only. All original notices are retained. Original pixels and synthesized sound are preserved; no external art, fonts, samples, CDN, trackers or network services are used.

The audio adapter statically expands seven original fixed jsfx waveforms without runtime evaluation and supplies a single controlled AudioContext to both jsfx sample-rate selection and sounds-some-sounds. The engine adapter adds real pause, input release, restart and teardown. These adaptations do not alter original game rules.

Original games
============================================================
MIT License

Copyright (c) 2021 ABA Games

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


crisp-game-lib
============================================================
MIT License

Copyright (c) 2019 ABA Games

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


sounds-some-sounds
============================================================
MIT License

Copyright (c) 2022 ABA Games

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


jsfx
============================================================
The MIT License (MIT)

Copyright (c) 2017 Egon Elbre

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.



Modified jsfx attribution, verbatim from original source:
// original ver.: https://github.com/loov/jsfx
// The following variables and functions have been added by @abagames.
//  - export var jsfx
//  - Live._generate
//  - Prest. Synth Tone Click
//  - setRandomFunc
//  - webkitAudioContext

# Third-party notices for the selected three games

Keep the original notices in upstream/games/LICENSE.txt (ABA Games 2021), upstream/engine/LICENSE.txt (ABA Games 2019), upstream/audio/LICENSE.txt (ABA Games 2022), and third-party/jsfx/LICENSE-MIT (Egon Elbre 2017). Keep the modification attribution at the top of upstream/audio/lib/jsfx/index.js.

## mml-iterator 1.1.0

Source: https://github.com/mohayonao/mml-iterator/tree/7e76ab2734521eeb59a7ac4f94c2634502be1475

The pinned upstream package.json identifies the author as Nao Yonamine and the license as MIT; its README repeats MIT and links the author's MIT-license page. This pinned source tree does not include a standalone LICENSE file. The original declarations are preserved in third-party/mml-iterator/.

The license site's official hosting source was verified at https://github.com/remy/mit-license/tree/73ebb8ca1e2280883e92498e18fcdb1c633c226c . Its users/mohayonao.json explicitly identifies Nao Yonamine as the copyright holder; licenses/MIT.ejs supplies the complete MIT terms. Both are archived in third-party/mml-license-site/. The live subdomain was not accessible through the page retrieval tool, so the official template and holder record were read instead.

The following is the MIT permission text from that official template, formatted as plain text with its confirmed copyright holder. It is not represented as a standalone license file retrieved from mml-iterator, and no copyright year has been invented.

Copyright (c) Nao Yonamine

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Complete static comparison establishes exact mml-iterator 1.1.0 preferred editable-source correspondence for the shipped embedded parser, independently of the original ^1.1.0 dependency declaration. All module bodies, imports/exports and generated class scaffolding are accounted for in docs/crisp-mml-correspondence.json. Historical npm installation resolution remains unclaimed; runtime bytes and MIT notices are unchanged.
