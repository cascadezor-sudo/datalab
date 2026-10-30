(function () {
  "use strict";

  if (window.__mathCopyInitialized) return;
  window.__mathCopyInitialized = true;

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();

    try {
      document.execCommand("copy");
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    } finally {
      textarea.remove();
    }
  }

  function setButtonState(button, label) {
    button.textContent = label;
    button.setAttribute("aria-label", label);
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest(".latex-copy-btn");
    if (!button) return;

    const wrapper = button.closest(".latex-copy-wrap");
    const source = wrapper && wrapper.dataset.latex;
    if (!source) return;

    event.preventDefault();
    event.stopPropagation();

    copyText(source)
      .then(() => {
        setButtonState(button, "Copied");
        button.classList.add("is-copied");
        window.setTimeout(() => {
          setButtonState(button, "Copy");
          button.classList.remove("is-copied");
        }, 1600);
      })
      .catch(() => {
        setButtonState(button, "Error");
        window.setTimeout(() => setButtonState(button, "Copy"), 1600);
      });
  });
})();
