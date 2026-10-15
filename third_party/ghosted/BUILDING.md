# Ghosted module source and build instructions

This archive contains the Ghosted module, its original source/assets, adapter, host component, notices and targeted test. It is not a standalone copy of the entire Playgarden site. Build and test it inside the matching complete Playgarden revision. The deployed site's “本版本完整源码与构建说明” footer links its exact complete source revision; use that revision rather than assuming this module archive is a whole-site checkout.

During isolated adapter preparation, the complete host context and its dependencies are not installed here. The integration archive additionally includes the exact package.json/package-lock.json, src/lib/types.ts, e2e/helpers.ts, root tsconfig*.json, vite.config.ts and playwright.config.ts when those files exist. Those context files aid reproducibility but do not replace the rest of the matching host source. ARCHIVE-MANIFEST.json lists the exact files actually present.

In the complete matching Playgarden checkout:

1. Use the repository's normal locked `npm ci` workflow. Do not run the original Ghosted makefile, Closure pipeline or map converter.
2. Run `node scripts/ghosted/build.mjs`. It uses the official TypeScript already installed from that lockfile: original-derived engine compilation, strict new-bridge compilation, generated declaration boundary check, module archive creation, and source/runtime import checks.
3. Run the host's ordinary typechecked build with Ghosted's build step integrated before Vite.
4. After final independent adapter review, run the single targeted invocation `npm run test:e2e -- e2e/ghosted.spec.ts` for the configured desktop/mobile projects. Inspect actual screenshots. Candidate input plans are not runtime evidence.

The module preserves original commit 846454c3b2f7509515cbcbf8852b09f7b7d98b24. New host/bridge/build/test contributions are GPL-3.0-only; original MIT notices remain. No original build tool or game execution is implied by a successful static identity check.
