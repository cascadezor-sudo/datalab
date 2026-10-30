(function () {
  "use strict";

  const MAX_QUEUE = 5;
  const SEEN_PREFIX = "achievement-toast-seen-v2:";
  const t = window.t || ((text) => text);

  class AchievementNotifications {
    constructor() {
      this.db = null;
      this.authUnsubscribe = null;
      this.eventsRef = null;
      this.listener = null;
      this.queue = [];
      this.showing = false;
      this.seeded = false;
      this.userId = null;
      this.region = null;
    }

    async initialize(firebaseConfig) {
      if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
      this.db = firebase.database();
      if (this.authUnsubscribe) return;
      this.authUnsubscribe = firebase.auth().onAuthStateChanged((user) => this.setUser(user));
    }

    setUser(user) {
      this.detachEvents();
      this.queue = [];
      this.showing = false;
      this.seeded = false;
      this.userId = user ? user.uid : null;
      if (!user || !this.db) return;
      this.eventsRef = this.db.ref(`achievement_events/${user.uid}`).orderByChild("createdAt").limitToLast(20);
      this.listener = (snapshot) => {
        if (!this.seeded) return;
        const event = snapshot.val();
        if (event && event.achievementId) this.enqueue({ id: event.achievementId, eventId: snapshot.key });
      };
      this.eventsRef.once("value").then((snapshot) => {
        snapshot.forEach((child) => this.markSeen(child.key));
        this.seeded = true;
        this.eventsRef.on("child_added", this.listener);
      });
    }

    detachEvents() {
      if (this.eventsRef && this.listener) this.eventsRef.off("child_added", this.listener);
      this.eventsRef = null;
      this.listener = null;
    }

    wasSeen(eventId) {
      try { return sessionStorage.getItem(`${SEEN_PREFIX}${eventId}`) === "1"; } catch (_) { return false; }
    }

    markSeen(eventId) {
      try { sessionStorage.setItem(`${SEEN_PREFIX}${eventId}`, "1"); } catch (_) {}
    }

    show(achievement) {
      if (!achievement) return;
      this.enqueue({ id: achievement.id || achievement.achievementId, achievement, eventId: achievement.eventId });
    }

    enqueue(item) {
      if (!item.id || (item.eventId && this.wasSeen(item.eventId))) return;
      if (item.eventId) this.markSeen(item.eventId);
      if (this.queue.some((queued) => queued.id === item.id) || this.showing && this.currentId === item.id) return;
      this.queue.push(item);
      if (this.queue.length > MAX_QUEUE) this.queue.splice(0, this.queue.length - MAX_QUEUE);
      this.process();
    }

    async process() {
      if (this.showing || !this.queue.length) return;
      this.showing = true;
      const item = this.queue.shift();
      this.currentId = item.id;
      try {
        const catalog = await window.achievementCatalog.load();
        const achievement = catalog.byId.get(item.id) || item.achievement;
        if (achievement) await this.render(achievement);
      } catch (error) {
        console.warn("Achievement notification skipped:", error);
      } finally {
        this.currentId = null;
        this.showing = false;
        this.process();
      }
    }

    ensureRegion() {
      if (this.region) return this.region;
      const region = document.createElement("div");
      region.className = "achievement-toast-region";
      region.setAttribute("aria-live", "polite");
      region.setAttribute("aria-relevant", "additions");
      document.body.appendChild(region);
      this.region = region;
      return region;
    }

    render(achievement) {
      return new Promise((resolve) => {
        const toast = document.createElement("article");
        toast.className = "achievement-toast";
        toast.appendChild(window.achievementCatalog.icon(achievement, "achievement-toast__icon"));
        const content = document.createElement("div");
        const eyebrow = document.createElement("p");
        eyebrow.className = "achievement-toast__eyebrow";
        eyebrow.textContent = t("Новое достижение");
        const title = document.createElement("p");
        title.className = "achievement-toast__title";
        title.textContent = achievement.title;
        const description = document.createElement("p");
        description.className = "achievement-toast__description";
        description.textContent = achievement.description;
        content.append(eyebrow, title, description);
        const close = document.createElement("button");
        close.className = "achievement-toast__close";
        close.type = "button";
        close.setAttribute("aria-label", t("Закрыть уведомление о достижении"));
        close.textContent = "×";
        toast.append(content, close);
        this.ensureRegion().appendChild(toast);
        requestAnimationFrame(() => toast.classList.add("is-visible"));
        let closed = false;
        const closeToast = () => {
          if (closed) return;
          closed = true;
          toast.classList.remove("is-visible");
          window.setTimeout(() => { toast.remove(); resolve(); }, 180);
        };
        close.addEventListener("click", closeToast, { once: true });
        window.setTimeout(closeToast, 5000);
      });
    }
  }

  const service = new AchievementNotifications();
  window.globalAchievementNotifications = service;
  window.achievementNotifications = service;
})();
