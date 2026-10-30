/**
 * News Panel Component
 * Handles the collapsible news panel functionality on the main page
 */
class NewsPanel {
  constructor() {
    this.panel = null;
    this.isExpanded = false;
    this.isVisible = true;
    this.storageKey = "newsPanelState";

    this.init();
  }

  init() {
    // Wait for DOM to be ready
    if (document.readyState === "loading") {
      document.addEventListener(
        "DOMContentLoaded",
        async () => await this.setupPanel(),
      );
    } else {
      this.setupPanel();
    }
  }

  async setupPanel() {
    // Load saved state
    this.loadState();

    // Create the panel if it doesn't exist
    if (!document.getElementById("news-panel")) {
      await this.createPanel();
    } else {
    }

    this.panel = document.getElementById("news-panel");
    this.bindEvents();

    // Apply initial state
    this.applyState();
  }

  async createPanel() {
    const panelHTML = `
      <div id="news-panel" class="news-panel ${this.isExpanded ? "" : "collapsed"}">
        <div class="news-panel-header" onclick="newsPanel.toggle()">
          <div class="news-panel-title">
            <span class="news-panel-icon">📰</span>
            <span>${t("Новости")}</span>
          </div>
          <div class="news-panel-controls">
            <button class="news-panel-toggle" onclick="event.stopPropagation(); newsPanel.toggle()">
              ${this.isExpanded ? t("Свернуть") : t("Развернуть")}
            </button>
            <button class="news-panel-close" onclick="event.stopPropagation(); newsPanel.hide()">
              ✕
            </button>
          </div>
        </div>
        <div class="news-panel-content ${this.isExpanded ? "expanded" : ""}">
          <div class="news-panel-scroll">
            <div class="news-loading">${t("Загрузка новостей...")}</div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", panelHTML);

    // Load news content asynchronously
    try {
      const newsContent = await this.getNewsContent();
      const scrollContainer = document.querySelector(
        "#news-panel .news-panel-scroll",
      );
      if (scrollContainer) {
        scrollContainer.innerHTML = newsContent;
      }
    } catch (error) {
      console.error("Failed to load news content:", error);
      const scrollContainer = document.querySelector(
        "#news-panel .news-panel-scroll",
      );
      if (scrollContainer) {
        scrollContainer.innerHTML = this.getFallbackContent();
      }
    }
  }

  async getNewsContent() {
    try {
      const response = await fetch("/news.html");
      const html = await response.text();

      // Parse the HTML content
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      // Extract news items from the news container
      const newsContainer = doc.querySelector(".news-container");
      if (!newsContainer) {
        console.warn("News container not found in news.html");
        return this.getFallbackContent();
      }

      const newsItems = newsContainer.querySelectorAll(".news-item");
      if (newsItems.length === 0) {
        console.warn("No news items found in news.html");
        return this.getFallbackContent();
      }

      // Convert news items to panel format (limit to first 8 items for performance)
      const limitedItems = Array.from(newsItems).slice(0, 8);
      return limitedItems
        .map((item) => this.convertNewsItemToPanel(item))
        .join("");
    } catch (error) {
      console.error("Failed to load news content:", error);
      return this.getFallbackContent();
    }
  }

  convertNewsItemToPanel(newsItem) {
    const header = newsItem.querySelector(".news-header");
    const content = newsItem.querySelector(".news-content");

    if (!header || !content) {
      return "";
    }

    const title =
      header.querySelector("h2")?.textContent?.trim() || t("Новость");
    const date = header.querySelector("time")?.textContent?.trim() || "";

    // Convert content to panel format
    let panelContent = "";
    const contentElements = Array.from(content.children);

    contentElements.forEach((element) => {
      if (element.tagName === "H3") {
        panelContent += `<h4>${element.textContent}</h4>`;
      } else if (element.tagName === "UL") {
        panelContent += this.convertListToPanel(element);
      } else if (element.tagName === "P") {
        panelContent += `<p>${element.innerHTML}</p>`;
      } else {
        panelContent += element.outerHTML;
      }
    });

    return `
      <div class="news-panel-item">
        <div class="news-panel-item-header">
          <h3 class="news-panel-item-title">${title}</h3>
          <p class="news-panel-item-date">${date}</p>
        </div>
        <div class="news-panel-item-content">
          ${panelContent}
        </div>
      </div>
    `;
  }

  convertListToPanel(listElement) {
    const items = Array.from(listElement.querySelectorAll("li"));
    const listItems = items
      .map((item) => {
        // Convert links to be more compact for the panel
        const links = item.querySelectorAll("a");
        links.forEach((link) => {
          const href = link.getAttribute("href");
          const text = link.textContent;
          // Make links shorter for panel display
          if (text.length > 50) {
            link.textContent = text.substring(0, 47) + "...";
          }
        });
        return `<li>${item.innerHTML}</li>`;
      })
      .join("");

    return `<ul>${listItems}</ul>`;
  }

  getFallbackContent() {
    return `
      <div class="news-panel-item">
        <div class="news-panel-item-header">
          <h3 class="news-panel-item-title">${t("Новости недоступны")}</h3>
          <p class="news-panel-item-date">${t("Попробуйте позже")}</p>
        </div>
        <div class="news-panel-item-content">
          <p>${t("Не удалось загрузить новости. Проверьте подключение к интернету или попробуйте позже.")}</p>
          <p><a href="/news.html">${t("Открыть полную страницу новостей")}</a></p>
        </div>
      </div>
    `;
  }

  bindEvents() {
    // Handle clicks outside the panel to collapse it
    document.addEventListener("click", (e) => {
      if (this.panel && !this.panel.contains(e.target) && this.isExpanded) {
        this.collapse();
      }
    });

    // Handle escape key to close panel
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isExpanded) {
        this.collapse();
      }
    });
  }

  toggle() {
    if (this.isExpanded) {
      this.collapse();
    } else {
      this.expand();
    }
  }

  expand() {
    this.isExpanded = true;
    this.applyState();
    this.saveState();
  }

  collapse() {
    this.isExpanded = false;
    this.applyState();
    this.saveState();
  }

  hide() {
    this.isVisible = false;
    this.applyState();
    this.saveState();
  }

  show() {
    this.isVisible = true;
    this.applyState();
    this.saveState();
  }

  applyState() {
    if (!this.panel) return;

    if (!this.isVisible) {
      this.panel.style.display = "none";
      return;
    }

    this.panel.style.display = "flex";

    const content = this.panel.querySelector(".news-panel-content");
    const toggleBtn = this.panel.querySelector(".news-panel-toggle");

    if (this.isExpanded) {
      this.panel.classList.remove("collapsed");
      content.classList.add("expanded");
      if (toggleBtn) toggleBtn.textContent = t("Свернуть");
    } else {
      this.panel.classList.add("collapsed");
      content.classList.remove("expanded");
      if (toggleBtn) toggleBtn.textContent = t("Развернуть");
    }
  }

  saveState() {
    const state = {
      isExpanded: this.isExpanded,
      isVisible: this.isVisible,
      timestamp: Date.now(),
    };
    localStorage.setItem(this.storageKey, JSON.stringify(state));
  }

  loadState() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const state = JSON.parse(saved);
        this.isExpanded = state.isExpanded || false;

        // If the panel was hidden, check if it was hidden recently
        // If hidden more than 1 day ago, show it again for important news
        if (state.isVisible === false && state.timestamp) {
          const now = Date.now();
          const hideTime = state.timestamp;
          const daysSinceHidden = (now - hideTime) / (1000 * 60 * 60 * 24);

          if (daysSinceHidden > 1) {
            // If hidden more than 1 day ago, show it again
            this.isVisible = true;
          } else {
            this.isVisible = false;
          }
        } else {
          this.isVisible = state.isVisible !== false; // Default to true if not set
        }
      }
    } catch (error) {
      console.warn("Failed to load news panel state:", error);
      this.isExpanded = false;
      this.isVisible = true;
    }
  }
}

// Initialize the news panel
let newsPanel;
if (typeof window !== "undefined") {
  newsPanel = new NewsPanel();

  // Add debugging function to manually show the news panel
  window.showNewsPanel = () => {
    if (newsPanel) {
      newsPanel.show();
    } else {
    }
  };

  // Add function to completely reset news panel state
  window.resetNewsPanel = () => {
    localStorage.removeItem("newsPanelState");
    location.reload();
  };
}

// Export to window for global access
window.NewsPanel = NewsPanel;
