// Async feature module for framer-motion's LazyMotion API.
//
// This file is dynamically imported — it creates a separate webpack chunk that
// is fetched only after the initial page render completes. The ~90 KB of
// framer-motion animation features (domAnimations) are therefore absent from
// the initial page bundle, eliminating their contribution to the LCP-blocking
// vendor chunk.
//
// Usage: <LazyMotion features={() => import('./framer-features').then(r => r.default)}>
//          <m.div ...> ... </m.div>
//        </LazyMotion>
export { domAnimation as default } from "framer-motion";
