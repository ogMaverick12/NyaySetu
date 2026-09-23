/**
 * Evergreen stub for Next.js's fixed legacy polyfill module
 * (`next/dist/build/polyfills/polyfill-module`).
 *
 * The stock module unconditionally ships core-js style polyfills
 * (String trimStart/trimEnd, Array flat/flatMap/at, Object fromEntries/hasOwn,
 * Promise.finally, URL.canParse, …) into the shared client chunk — ~11.7 KB of
 * transfer flagged as "legacy JavaScript" on mobile Lighthouse.
 *
 * Every guarded API is native across our evergreen floor
 * (.browserslistrc: Chrome ≥ 94, Firefox ≥ 93, Safari ≥ 15.4, Edge ≥ 94),
 * and no app code calls URL.canParse (the one API younger than our floors),
 * so on supported browsers this stub is behaviorally identical to the stock
 * module: all of its guards would have no-op'd anyway.
 *
 * Wired via `webpack.resolve.alias` in next.config.mjs. If the alias ever
 * stops matching (Next upgrade), the build falls back to the stock module —
 * bundle grows slightly, nothing breaks.
 */
"use strict";

// Intentionally empty: supported browsers implement everything natively.
module.exports = {};
