function animateNumber(
  element,
  start,
  end,
  duration,
  formatter = (value) => value.toLocaleString(),
) {
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);

    // Используем easeOutExpo для более плавной анимации
    const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    const currentNumber = Math.floor(easeProgress * (end - start) + start);

    element.textContent = formatter(currentNumber);

    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };
  window.requestAnimationFrame(step);
}

function initStatAnimation() {
  const statNumbers = document.querySelectorAll(".stat-number");

  statNumbers.forEach((statElement) => {
    const finalNumber = parseInt(statElement.textContent.replace(/,/g, ""), 10);
    statElement.textContent = "0";

    // Добавляем небольшую задержку для каждой следующей статистики
    const delay = Array.from(statNumbers).indexOf(statElement) * 200;

    setTimeout(() => {
      animateNumber(statElement, 0, finalNumber, 2000); // 2 секунды на анимацию
    }, delay);
  });
}

// Запускаем анимацию при загрузке страницы
document.addEventListener("DOMContentLoaded", initStatAnimation);

// Запускаем анимацию при обновлении статистики
document.addEventListener("statsUpdated", initStatAnimation);
