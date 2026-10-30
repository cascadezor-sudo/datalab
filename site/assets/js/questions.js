// FIXME: remove code duplication (see tickets.js)

function HideQuestions() {
  var questions = document.getElementsByClassName("question");
  Array.from(questions).map(function (question) {
    question.style.display = "none";
  });

  HideAnswers();
  HideProofs();
  HideDerivations();
  HideSubtitles();
}

function ShowQuestions() {
  var questions = document.getElementsByClassName("question");
  Array.from(questions).map(function (question) {
    question.style.display = "list-item";
  });

  ShowAnswers();
  ShowProofs();
  ShowSubtitles();
}

setup("question");
