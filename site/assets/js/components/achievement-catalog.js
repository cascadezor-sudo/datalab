(function () {
  "use strict";

  let catalogPromise;
  // Version the sprite independently, so a deployed icon refresh is not hidden by a stale CDN cache.
  const SPRITE_URL = "/assets/icons/achievements.svg?v=3";

  function load() {
    if (!catalogPromise) {
      // no-cache, а не force-cache: последний отдаёт копию из кэша даже
      // просроченную и сервер не спрашивает вовсе. Каталог при этом растёт —
      // после выкладки одиннадцати достижений за повторение ученики
      // продолжали видеть 86 из 97, и увидели бы старое число до тех пор,
      // пока браузер сам не вытеснит запись. Сервер отдаёт файл без
      // Cache-Control, только с etag, так что переспрашивать дёшево:
      // неизменившийся каталог возвращается как 304 без тела.
      catalogPromise = fetch("/assets/data/achievements/catalog.json", { cache: "no-cache" })
        .then((response) => {
          if (!response.ok) throw new Error(`Achievement catalogue: ${response.status}`);
          return response.json();
        })
        .then((catalog) => {
          catalog.byId = new Map(catalog.achievements.map((achievement) => [achievement.id, achievement]));
          return catalog;
        });
    }
    return catalogPromise;
  }

  function icon(achievement, className = "achievement-svg", label) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", className);
    svg.setAttribute("viewBox", "0 0 64 64");
    if (label) {
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", label);
    } else {
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("focusable", "false");
    }
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", `${SPRITE_URL}#${achievement.iconId}`);
    svg.appendChild(use);
    return svg;
  }

  window.achievementCatalog = { icon, load };
})();
