// Categories Config Loader
// Centralized configuration for all platform categories

let categoriesConfigCache = null;

/**
 * Load categories configuration from JSON
 * @returns {Promise<Object>} Categories configuration
 */
async function loadCategoriesConfig() {
  if (categoriesConfigCache) {
    return categoriesConfigCache;
  }

  try {
    const response = await fetch("/assets/js/config/categories-config.json");
    if (!response.ok) {
      throw new Error(`Failed to load categories config: ${response.status}`);
    }
    categoriesConfigCache = await response.json();
    // Expose cache for synchronous access
    if (typeof window !== "undefined" && window.categoriesConfigLoader) {
      window.categoriesConfigLoader._configCache = categoriesConfigCache;
    }
    return categoriesConfigCache;
  } catch (error) {
    console.error("Failed to load categories config:", error);
    return null;
  }
}

/**
 * Get all category keys
 * @returns {Promise<Array<string>>} Array of category keys
 */
async function getCategoryKeys() {
  const config = await loadCategoriesConfig();
  if (!config) return [];
  return Object.keys(config.categories);
}

/**
 * Get category data by key
 * @param {string} categoryKey - Category key
 * @returns {Promise<Object|null>} Category data or null
 */
async function getCategoryData(categoryKey) {
  const config = await loadCategoriesConfig();
  if (!config) return null;
  return config.categories[categoryKey] || null;
}

/**
 * Get display name for category (Russian or English)
 * @param {string} categoryKey - Category key
 * @param {boolean} useRu - Use Russian name if available
 * @returns {Promise<string>} Display name
 */
async function getCategoryDisplayName(categoryKey, useRu = false) {
  const category = await getCategoryData(categoryKey);
  if (!category) return categoryKey;
  return useRu && category.displayNameRu
    ? category.displayNameRu
    : category.displayName;
}

/**
 * Get all categories grouped by group
 * @returns {Promise<Object>} Categories grouped by group key
 */
async function getCategoriesByGroup() {
  const config = await loadCategoriesConfig();
  if (!config) return {};

  const grouped = {};
  Object.keys(config.groups).forEach((groupKey) => {
    grouped[groupKey] = {
      ...config.groups[groupKey],
      categories: [],
    };
  });

  Object.keys(config.categories).forEach((categoryKey) => {
    const category = config.categories[categoryKey];
    if (category.group && grouped[category.group]) {
      grouped[category.group].categories.push(categoryKey);
    }
  });

  return grouped;
}

/**
 * Get roadmap URL for category
 * @param {string} categoryKey - Category key
 * @returns {Promise<string|null>} Roadmap URL or null
 */
async function getCategoryRoadmapUrl(categoryKey) {
  const category = await getCategoryData(categoryKey);
  return category ? category.roadmapUrl : null;
}

/**
 * Get all categories for leaderboard/filter dropdowns
 * @returns {Promise<Array<{value: string, label: string}>>} Array of category options
 */
async function getCategoryOptions(useRu = false) {
  const config = await loadCategoriesConfig();
  if (!config) return [];

  const options = [];
  Object.keys(config.categories).forEach((categoryKey) => {
    const category = config.categories[categoryKey];
    const displayName =
      useRu && category.displayNameRu
        ? category.displayNameRu
        : category.displayName;
    options.push({
      value: categoryKey,
      label: displayName,
    });
  });

  // Add combined categories
  Object.keys(config.combinedCategories).forEach((combinedKey) => {
    const combined = config.combinedCategories[combinedKey];
    const displayName =
      useRu && combined.displayNameRu
        ? combined.displayNameRu
        : combined.displayName;
    options.push({
      value: combinedKey,
      label: displayName,
    });
  });

  return options;
}

// Export for use in other scripts
if (typeof window !== "undefined") {
  window.categoriesConfigLoader = {
    loadCategoriesConfig,
    getCategoryKeys,
    getCategoryData,
    getCategoryDisplayName,
    getCategoriesByGroup,
    getCategoryRoadmapUrl,
    getCategoryOptions,
  };
}
