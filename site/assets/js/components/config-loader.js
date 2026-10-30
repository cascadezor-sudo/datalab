// Favicon для всех страниц, где подключён этот скрипт (без правок в каждом HTML)
(function () {
  try {
    var link = document.querySelector('link[rel="icon"]');
    if (!link || link.getAttribute("href") === "/favicon.ico") {
      var favicon = document.createElement("link");
      favicon.rel = "icon";
      favicon.type = "image/svg+xml";
      favicon.href = "/favicon.svg";
      document.head.appendChild(favicon);
      if (link) link.remove();
    }
  } catch (e) {}
})();

// Configuration Loader Utility
class ConfigLoader {
  constructor() {
    this.configs = new Map();
    this.loadedConfigs = new Set();
  }

  /**
   * Load configuration from JSON file
   * @param {string} configName - Name of the configuration
   * @param {string} configPath - Path to the JSON config file
   * @returns {Promise<Object>} - Configuration object
   */
  async loadConfig(configName, configPath) {
    // Return cached config if already loaded
    if (this.configs.has(configName)) {
      return this.configs.get(configName);
    }

    try {
      const response = await fetch(configPath);
      if (!response.ok) {
        throw new Error(
          `Failed to load config: ${response.status} ${response.statusText}`,
        );
      }

      const config = await response.json();

      // Cache the config
      this.configs.set(configName, config);
      this.loadedConfigs.add(configName);

      console.log(`Config loaded successfully: ${configName}`);
      return config;
    } catch (error) {
      console.error(`Error loading config ${configName}:`, error);
      throw error;
    }
  }

  /**
   * Load Firebase configuration
   * @returns {Promise<Object>} - Firebase config object
   */
  async loadFirebaseConfig() {
    return this.loadConfig("firebase", "/config/firebase-config.json");
  }

  /**
   * Get cached configuration
   * @param {string} configName - Name of the configuration
   * @returns {Object|null} - Cached configuration or null if not loaded
   */
  getCachedConfig(configName) {
    return this.configs.get(configName) || null;
  }

  /**
   * Check if configuration is loaded
   * @param {string} configName - Name of the configuration
   * @returns {boolean} - True if config is loaded
   */
  isConfigLoaded(configName) {
    return this.loadedConfigs.has(configName);
  }

  /**
   * Clear cached configuration
   * @param {string} configName - Name of the configuration to clear
   */
  clearConfig(configName) {
    this.configs.delete(configName);
    this.loadedConfigs.delete(configName);
  }

  /**
   * Clear all cached configurations
   */
  clearAllConfigs() {
    this.configs.clear();
    this.loadedConfigs.clear();
  }
}

// Global config loader instance
window.configLoader = new ConfigLoader();

// Export for use in modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = ConfigLoader;
}
