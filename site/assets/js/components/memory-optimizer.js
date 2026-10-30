/**
 * Memory Optimizer Component
 * Reduces memory usage by optimizing image loading and preventing duplicate initializations
 */

(function () {
  "use strict";

  // Prevent double initialization
  if (window.__memoryOptimizerInitialized) {
    return;
  }
  window.__memoryOptimizerInitialized = true;

  /**
   * Add lazy loading to all images
   */
  function optimizeImages() {
    const images = document.querySelectorAll("img:not([loading])");

    images.forEach((img) => {
      img.setAttribute("loading", "lazy");
      img.setAttribute("decoding", "async");
    });

    console.log(
      `Memory optimizer: Added lazy loading to ${images.length} images`,
    );
  }

  /**
   * Initialize optimizations
   */
  function init() {
    // Optimize existing images
    optimizeImages();

    // Watch for dynamically added images
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            // Element node
            if (node.tagName === "IMG" && !node.hasAttribute("loading")) {
              node.setAttribute("loading", "lazy");
              node.setAttribute("decoding", "async");
            }
            // Check for images inside added elements
            const imgs = node.querySelectorAll?.("img:not([loading])");
            if (imgs) {
              imgs.forEach((img) => {
                img.setAttribute("loading", "lazy");
                img.setAttribute("decoding", "async");
              });
            }
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // Initialize on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
