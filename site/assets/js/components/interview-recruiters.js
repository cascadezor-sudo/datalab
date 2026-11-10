/**
 * База рекрутеров на /ai/interviews/recruiters.html. Список отдаёт callable
 * listInterviewRecruiters (узел interview_recruiters закрыт правилами).
 * Добавить может любой, кому открыта страница; править и удалять — ментор или
 * автор записи (item.canEdit). Пишут saveInterviewRecruiter /
 * deleteInterviewRecruiter — они
 * же проверяют поля (functions/interview-recruiters.js). Здесь только
 * дружелюбный ввод: linkedin.com/in/foo, t.me/foo, foo без @.
 */
(function () {
  const t =
    typeof window.t === "function"
      ? window.t
      : (s, vars) =>
          String(s).replace(/\{(\w+)\}/g, (m, k) =>
            vars && k in vars ? vars[k] : m,
          );

  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );

  let items = [];
  let canAdd = false;
  let dialog = null;
  let editingId = null;

  // Как normalizeLinkedin в profile/settings.html; не распознали — уходит как
  // есть, и сервер вернёт понятную ошибку.
  function normalizeLinkedin(raw) {
    const value = raw.trim();
    const match = value.match(
      /^(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([A-Za-z0-9_%-]{3,200})\/?(?:[?#].*)?$/i,
    );
    return match ? `https://www.linkedin.com/in/${match[1]}` : value;
  }

  function normalizeTelegram(raw) {
    return raw
      .trim()
      .replace(/^(?:https?:\/\/)?(?:t\.me|telegram\.me)\//i, "")
      .replace(/^@/, "")
      .replace(/\/$/, "");
  }

  const dash = '<span aria-hidden="true">—</span>';

  // Логотип из той же папки, что у банка вопросов по компаниям, или загруженный
  // ментором (company-logos.js); нет — только название.
  function logo(company) {
    const src = window.companyLogos?.url(company);
    return src
      ? `<img class="ir-logo" src="${esc(src)}" alt="" width="20" height="20" loading="lazy" />`
      : "";
  }

  function row(item) {
    const linkedin = item.linkedin
      ? `<a href="${esc(item.linkedin)}" target="_blank" rel="noopener noreferrer">${esc(item.linkedin.replace(/^https:\/\/www\./, "").replace(/\/$/, ""))}</a>`
      : dash;
    const telegram = item.telegram
      ? `<a href="https://t.me/${esc(item.telegram.slice(1))}" target="_blank" rel="noopener noreferrer">${esc(item.telegram)}</a>`
      : dash;
    const admin = item.canEdit
      ? `<span class="ir-admin"><button type="button" data-ir-edit="${esc(item.id)}">${esc(t("Изменить"))}</button><button type="button" data-ir-delete="${esc(item.id)}">${esc(t("Удалить"))}</button></span>`
      : "";
    return `<tr><td>${esc(item.name)}${admin}</td><td>${item.company ? `<span class="ir-company-cell">${logo(item.company)}${esc(item.company)}</span>` : dash}</td><td>${esc(item.position)}</td><td>${linkedin}</td><td>${telegram}</td></tr>`;
  }

  // Варианты фильтра — компании из списка с числом рекрутеров; выбранная
  // остаётся выбранной после перезагрузки списка (добавили, удалили).
  function renderCompanies() {
    const select = document.getElementById("ir-company");
    const counts = new Map();
    items.forEach((item) => {
      if (item.company)
        counts.set(item.company, (counts.get(item.company) || 0) + 1);
    });
    const current = select.value;
    const names = [...counts.keys()].sort((a, b) => a.localeCompare(b, "ru"));
    select.innerHTML =
      `<option value="">${esc(t("Все компании"))}</option>` +
      names
        .map(
          (name) =>
            `<option value="${esc(name)}">${esc(name)} (${counts.get(name)})</option>`,
        )
        .join("");
    select.value = counts.has(current) ? current : "";
  }

  function render() {
    const query = document
      .getElementById("ir-search")
      .value.trim()
      .toLowerCase();
    const company = document.getElementById("ir-company").value;
    const shown = items.filter(
      (item) =>
        (!company || item.company === company) &&
        (!query ||
          `${item.name} ${item.company} ${item.position}`
            .toLowerCase()
            .includes(query)),
    );
    document.getElementById("ir-rows").innerHTML = shown.map(row).join("");
    document.getElementById("ir-table").hidden = !shown.length;
    const empty = document.getElementById("ir-empty");
    empty.hidden = Boolean(shown.length);
    empty.textContent = items.length
      ? t("Никого не нашли — попробуйте другой запрос.")
      : t("В базе пока нет рекрутеров.");
    document.getElementById("ir-count").textContent = t("Найдено: {count}", {
      count: shown.length,
    });
  }

  async function load() {
    try {
      const all = [];
      let offset = 0;
      let result;
      do {
        result = await window.staffApi.call("listInterviewRecruiters", {
          offset,
        });
        all.push(...(result.items || []));
        offset = result.nextOffset;
      } while (offset != null);
      items = all;
      canAdd = Boolean(result.canAdd);
      if (canAdd) initEditor();
      renderCompanies();
      render();
    } catch (error) {
      console.warn("Interview recruiters: list failed", error);
      const empty = document.getElementById("ir-empty");
      empty.textContent = t("Не удалось загрузить базу рекрутеров.");
      empty.hidden = false;
    }
  }

  function buildDialog() {
    dialog = document.createElement("dialog");
    dialog.className = "iv-editor";
    dialog.innerHTML = `
      <form method="dialog" class="iv-editor__form">
        <h2 class="iv-editor__title"></h2>
        <label class="iv-editor__field">
          <span>${esc(t("Имя рекрутера"))}</span>
          <input type="text" name="name" maxlength="100" required />
        </label>
        <label class="iv-editor__field">
          <span>${esc(t("Компания"))}</span>
          <input type="text" name="company" maxlength="100" />
        </label>
        <label class="iv-editor__field">
          <span>${esc(t("Должность"))}</span>
          <input type="text" name="position" maxlength="100" placeholder="HR" />
        </label>
        <label class="iv-editor__field">
          <span>LinkedIn</span>
          <input type="text" name="linkedin" maxlength="300" placeholder="linkedin.com/in/username" />
        </label>
        <label class="iv-editor__field">
          <span>Telegram</span>
          <input type="text" name="telegram" maxlength="60" placeholder="@username" />
        </label>
        <p class="iv-editor__status" role="status" aria-live="polite"></p>
        <div class="iv-editor__actions">
          <button type="button" class="iv-editor__cancel">${esc(t("Отмена"))}</button>
          <button type="submit" class="iv-editor__save">${esc(t("Сохранить"))}</button>
        </div>
      </form>`;
    document.body.appendChild(dialog);
    const form = dialog.querySelector("form");
    dialog
      .querySelector(".iv-editor__cancel")
      .addEventListener("click", () => dialog.close());
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      save(form);
    });
  }

  function open(item) {
    if (!dialog) buildDialog();
    const form = dialog.querySelector("form");
    editingId = item ? item.id : null;
    dialog.querySelector(".iv-editor__title").textContent = item
      ? t("Изменить рекрутера")
      : t("Новый рекрутер");
    form.name.value = item?.name || "";
    form.company.value = item?.company || "";
    form.position.value = item?.position || "HR";
    form.linkedin.value = item?.linkedin || "";
    form.telegram.value = item?.telegram || "";
    dialog.querySelector(".iv-editor__status").textContent = "";
    dialog.querySelector(".iv-editor__save").disabled = false;
    dialog.showModal();
  }

  async function save(form) {
    const button = dialog.querySelector(".iv-editor__save");
    button.disabled = true;
    try {
      await window.staffApi.call(
        "saveInterviewRecruiter",
        {
          ...(editingId ? { id: editingId } : {}),
          recruiter: {
            name: form.name.value,
            company: form.company.value,
            position: form.position.value,
            linkedin: normalizeLinkedin(form.linkedin.value),
            telegram: normalizeTelegram(form.telegram.value),
          },
        },
        { retry: false },
      );
      dialog.close();
      await load();
    } catch (error) {
      dialog.querySelector(".iv-editor__status").textContent =
        error?.message || t("Не удалось сохранить.");
      button.disabled = false;
    }
  }

  async function remove(id) {
    const item = items.find((entry) => entry.id === id);
    if (!item) return;
    if (!window.confirm(t("Удалить «{name}» из базы?", { name: item.name })))
      return;
    try {
      await window.staffApi.call(
        "deleteInterviewRecruiter",
        { id },
        { retry: false },
      );
      await load();
    } catch (error) {
      window.alert(error?.message || t("Не удалось удалить."));
    }
  }

  let editorReady = false;
  function initEditor() {
    if (editorReady) return;
    editorReady = true;
    const add = document.createElement("button");
    add.type = "button";
    add.className = "page-header-button";
    add.textContent = t("Добавить рекрутера");
    add.addEventListener("click", () => open(null));
    document.querySelector(".page-header-cta")?.prepend(add);
    document.getElementById("ir-rows").addEventListener("click", (event) => {
      const edit = event.target.closest("[data-ir-edit]");
      const del = event.target.closest("[data-ir-delete]");
      if (edit) open(items.find((entry) => entry.id === edit.dataset.irEdit));
      else if (del) remove(del.dataset.irDelete);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("ir-search").addEventListener("input", render);
    document.getElementById("ir-company").addEventListener("change", render);
    load();
    // Загруженные логотипы доезжают отдельным вызовом — дорисуем, когда придут.
    window.companyLogos?.load().then(() => items.length && render());
  });
})();
