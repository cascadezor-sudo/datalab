/**
 * Lazy initialization utility for optimizing page load performance
 * Processes elements in batches to avoid blocking the main thread
 */

class LazyInitializer {
  constructor(options = {}) {
    this.batchSize = options.batchSize || 10;
    this.delay = options.delay || 0;
    this.useIdleCallback =
      options.useIdleCallback !== false && "requestIdleCallback" in window;
    this.observer = null;
    this.pendingTasks = [];
  }

  /**
   * Process elements in batches
   * @param {NodeList|Array} elements - Elements to process
   * @param {Function} processor - Function to call for each element
   * @param {Function} onComplete - Callback when all elements are processed
   */
  processBatch(elements, processor, onComplete) {
    const total = elements.length;
    let index = 0;
    const processed = [];

    const processChunk = () => {
      const end = Math.min(index + this.batchSize, total);

      for (let i = index; i < end; i++) {
        try {
          const result = processor(elements[i], i);
          processed.push(result);
        } catch (error) {
          console.error(`Error processing element ${i}:`, error);
        }
      }

      index = end;

      if (index < total) {
        // Schedule next batch
        if (this.useIdleCallback) {
          requestIdleCallback(processChunk, { timeout: 100 });
        } else {
          setTimeout(processChunk, this.delay);
        }
      } else {
        // All elements processed
        if (onComplete) {
          onComplete(processed);
        }
      }
    };

    // Start processing
    if (this.useIdleCallback) {
      requestIdleCallback(processChunk, { timeout: 100 });
    } else {
      setTimeout(processChunk, this.delay);
    }
  }

  /**
   * Initialize visible elements first, then others as they come into view
   * @param {string} selector - CSS selector for elements
   * @param {Function} processor - Function to call for each element
   * @param {Object} options - Intersection Observer options
   */
  initWithIntersectionObserver(selector, processor, options = {}) {
    const elements = document.querySelectorAll(selector);
    if (elements.length === 0) return;

    const {
      rootMargin = "50px",
      threshold = 0.01,
      immediateCount = 20, // Initialize first N elements immediately
    } = options;

    // Initialize first visible elements immediately
    const immediateElements = Array.from(elements).slice(0, immediateCount);
    immediateElements.forEach((el, index) => {
      setTimeout(() => processor(el, index), 0);
    });

    // Use Intersection Observer for the rest
    if (elements.length > immediateCount) {
      const remainingElements = Array.from(elements).slice(immediateCount);
      let processedCount = immediateCount;

      this.observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const element = entry.target;
              processor(element, processedCount++);
              this.observer.unobserve(element);
            }
          });
        },
        { rootMargin, threshold },
      );

      remainingElements.forEach((el) => {
        this.observer.observe(el);
      });
    }
  }

  /**
   * Process with priority: visible elements first, then others
   * @param {string} selector - CSS selector
   * @param {Function} processor - Function to process each element
   */
  processWithPriority(selector, processor) {
    const elements = Array.from(document.querySelectorAll(selector));
    if (elements.length === 0) return;

    // Separate visible and hidden elements
    const visible = [];
    const hidden = [];

    elements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const isVisible =
        rect.top < window.innerHeight + 200 && rect.bottom > -200;
      if (isVisible) {
        visible.push(el);
      } else {
        hidden.push(el);
      }
    });

    // Process visible elements immediately
    visible.forEach((el, index) => {
      processor(el, index);
    });

    // Process hidden elements in batches
    if (hidden.length > 0) {
      this.processBatch(hidden, processor);
    }
  }

  /**
   * Cleanup observer
   */
  disconnect() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}

// Export singleton instance
window.LazyInitializer = LazyInitializer;
window.lazyInit = new LazyInitializer({
  batchSize: 15,
  delay: 10,
  useIdleCallback: true,
});
