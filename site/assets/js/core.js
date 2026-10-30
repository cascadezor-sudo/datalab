var randomIndex = 0;
var randomElements = [];

function Shuffle(array) {
  var copy = array.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    var tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

function ShowElement(options) {
  options.element.style.display = "block";
  options.button.textContent = options.content.visible;
}
function HideElement(options) {
  options.element.style.display = "none";
  options.button.textContent = options.content.invisible;
}

function ChangeVisibility(options, visibility) {
  var scrollOptions = {
    top: window.scrollY,
    left: window.scrollX,
  };

  if (visibility === "show") {
    ShowElement(options);
  } else if (visibility === "hide") {
    HideElement(options);
  } else {
    if (options.element.style.display === "none") {
      ShowElement(options);
    } else {
      HideElement(options);
    }
  }

  window.scrollTo(scrollOptions);
}

function HideElements(className) {
  var buttons = document.getElementsByClassName(className);
  Array.from(buttons).map(function (button) {
    button.onclick("hide");
  });
}
function ShowElements(className) {
  var buttons = document.getElementsByClassName(className);
  Array.from(buttons).map(function (button) {
    button.onclick("show");
  });
}

function HideAnswers() {
  HideElements("content-toggle");
}
function ShowAnswers() {
  ShowElements("content-toggle");
}

function HideProofs() {
  HideElements("proof-toggle");
  HideElements("derivation-toggle");
}
function ShowProofs() {
  ShowElements("proof-toggle");
  ShowElements("derivation-toggle");
}

function HideIdeas() {
  HideElements("idea-toggle");
}
function ShowIdeas() {
  ShowElements("idea-toggle");
}

function HideDerivations() {
  HideElements("derivation-toggle");
}

// Убрали функции для скрытия/показа примеров - теперь они всегда видны
// function HideExamples() {
//   HideElements('example-toggle');
// }
// function ShowExamples() {
//   ShowElements('example-toggle');
// }

function HideQuestionAnswers() {
  HideElements("answer-toggle");
}
function ShowQuestionAnswers() {
  ShowElements("answer-toggle");
}

function ShowSubtitles() {
  var subtitles = document.getElementsByClassName("subtitle");
  Array.from(subtitles).map(function (subtitle) {
    subtitle.style.display = "block";
  });
}

function HideSubtitles() {
  var subtitles = document.getElementsByClassName("subtitle");
  Array.from(subtitles).map(function (subtitle) {
    subtitle.style.display = "none";
  });
}

function ShowRandomElement(hideElementsFn) {
  if (randomElements.length === 0) return;

  hideElementsFn();

  randomElements[randomIndex].style.display = "none";
  randomIndex += 1;

  if (randomIndex == randomElements.length) {
    randomElements = Shuffle(randomElements).slice();
    randomIndex = 0;
  }

  randomElements[randomIndex].style.display = "block";
}

function PrependButtonWithHandler(element, className, elementName) {
  if (!element) return;

  var parent = element.parentElement;
  var content = {
    // elementName — винительный падеж («ответ», «идею»): ключ словаря.
    visible: t("Скрыть {what}", { what: t(elementName) }),
    invisible: t("Показать {what}", { what: t(elementName) }),
  };

  var controls = document.createElement("div");
  controls.classList.add("proof-controls");

  var button = document.createElement("button");
  button.classList.add(className);
  button.textContent = content.visible;
  button.onclick = function (visibility) {
    ChangeVisibility(
      {
        element: element,
        button: button,
        content: content,
      },
      visibility,
    );
  };

  controls.appendChild(button);
  parent.insertBefore(controls, element);
}

function SetButtonsHandlers() {
  // Убрали создание кнопок "Показать/Скрыть ответ" для вопросов
  // var contents = document.getElementsByClassName('content');
  // Array.from(contents).map(function (content) {
  //   PrependButtonWithHandler(content, 'content-toggle', 'ответ');
  // });

  var derivations = document.getElementsByClassName("derivation");
  Array.from(derivations).map(function (derivation) {
    PrependButtonWithHandler(derivation, "derivation-toggle", "вывод");
  });

  // Убрали создание кнопок для примеров - теперь они всегда видны
  // var examples = document.getElementsByClassName('example');
  // Array.from(examples).map(function (example) {
  //   PrependButtonWithHandler(example, 'example-toggle', 'пример');
  // });

  var questionAnswers = document.querySelectorAll(".quick-question > .answer");
  Array.from(questionAnswers).map(function (answer) {
    PrependButtonWithHandler(answer, "answer-toggle", "ответ");
  });
}

function CreateProofControls(element) {
  var idea = element.querySelector(".idea");
  // FIXME: добавить .solution и .derivation?
  var proof = element.querySelector(".proof");

  if (idea) {
    if (proof) {
      var controls = document.createElement("div");
      controls.classList.add("proof-controls");

      var toggleIdea = document.createElement("button");
      toggleIdea.classList.add("idea-toggle");
      toggleIdea.textContent = t("Показать идею");

      var toggleProof = document.createElement("button");
      toggleProof.classList.add("proof-toggle");
      toggleProof.textContent = t("Скрыть доказательство");

      var ideaOnClick = function (options, visibility) {
        ChangeVisibility(options.idea, visibility);
        ChangeVisibility(options.proof, "hide");
      };
      var proofOnClick = function (options, visibility) {
        ChangeVisibility(options.idea, "hide");
        ChangeVisibility(options.proof, visibility);
      };

      var options = {
        idea: {
          element: idea,
          button: toggleIdea,
          content: {
            visible: t("Скрыть идею"),
            invisible: t("Показать идею"),
          },
        },
        proof: {
          element: proof,
          button: toggleProof,
          content: {
            visible: t("Скрыть доказательство"),
            invisible: t("Показать доказательство"),
          },
        },
      };

      toggleIdea.onclick = function (visibility) {
        ideaOnClick(options, visibility);
      };
      toggleProof.onclick = function (visibility) {
        proofOnClick(options, visibility);
      };

      toggleProof.onclick("show");

      controls.appendChild(toggleIdea);
      controls.appendChild(toggleProof);

      element.insertBefore(controls, idea);
    } else {
      PrependButtonWithHandler(idea, "idea-toggle", "идею");
    }
  } else if (proof) {
    PrependButtonWithHandler(proof, "proof-toggle", "доказательство");
  }
}

function SetProofButtonHandlers() {
  var lemmas = document.getElementsByClassName("lemma");
  Array.from(lemmas).map(CreateProofControls);

  var theorems = document.getElementsByClassName("theorem");
  Array.from(theorems).map(CreateProofControls);

  var corollaries = document.getElementsByClassName("corollary");
  Array.from(corollaries).map(CreateProofControls);

  var statements = document.getElementsByClassName("statement");
  Array.from(statements).map(CreateProofControls);

  var propositions = document.getElementsByClassName("proposition");
  Array.from(propositions).map(CreateProofControls);

  var derivations = document.getElementsByClassName("derivation");
  Array.from(derivations).map(CreateProofControls);
}

function AssignNumbersToElements(className, elementName) {
  // Set up initial attribute
  var elements = document.getElementsByClassName(className);
  for (var j = 0; j < elements.length; ++j) {
    var element = elements[j];
    element.setAttribute(`${className}-name`, `${elementName} ${j + 1}. `);
  }

  var contents = document.getElementsByClassName("content");
  for (var i = 0; i < contents.length; ++i) {
    var content = contents[i];
    var elements = content.getElementsByClassName(className);
    for (var j = 0; j < elements.length; ++j) {
      var element = elements[j];
      element.setAttribute(
        `${className}-name`,
        `${elementName} ${i + 1}.${j + 1}. `,
      );
    }
  }
}

function ChangeProofType(selectElement) {
  if (selectElement.value === "ideas") {
    HideProofs();
    ShowIdeas();
  } else if (selectElement.value === "proofs") {
    HideIdeas();
    ShowProofs();
  }
}

function init(elementsClass) {
  var scrollOptions = {
    top: window.scrollY,
    left: window.scrollX,
  };

  SetButtonsHandlers();
  SetProofButtonHandlers();

  const numberedElements = [
    { className: "theorem", elementName: t("Теорема") },
    { className: "lemma", elementName: t("Лемма") },
    { className: "definition", elementName: t("Определение") },
    { className: "axiom", elementName: t("Аксиома") },
  ];

  for (const element of numberedElements) {
    const className = element.className;
    const elementName = element.elementName;

    AssignNumbersToElements(className, elementName);
  }

  // HideExamples(); // Убрали - примеры теперь всегда видны
  // HideDerivations();
  HideQuestionAnswers();

  var elements = document.getElementsByClassName(elementsClass);
  var nonEmptyQuestions = Array.from(elements).filter(function (element) {
    var name = element.querySelector(".name");
    return name && name.textContent.trim() !== "";
  });

  randomElements = Shuffle(nonEmptyQuestions).slice();

  var proofTypeSelect = document.getElementById("select-proof-type");
  if (proofTypeSelect) {
    proofTypeSelect.onchange = function () {
      ChangeProofType(proofTypeSelect);
    };
  }

  window.scrollTo(scrollOptions);
}

function setup(elementsClass) {
  if (window.addEventListener) {
    // W3C standard
    // NB: **not** 'onload'
    window.addEventListener(
      "load",
      function () {
        init(elementsClass);
      },
      false,
    );
  } else if (window.attachEvent) {
    // Microsoft
    window.attachEvent("onload", function () {
      init(elementsClass);
    });
  }
}
