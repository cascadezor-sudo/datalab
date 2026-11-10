/**
 * Логотипы компаний — общие для банка вопросов по компаниям и базы рекрутеров.
 * Встроенные лежат в /images/interviews/companies (карта ниже: ключ — название
 * компании в нижнем регистре, значение — имя файла), загруженные ментором со
 * страницы банка — в Cloud Storage, их отдаёт callable listCompanyLogos.
 * Загруженный логотип главнее встроенного.
 */
(function () {
  const BUILT_IN = {
    airi: "airi.png",
    "альфа банк": "alfabank.jpg",
    aston: "aston.png",
    "bell integrator": "bellintegrator.png",
    bp: "bp.png",
    "british petroleum": "bp.png",
    hh: "hh.png",
    ibs: "ibs.png",
    "ibs geotech": "ibs.png",
    indrive: "indrive.png",
    ivi: "ivi.png",
    lamoda: "lamoda.png",
    "life pay": "lifepay.png",
    revolut: "revolut.png",
    s7: "s7.png",
    сбер: "sber.png",
    сбербанк: "sber.png",
    wb: "wb.png",
    wildberries: "wb.png",
    "wsc sports": "wscsports.png",
    x5: "x5.png",
    яндекс: "яндекс.png",
    "азот взрыв": "азотвзрыв.png",
    билайн: "билайн.png",
    "вкусно и точка": "вкусноиточка.png",
    "лига ставок": "лигаставок.png",
    литрес: "литрес.png",
    магнит: "магнит.png",
    мегафон: "мегафон.png",
    мтс: "мтс.png",
    нлмк: "нлмк.png",
    пик: "пик.png",
    промсвязьбанк: "промсвязьбанк.png",
    райффайзен: "райф.png",
    "райффайзен банк": "райф.png",
    райффайзенбанк: "райф.png",
    "правительство москвы": "правительствомосквы.svg",
    реверслаб: "реверслаб.png",
    "ренессанс страхование": "ренессансстрахование.png",
    ростелеком: "ростелеком.png",
    россельхозбанк: "рсхб.png",
    сколтех: "сколтех.png",
    согаз: "согаз.png",
    bmpsoft: "bmpsoft.png",
    спортмастер: "спортмастер.png",
    itexus: "itexus.png",
    ростех: "ростех.png",
    "т банк": "тбанк.png",
    "т банк тинькофф": "тбанк.png",
    "центральный банк": "цб.png",
    "центральный банк россии": "цб.png",
    adapty: "adapty.png",
    igaming: "igaming.png",
    juicyscore: "juicyscore.png",
    simbirsoft: "simbirsoft.png",
    tele2: "t2.png",
    eqvilent: "eqvilent.png",
    ainnovator: "ainnovator.png",
    iss: "iss.svg",
    metamentor: "metamentor.png",
    neurocore: "neurocore.png",
    qooqa: "qooqa.png",
    vk: "vk.png",
    waiw: "waiw.png",
    автомакон: "автомакон.png",
    всемайки: "всемайки.png",
    иттех: "иттех.png",
    эвокарго: "эвокарго.png",
    instinctools: "instinctools.png",
    epam: "epam.png",
    plata: "plata.png",
    "perfect art": "perfect art.png",
    pheon: "pheon.png",
    тануки: "тануки.png",
    // Логотипы с лендинга (schmidtml-lending) — для зала героев.
    amazon: "amazon.png",
    apple: "apple.svg",
    sweco: "sweco.png",
    evapps: "evapps.png",
    osmi: "osmi.png",
    "osmi it": "osmi.png",
    "осми ит": "osmi.png",
    "grid dynamics": "griddynamics.png",
    newxel: "newxel.png",
    aristek: "aristek.png",
    роснефть: "роснефть.png",
    цб: "цб.png",
    "центральный банк": "цб.png",
    "банк россии": "цб.png",
    сибинтек: "сибинтек.png",
    "сибинтек софт": "сибинтек.png",
    "alpha bank": "alfabank.jpg",
    "alfa bank": "alfabank.jpg",
    // "": ".jpg",
  };

  let uploaded = {};
  let canUpload = false;
  let loading = null;

  // Тот же ключ считает сервер (companyKey в functions/company-logos.js).
  function key(name) {
    return String(name || "")
      .toLocaleLowerCase("ru")
      .replace(/[—–-]/g, " ")
      .replace(/\s*\([^)]*\)/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function url(name) {
    const k = key(name);
    if (uploaded[k]) return uploaded[k];
    return BUILT_IN[k] ? `/images/interviews/companies/${BUILT_IN[k]}` : "";
  }

  // Ошибка или невыкаченная функция — остаются встроенные логотипы.
  function load({ force = false } = {}) {
    if (!loading || force) {
      loading = window.staffApi
        .call("listCompanyLogos")
        .then((result) => {
          uploaded = result?.logos || {};
          canUpload = Boolean(result?.canUpload);
        })
        .catch((error) => console.warn("Company logos: list failed", error));
    }
    return loading;
  }

  // Картинка → PNG не больше 256px по большей стороне: лёгкий файл, а SVG
  // заодно превращается в растр.
  function toPng(file) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const src = URL.createObjectURL(file);
      image.onload = () => {
        URL.revokeObjectURL(src);
        const scale = Math.min(1, 256 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas
          .getContext("2d")
          .drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      };
      image.onerror = () => {
        URL.revokeObjectURL(src);
        reject(new Error(t("Не удалось прочитать картинку.")));
      };
      image.src = src;
    });
  }

  async function upload(company, file) {
    const image = await toPng(file);
    const result = await window.staffApi.call(
      "setCompanyLogo",
      { company, image },
      { retry: false },
    );
    uploaded[result.key] = result.url;
    return result.url;
  }

  window.companyLogos = {
    key,
    url,
    load,
    upload,
    get canUpload() {
      return canUpload;
    },
  };
})();
