# Exact editable-source correspondence for embedded mml-iterator

Date: 2026-10-09. This evidence-only addendum changes no game, audio, engine, or source file from the frozen three-game package.

## Result

Every embedded mml module in the pinned original sounds-some-sounds 2.0.0 audio bundle maps to the six archived official mml-iterator 1.1.0 source files at commit `7e76ab2734521eeb59a7ac4f94c2634502be1475`:

- Syntax.js: all syntax names and values.
- DefaultParams.js: every default tempo, octave, length, velocity, quantize and loop-count value.
- Scanner.js: constructor and all 8 methods.
- MMLParser.js: constructor, NOTE_INDEXES, its imports, and all 21 methods.
- MMLIterator.js: constructor, ITERATOR constant, imports, all 18 methods, arrayToIterator and isNoteEvent.
- index.js: exact constructor re-export, including the bundle's MMLIterator → MMLIterator_1 → lib wiring.

All 24 top-level statements in the embedded block are accounted for. There are 65 successful exact canonical-AST comparisons: 47 methods, 3 constructor parameter/body pairs, 2 constant objects, 2 local constants, 2 free helpers and 6 generated class-helper copies. Descriptor keys and complete method order are checked separately. Three identical copies of the generated class descriptor/constructor scaffolding are compared to the explicit editable template in scripts/crisp/class-scaffolding.js.

The shipped audio's entire mml block is additionally byte-identical to the pinned original audio's block. The runtime itself was not changed to obtain this result.

The complete report, including every source/bundle line range and canonical hash, is docs/crisp-mml-correspondence.json. The source provenance remains the fixed official GitHub commit, not the dependency range in an npm manifest.

## Reproduction

After copying this addendum alongside the frozen package's integration files, run:

`node scripts/crisp/prove-mml-correspondence.mjs`

It reads the six archived source files, the original audio bundle, the shipped audio bundle, their existing provenance manifests, and the checked helper template. It parses them with the already-installed TypeScript parser and writes docs/crisp-mml-correspondence.json. It never imports, evaluates or executes the library code; it performs no network access or installs. Optional first and second positional arguments select a repository root and report output path for isolated review.

The script verifies the pinned original audio hash and each official source file's byte length, SHA-256 and Git blob SHA-1 before comparing. Unexpected class members, extra constructor parameters, altered imports, missing/extra methods, unaccounted top-level statements, unsupported wiring, differing bodies, or unresolved lexical-this captures fail the check.

## Exact transform correspondence

Only the following finite syntactic transformations are normalized:

1. Whitespace, comments and grouping parentheses.
2. const/let declarations lowered to var, preserving declaration order, initializer AST, reference names and enclosing statement structure. In these modules, loop variables are not captured by callbacks and block-local lowered variables do not escape or shadow another binding in a way that changes the used parser API.
3. Native classes lowered into the inspected constructor/IIFE/descriptor form. Every constructor guard and descriptor key is checked. The explicit helper creates non-enumerable, writable, configurable prototype methods; its optional static-props branch is never used by the three checked class constructions.
4. Arrow functions lowered to function expressions, with expression bodies becoming return statements. Lexical-this aliases must be declared as `var _thisN = this` in an enclosing function; every use is checked against that enclosing scope. Only the three validated constructor guards may be removed during comparison.
5. Object shorthand expanded to property/value pairs and concise object methods lowered to function-valued properties. Babel-generated function names are compiler metadata; the actual key, parameters and body must match.
6. Scanner's single `Unexpected token` template literal lowered to string concatenation.
7. Unary plus on numeric literals, and removal of the parser switch's empty default clause.
8. Explicit known bundle alpha-renames: module aliases and the local quantize2/value2 names. Property names and operators remain exact.

The canonicalizer preserves literal values, regular expressions, arithmetic/comparison/logical operators, method parameter order, statements, control-flow structure, return values and call arguments. It performs no fuzzy matching or representative sampling. The checked compiler scaffolding remains available in exact editable form.

## What this establishes

The fixed 1.1.0 source is the exact preferred editable source corresponding to the shipped embedded implementation under the fully enumerated transformations above. This conclusion comes from complete source-to-bundle comparison, independent of the original package's `^1.1.0` declaration.

It does not establish which npm tarball or historical compiler version ABA Games installed, because their lockfile/build provenance is unavailable. It is also not a promise of identical behavior for reflective JavaScript operations such as inspecting transpiled function names or invoking a class constructor via `.call`; those are normal differences between native class source and Babel output and are not used by the audio library. The original audio API and all ordinary parsing/iteration code remain unchanged.

No claim of a complete original checkout is made. This addendum resolves the editable-source correspondence question while retaining the original runtime bytes and accurate historical-provenance limits. Existing MIT notices and author records continue to apply.
