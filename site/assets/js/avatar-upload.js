/**
 * Avatar upload module.
 *
 * Exposes:
 *   window.avatarUpload.upload(file, uid, getIdToken, db) → Promise<string>  (returns publicUrl)
 *   window.avatarUpload.load(uid, db)                     → Promise<string|null>
 *   window.avatarUpload.applyToElement(el, avatarUrl, initials)
 *
 * The Worker URL must match the deployed Cloudflare Worker.
 * Set AVATAR_WORKER_URL before this script loads, or update the constant below.
 */
(function () {
  // Deployed Cloudflare Worker URL.
  // After deploying cloudflare-worker/avatar-upload.js, replace this with the actual URL.
  var WORKER_URL =
    window.AVATAR_WORKER_URL ||
    "https://avatar-upload.schmidtml.workers.dev";

  var MAX_SIZE = 2 * 1024 * 1024; // 2 MB
  var OUTPUT_SIZE = 256; // resize to 256×256 px

  /**
   * Crop + resize an image File to a square OUTPUT_SIZE×OUTPUT_SIZE canvas blob.
   * Returns a Promise<Blob> (image/jpeg).
   */
  function cropAndResize(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var s = Math.min(img.width, img.height);
        var sx = Math.floor((img.width - s) / 2);
        var sy = Math.floor((img.height - s) / 2);
        var canvas = document.createElement("canvas");
        canvas.width = OUTPUT_SIZE;
        canvas.height = OUTPUT_SIZE;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, sx, sy, s, s, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
        canvas.toBlob(
          function (blob) {
            if (blob) resolve(blob);
            else reject(new Error("Canvas toBlob failed"));
          },
          "image/jpeg",
          0.88
        );
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("Image load failed"));
      };
      img.src = url;
    });
  }

  /**
   * Upload an avatar to R2 via the Cloudflare Worker.
   *
   * @param {File}     file        — image file chosen by the user
   * @param {string}   uid         — Firebase user UID
   * @param {Function} getIdToken  — async function () → idToken string
   * @param {object}   db          — Firebase database reference (for saving avatarUrl)
   * @returns {Promise<string>}    publicUrl of the uploaded avatar
   */
  async function upload(file, uid, getIdToken, db) {
    if (!file) throw new Error("No file provided");
    if (!uid) throw new Error("No uid provided");

    var allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      throw new Error("Unsupported format. Use JPEG, PNG or WEBP.");
    }
    if (file.size > MAX_SIZE) {
      throw new Error("File too large. Maximum size is 2 MB.");
    }

    // Crop + resize before upload
    var blob;
    try {
      blob = await cropAndResize(file);
    } catch (e) {
      throw new Error("Failed to process image: " + e.message);
    }

    // Offline mode: convert blob to Base64 DataURL and save locally
    var dataUrl = await new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    if (db && uid) {
      try {
        await db.ref("users/" + uid + "/avatarUrl").set(dataUrl);
      } catch (e) {
        console.warn("avatarUpload: failed to save URL to Firebase", e);
      }
    }

    return dataUrl;
  }

  /**
   * Load the stored avatarUrl from Firebase for a given uid.
   * Returns null if none is set.
   *
   * @param {string} uid
   * @param {object} db — Firebase database reference
   * @returns {Promise<string|null>}
   */
  async function load(uid, db) {
    if (!uid || !db) return null;
    try {
      var snap = await db.ref("users/" + uid + "/avatarUrl").once("value");
      var url = snap.val();
      if (!url) return null;
      // If URL doesn't already have a cache-bust param, add one so browsers
      // don't serve a stale cached copy after the user re-uploads.
      if (url.indexOf("?t=") === -1) {
        url = url + "?t=" + Date.now();
      }
      return url;
    } catch (e) {
      console.warn("avatarUpload.load failed:", e);
      return null;
    }
  }

  /**
   * Apply an avatarUrl (or initials fallback) to a DOM element.
   * Turns a text-based avatar div into an <img> if a URL is provided,
   * or restores the initials text otherwise.
   *
   * @param {HTMLElement} el         — the avatar element
   * @param {string|null} avatarUrl  — R2 URL or null
   * @param {string}      initials   — fallback text, e.g. "AB"
   */
  function applyToElement(el, avatarUrl, initials) {
    if (!el) return;
    if (avatarUrl) {
      el.classList.add("avatar-has-photo");
      var existing = el.querySelector("img");
      if (existing) {
        // Update src in-place to avoid flicker; force reload with fresh src
        existing.src = "";
        existing.src = avatarUrl;
        existing.alt = initials || "";
      } else {
        el.innerHTML = "";
        var img = document.createElement("img");
        img.src = avatarUrl;
        img.alt = initials || "";
        img.draggable = false;
        el.appendChild(img);
      }
    } else {
      el.classList.remove("avatar-has-photo");
      el.innerHTML = "";
      el.textContent = initials || "?";
    }
  }

  window.avatarUpload = { upload: upload, load: load, applyToElement: applyToElement };
})();
