/*!
 * Breazy Analytics beacon.
 *
 * Drops into any site. No build step, no dependencies, no framework. Posts
 * same origin to /api/e, which every site's existing Content-Security-Policy
 * already permits because they all allow 'self'.
 *
 * Usage:  <script src="/bz.js" data-site="mmcellars" defer></script>
 *
 * Three things in here look like over engineering and are not. Each one is a
 * documented failure mode that would silently lose data.
 */
(function () {
  "use strict";

  var script = document.currentScript;
  if (!script) return;

  var SITE = script.getAttribute("data-site");
  if (!SITE) return;

  var ENDPOINT = script.getAttribute("data-endpoint") || "/api/e";
  var OPT_OUT_KEY = "bz-optout";

  // ---------------------------------------------------------------------
  // Opt out.
  //
  // POPIA section 11(4) has no "compelling grounds" override: once someone
  // objects, processing stops. The UK statistical purposes exception carries
  // the same duty through its own opt out condition. So this is checked before
  // anything is measured, not filtered later on the server, and the answer has
  // to be honoured even when storage throws.
  // ---------------------------------------------------------------------
  function optedOut() {
    try {
      if (localStorage.getItem(OPT_OUT_KEY) === "1") return true;
    } catch (e) { /* private mode throws, fall through */ }
    return document.cookie.indexOf("bz_optout=1") !== -1;
  }

  // Do Not Track is honoured, but it is not the objection mechanism. The UK
  // regulator is explicit that a browser setting cannot stand in for a real
  // opt out control, so the site still has to offer one.
  function dnt() {
    var v = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
    return v === "1" || v === "yes";
  }

  if (optedOut() || dnt()) {
    window.breazyAnalytics = { enabled: false, optOut: setOptOut, optIn: clearOptOut };
    return;
  }

  // ---------------------------------------------------------------------
  // Transport.
  //
  // sendBeacon is sent a plain string, deliberately. The Fetch specification
  // maps a string body to text/plain;charset=UTF-8, which is CORS safelisted,
  // so no preflight is ever triggered. Wrapping the same JSON in a Blob typed
  // application/json would buy an OPTIONS round trip on every single beacon,
  // at the exact moment the page is going away.
  //
  // The 64 KiB limit is a shared in flight budget across all keepalive
  // requests, not a per call one, so sendBeacon can return false for reasons
  // that have nothing to do with this payload. Hence the fallback.
  // ---------------------------------------------------------------------
  function post(body) {
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, body)) return;
    } catch (e) { /* fall through */ }
    try {
      fetch(ENDPOINT, {
        method: "POST",
        body: body,
        keepalive: true,
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        credentials: "same-origin"
      })["catch"](function () {});
    } catch (e) { /* analytics must never break the page */ }
  }

  function refHost() {
    try {
      return document.referrer ? new URL(document.referrer).host : "";
    } catch (e) { return ""; }
  }

  function send(event, path, dwellMs) {
    // Re-checked on every send, not only at load. Somebody who objects while
    // the page is open must stop being counted at that moment, not at their
    // next navigation. Section 11(4) allows no balancing here.
    if (closed || optedOut()) return;
    var payload = {
      site: SITE,
      event: event,
      path: path,
      occurred_at: Date.now(),
      ref: refHost()
    };
    if (typeof dwellMs === "number") payload.dwell_ms = Math.round(dwellMs);
    try { post(JSON.stringify(payload)); } catch (e) {}
  }

  // ---------------------------------------------------------------------
  // Dwell measurement.
  //
  // Only time the page was genuinely on screen counts. A running total plus a
  // resume marker, never a single start timestamp with a subtraction at the
  // end, because that would count a phone left in a pocket overnight as
  // engagement.
  //
  // performance.now() rather than Date.now(): it is monotonic, so a device
  // clock correction or a daylight saving jump cannot produce a negative or
  // absurd duration.
  // ---------------------------------------------------------------------
  var path = location.pathname || "/";
  var closed = false;
  var visibleMs = 0;
  var resumedAt = document.visibilityState === "visible" ? performance.now() : null;

  function accumulate() {
    if (resumedAt !== null) {
      visibleMs += performance.now() - resumedAt;
      resumedAt = null;
    }
  }

  function resume() {
    if (resumedAt === null) resumedAt = performance.now();
  }

  /**
   * Close the current view. EXACTLY ONCE per view, and the `closed` guard is
   * what enforces it.
   *
   * Three separate bugs lived here and a review caught all three:
   *
   *   A growth gate took a `force` argument that both call sites passed as
   *   true, so it never once evaluated. Dead code that read as a protection.
   *
   *   On an ordinary navigation Chrome fires visibilitychange to hidden AND
   *   pagehide, so every page view sent two leave events, not one. That is
   *   50 per cent more rows than the schema is designed around, and a phone
   *   switching apps repeatedly sent one more each time with no ceiling.
   *
   *   Worse, each send carried the CUMULATIVE visible time rather than a
   *   delta, and the nightly rollup sums them. Three sends at 10s, 25s and
   *   40s recorded 75 seconds against three separate readings, so the average
   *   time on every page came out wrong in both directions at once.
   *
   * One leave per view fixes all three. The honest cost: a visitor who leaves
   * a tab, comes back and reads more has only their time up to the first
   * departure counted. That undercounts rather than inventing, which is the
   * right direction to be wrong in, and it keeps the write budget at the two
   * events per page view every capacity figure assumes.
   */
  function closeView() {
    if (closed) return;
    closed = true;
    accumulate();
    send("leave", path, visibleMs);
  }

  function openView(newPath) {
    if (optedOut()) { closed = true; return; }
    path = newPath;
    visibleMs = 0;
    closed = false;
    resumedAt = document.visibilityState === "visible" ? performance.now() : null;
    send("view", path);
  }

  // ---------------------------------------------------------------------
  // Page lifecycle.
  //
  // visibilitychange to hidden is the only event that fires reliably when
  // somebody switches apps on a phone and later kills the browser from the app
  // switcher, which is how most mobile sessions actually end.
  //
  // unload and beforeunload are deliberately NOT used. They do not fire in that
  // scenario at all, an unload listener makes the page ineligible for the back
  // forward cache in Chrome and Firefox, and Chrome is switching unload off
  // right now: it reached 80 per cent of page loads on 25 August 2026 and goes
  // to 100 per cent on 22 September 2026. pagehide is bfcache compatible and is
  // kept purely as a backstop for older Safari.
  // ---------------------------------------------------------------------
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") closeView();
    else resume();
  });

  // Kept as a backstop for older Safari, which historically did not fire
  // visibilitychange when navigating away. The `closed` guard means it costs
  // nothing on the browsers that fire both.
  window.addEventListener("pagehide", function () { closeView(); });

  // A restore from the back forward cache is a genuinely new view. Keeping the
  // old timer running would attribute time spent on another page to this one.
  window.addEventListener("pageshow", function (e) {
    if (e.persisted) openView(location.pathname || "/");
  });

  // ---------------------------------------------------------------------
  // Soft navigation.
  //
  // popstate alone is not enough: it fires for back and forward but not for
  // pushState, which is how every in app link navigation happens. The
  // Navigation API covers all of it and reached baseline in January 2026, but
  // that is only months of shipped support, so the history patch stays as the
  // fallback for the device tail.
  // ---------------------------------------------------------------------
  function route(next) {
    if (!next || next === path) return;
    closeView();
    openView(next);
  }

  // BOTH detection paths are installed, not one or the other, and that choice
  // is the difference between this working on the Next.js sites and barely
  // working at all.
  //
  // The original code took the Navigation API where present and patched
  // history only as a fallback. The Navigation API has been baseline since
  // January 2026, so on current browsers the fallback never installed. But
  // Next's App Router navigates by calling history.pushState directly, and
  // neither MDN nor the WICG appendix states plainly whether pushState fires
  // the navigate event. If it does not, that arrangement recorded the entry
  // page and missed every soft navigation after it, on most of the estate,
  // while looking like it worked.
  //
  // Rather than bet on an unverified spec detail, install both. route() below
  // returns early when the path has not actually changed, so a navigation seen
  // by both listeners is recorded once. Being right by construction beats
  // being right by reading.
  if (window.navigation && typeof window.navigation.addEventListener === "function") {
    window.navigation.addEventListener("navigate", function (e) {
      if (e.navigationType === "reload") return;
      // The navigate event also fires for CROSS document navigations, which
      // the history patch structurally cannot do, so the two branches are not
      // equivalent and this guard is what makes them safe together. Without
      // it, clicking a link to another page records a view for a page this
      // document never displayed. On a site that sells tickets, a same tab
      // payment redirect would write a phantom view for a path that does not
      // exist here.
      try {
        if (e.destination && e.destination.sameDocument === false) return;
        var u = new URL(e.destination.url);
        if (u.origin !== location.origin) return;
        route(u.pathname);
      } catch (err) {}
    });
  }

  ["pushState", "replaceState"].forEach(function (m) {
    var orig = history[m];
    if (typeof orig !== "function") return;
    history[m] = function () {
      var r = orig.apply(this, arguments);
      // After the call, so location already reflects the new URL.
      try { route(location.pathname); } catch (err) {}
      return r;
    };
  });
  window.addEventListener("popstate", function () { route(location.pathname); });

  // ---------------------------------------------------------------------
  // Public control surface.
  //
  // Withdrawal has to be as easy as the collection was, and reachable rather
  // than buried. A site wires these to a control on its privacy page.
  // ---------------------------------------------------------------------
  /**
   * Stop counting on THIS page, now.
   *
   * It deliberately does NOT write the objection cookie, and that is the whole
   * point of the function.
   *
   * The objection cookie must be set by the SERVER, through DELETE /api/e.
   * Writing it here with document.cookie would replace the server set one with
   * a script created one, and a script created cookie is precisely what Safari
   * deletes after seven days without a return visit. A visitor could object,
   * stay away a week, come back and be counted again, with no way for them to
   * know. On a site where iOS is 40 per cent of traffic that is not a corner
   * case, and it would quietly undo the single mechanism this whole design is
   * built around.
   *
   * So the division is: the server owns the durable record of the objection,
   * this owns stopping the current page. localStorage is kept only as a belt
   * for the case where the page has not yet round tripped.
   */
  function setOptOut() {
    try { localStorage.setItem(OPT_OUT_KEY, "1"); } catch (e) {}
    closed = true;
    return true;
  }

  /** Mirror of the above. The server clears the cookie via PUT /api/e. */
  function clearOptOut() {
    try { localStorage.removeItem(OPT_OUT_KEY); } catch (e) {}
    return true;
  }

  window.breazyAnalytics = {
    enabled: true,
    optOut: setOptOut,
    optIn: clearOptOut,
    isOptedOut: optedOut
  };

  // First view.
  openView(path);
})();
