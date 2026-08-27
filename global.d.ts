declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}

/**
 * The control surface `public/bz.js` publishes, used by the opt out on
 * /privacy. Optional throughout: the beacon is a plain script that may not have
 * loaded yet, or may have been blocked, and the objection must still work in
 * that case because the server cookie is what actually stops collection.
 */
interface BreazyAnalytics {
  enabled: boolean;
  optOut?: () => boolean;
  optIn?: () => boolean;
  isOptedOut?: () => boolean;
}

// Declared at the top level, not inside `declare global`. This file has no
// import or export, so it is an ambient script and its declarations are already
// global. `declare global` is only legal inside a module.
interface Window {
  breazyAnalytics?: BreazyAnalytics;
}
