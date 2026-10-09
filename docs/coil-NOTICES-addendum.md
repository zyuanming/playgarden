## Coil — original endless drawing game

Source: Hakim El Hattab, Coil, Copyright (C) 2011.
Fixed source: https://github.com/leereilly/Coil/tree/ea6fd3afae10a6d8a53b07e82be4211619206ede
Original preferred editable source: vendor/coil-original/upstream/js/coil.js and js/util.js.
Locally adapted runtime: public/coil-original/coil.js and geometry.js.
Reproducible changes: scripts/coil/prepare-adaptation.py and native-adapter-fragment.js.

Original core code, geometry, and procedural drawing: MIT, full text below.
Playgarden changes, Chinese UI, CSS, native input/lifecycle/storage, React wrapper,
targeted E2E, and newly authored public/coil-original-art.svg: GPL-3.0-only.
No license is asserted for upstream background.jpg, texture.png, or favicon.ico:
all three are excluded. No upstream fonts or audio are distributed.
The historical jQuery 1.6.2 file is kept only in the vendor source snapshot,
not loaded or distributed as a runtime dependency. Its complete MIT license is
vendor/coil-original/jquery-MIT-LICENSE.txt; the original file also retains its notice.
Original HTML/CSS remain non-public audit sources; third-party social/font URLs are removed from runtime.

Copyright (C) 2011 Hakim El Hattab, http://hakim.se

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.