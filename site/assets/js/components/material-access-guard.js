/**
 * Offline Material Access Guard
 * All materials are unlocked for offline viewing.
 */
(function () {
  'use strict';
  function unlock() {
    try {
      document.documentElement.classList.remove("material-access-checking");
      const overlay = document.getElementById("material-access-check-overlay");
      if (overlay) overlay.remove();
      if (document.body) {
        document.body.style.visibility = "visible";
      }
    } catch (e) {}
  }

  unlock();

  window.__materialAccessGuardScriptRequested = true;
  window.__materialAccessPrimeApplied = true;
  window.__materialAccessCheckUiActive = false;

  window.runMaterialAccessGuard = async function () {
    unlock();
    return false; // false = not blocked
  };

  window.maybeStartEarlyMaterialAccessCheckUI = function () {
    unlock();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", unlock);
  }
  window.addEventListener("load", unlock);
})();
