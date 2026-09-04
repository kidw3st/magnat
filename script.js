/* МАГНАТ — срочный выкуп квартир. Vanilla JS, без зависимостей. */
(function () {
  'use strict';

  document.documentElement.classList.add('js');

  /* ============================================================
     Отправка заявки: приёмник на сервере магнат59.рф шлёт её
     в телеграм менеджерам. Абсолютный адрес, чтобы работало
     и с зеркала на GitHub Pages.
     ============================================================ */
  async function sendLead(data) {
    /* без таймаута браузер ждёт отказа сети до 40 секунд — человек
       всё это время видит «Отправляем…» и уходит, так и не позвонив */
    var control = new AbortController();
    var timer = setTimeout(function () { control.abort(); }, 10000);
    try {
      var res = await fetch('https://xn--59-6kcao6cj5b.xn--p1ai/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: control.signal
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  /* ---------- маска телефона +7 (___) ___-__-__ ---------- */

  function digitsOf(value) {
    var d = value.replace(/\D/g, '');
    if (d.startsWith('8')) d = '7' + d.slice(1);
    if (d && !d.startsWith('7')) d = '7' + d;
    return d.slice(0, 11);
  }

  /* Разделители ставим только МЕЖДУ цифрами и никогда в конце.
     Иначе стереть номер невозможно: удаляешь «)», маска тут же
     дорисовывает её обратно, и Backspace перестаёт работать. */
  function formatPhone(digits) {
    if (!digits) return '';
    var rest = digits.slice(1);
    if (!rest.length) return '+7 ';
    var out = '+7 (' + rest.slice(0, 3);
    if (rest.length > 3) out += ') ' + rest.slice(3, 6);
    if (rest.length > 6) out += '-' + rest.slice(6, 8);
    if (rest.length > 8) out += '-' + rest.slice(8, 10);
    return out;
  }

  function isDigit(ch) {
    return ch >= '0' && ch <= '9';
  }

  /* сколько цифр номера (без кода страны) стоит левее курсора */
  function restBefore(value, pos) {
    var head = value.slice(0, pos).replace(/\D/g, '');
    if (head.charAt(0) === '8' || head.charAt(0) === '7') head = head.slice(1);
    return head.length;
  }

  /* позиция курсора сразу за n-й цифрой номера */
  function caretAfter(formatted, n) {
    if (n > 0) {
      var seen = 0;
      for (var i = 2; i < formatted.length; i++) {
        if (isDigit(formatted.charAt(i))) {
          seen++;
          if (seen === n) return i + 1;
        }
      }
    }
    return formatted.length;
  }

  document.querySelectorAll('[data-phone]').forEach(function (input) {
    input.addEventListener('input', function (e) {
      var digits = digitsOf(input.value);
      /* дожали Backspace до пустого номера — убираем и «+7 »,
         иначе префикс дорисовывается обратно и поле выглядит зависшим */
      if (digits.length <= 1 && e && typeof e.inputType === 'string' &&
          e.inputType.indexOf('delete') === 0) {
        input.value = '';
        return;
      }
      /* курсор держим на месте: без этого он улетает в конец
         и править номер в середине невозможно */
      var typed = restBefore(input.value, input.selectionStart);
      var formatted = formatPhone(digits);
      input.value = formatted;
      var pos = caretAfter(formatted, typed);
      try { input.setSelectionRange(pos, pos); } catch (e) {}
    });
    input.addEventListener('focus', function () {
      if (!input.value) {
        input.value = '+7 ';
        try { input.setSelectionRange(3, 3); } catch (e) {}
      }
    });
    input.addEventListener('blur', function () {
      if (digitsOf(input.value).length <= 1) input.value = '';
    });
  });

  /* ---------- город из шапки подставляется в заявку и подсвечивает плитку ---------- */

  var citySelect = document.getElementById('city-select');
  if (citySelect) {
    citySelect.addEventListener('change', function () {
      if (!citySelect.value) return;
      applyCity(citySelect.value);
      syncCityTiles(citySelect.value);
    });
  }

  /* ---------- валидация и состояния форм ---------- */

  function setError(form, key, show) {
    var el = form.querySelector('[data-error-for="' + key + '"]');
    if (el) el.hidden = !show;
  }

  document.querySelectorAll('[data-form]').forEach(function (form) {
    var phone = form.querySelector('[data-phone]');
    var address = form.querySelector('input[name="address"]');
    var consent = form.querySelector('input[name="consent"]');
    var submit = form.querySelector('[data-submit]');
    var status = form.querySelector('[data-status]');

    [phone, address].forEach(function (input) {
      if (!input) return;
      input.addEventListener('input', function () {
        input.classList.remove('is-invalid');
        setError(form, input.id, false);
        delete input.dataset.autofilled;
      });
    });
    if (consent) {
      consent.addEventListener('change', function () {
        setError(form, 'consent', false);
      });
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var valid = true;

      if (digitsOf(phone.value).length !== 11) {
        phone.classList.add('is-invalid');
        setError(form, phone.id, true);
        valid = false;
      }
      if (!address.value.trim()) {
        address.classList.add('is-invalid');
        setError(form, address.id, true);
        valid = false;
      }
      if (!consent.checked) {
        setError(form, 'consent', true);
        valid = false;
      }
      if (!valid) {
        var firstInvalid = form.querySelector('.is-invalid') || consent;
        firstInvalid.focus();
        return;
      }

      submit.classList.add('is-loading');
      submit.setAttribute('aria-busy', 'true');
      status.hidden = true;
      status.classList.remove('is-error', 'is-success');

      try {
        var honeypot = form.querySelector('input[name="website"]');
        var result = await sendLead({
          phone: phone.value,
          address: address.value.trim(),
          city: citySelect ? citySelect.value : '',
          page: location.href,
          website: honeypot ? honeypot.value : ''
        });
        if (!result || result.ok === false) throw new Error('send failed');

        form.classList.add('is-sent');
        status.textContent = 'Заявка принята. Перезвоним в течение 15 минут по номеру ' + phone.value + '.';
        status.classList.add('is-success');
        status.hidden = false;
      } catch (err) {
        status.textContent = 'Не получилось отправить заявку. Позвоните нам: 8 (919) 480-92-90.';
        status.classList.add('is-error');
        status.hidden = false;
      } finally {
        submit.classList.remove('is-loading');
        submit.removeAttribute('aria-busy');
      }
    });
  });

  /* ---------- персонализация по городу ---------- */

  /* предложный падеж для заголовка и title */
  var CITY_IN = {
    'Пермь': 'в Перми',
    'Москва': 'в Москве',
    'Санкт-Петербург': 'в Санкт-Петербурге',
    'Новосибирск': 'в Новосибирске',
    'Екатеринбург': 'в Екатеринбурге',
    'Казань': 'в Казани',
    'Красноярск': 'в Красноярске',
    'Нижний Новгород': 'в Нижнем Новгороде',
    'Челябинск': 'в Челябинске',
    'Уфа': 'в Уфе',
    'Краснодар': 'в Краснодаре',
    'Самара': 'в Самаре',
    'Омск': 'в Омске',
    'Тюмень': 'в Тюмени',
    'Ижевск': 'в Ижевске',
    'Воронеж': 'в Воронеже'
  };

  /* длинные города («в Санкт-Петербурге») не влезают в строку на полном кегле:
     ужимаем H1 ровно настолько, чтобы вставка помещалась в колонку */
  function fitHeroCity() {
    var h1 = document.querySelector('.hero h1');
    var span = h1 && h1.querySelector('[data-city-in]');
    if (!h1 || !span) return;
    h1.style.fontSize = '';
    if (!span.textContent) return;
    var copy = h1.closest('.hero__copy');
    if (!copy) return;
    var copyW = copy.clientWidth;
    var spanW = span.getBoundingClientRect().width;
    if (!copyW || !spanW || spanW <= copyW * 0.98) return;
    var base = parseFloat(getComputedStyle(h1).fontSize);
    var next = Math.max(24, Math.floor(base * (copyW * 0.97) / spanW));
    h1.style.fontSize = next + 'px';
  }

  var fitTick = false;
  window.addEventListener('resize', function () {
    if (!fitTick) {
      fitTick = true;
      requestAnimationFrame(function () { fitHeroCity(); fitTick = false; });
    }
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitHeroCity);

  function personalizeHeading(city) {
    var inCase = CITY_IN[city];
    if (!inCase) return;
    document.querySelectorAll('[data-city-in]').forEach(function (el) {
      el.textContent = inCase;
    });
    /* базовое ужатие — классом, не дожидаясь загрузки шрифта */
    var h1 = document.querySelector('.hero h1');
    if (h1) h1.classList.toggle('h1--longcity', inCase.length >= 15);
    fitHeroCity();
    document.title = 'Срочный выкуп квартир ' + inCase + ' до 80% от рыночной стоимости | МАГНАТ';
    var call = document.querySelector('.hero__citycall');
    if (call) call.hidden = true;
  }

  /* ---------- выбор города в сетке: подставляем в заявку ---------- */

  function applyCity(city) {
    if (citySelect && CITY_IN[city]) citySelect.value = city;
    document.querySelectorAll('input[name="address"]').forEach(function (input) {
      if (!input.value.trim() || input.dataset.autofilled === '1') {
        input.value = city;
        input.dataset.autofilled = '1';
      }
    });
    personalizeHeading(city);
    try { localStorage.setItem('magnat-city', city); } catch (e) {}
  }

  var cityPicks = document.querySelectorAll('.cities__pick');

  /* подсветка плитки, соответствующей выбранному городу (для Перми плитки нет) */
  function syncCityTiles(city) {
    cityPicks.forEach(function (b) {
      var active = b.dataset.city === city;
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
      b.querySelector('.cities__go').hidden = !active;
    });
  }

  cityPicks.forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      /* клик по «к форме» внутри активной плитки ведёт к заявке
         (span вместо вложенной ссылки: <a> внутри <button> невалиден) */
      if (e.target.closest('.cities__golink')) {
        scrollToLeadForm();
        return;
      }
      var pressed = btn.getAttribute('aria-pressed') === 'true';
      if (pressed) {
        syncCityTiles(null);
      } else {
        syncCityTiles(btn.dataset.city);
        applyCity(btn.dataset.city);
      }
    });
  });

  document.querySelectorAll('[data-pick-city]').forEach(function (link) {
    link.addEventListener('click', function () {
      applyCity(link.dataset.pickCity);
    });
  });

  /* ---------- город при заходе: из ссылки (?city=…) или из прошлого визита ---------- */

  (function initCity() {
    var raw = '';
    try {
      raw = new URLSearchParams(location.search).get('city') || localStorage.getItem('magnat-city') || '';
    } catch (e) {}
    raw = String(raw).trim().slice(0, 40);
    if (!raw || !/^[А-Яа-яЁё][А-Яа-яЁё\s-]*$/.test(raw)) return;

    /* известный город — сверяем без учёта регистра */
    var known = Object.keys(CITY_IN).filter(function (c) {
      return c.toLowerCase() === raw.toLowerCase();
    })[0];

    if (known) {
      applyCity(known);
      syncCityTiles(known);
      return;
    }

    /* города нет в списке: плашка «позвоните» + всё равно подставим в заявку */
    var pretty = raw.charAt(0).toUpperCase() + raw.slice(1);
    var call = document.querySelector('.hero__citycall');
    if (call) {
      call.querySelector('b').textContent = pretty;
      call.hidden = false;
    }
    document.querySelectorAll('input[name="address"]').forEach(function (input) {
      if (!input.value.trim()) {
        input.value = pretty;
        input.dataset.autofilled = '1';
      }
    });
  })();

  /* ---------- дневной / ночной режим ---------- */

  var themeToggle = document.querySelector('[data-theme-toggle]');
  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var night = document.documentElement.dataset.theme === 'night';
      if (night) {
        delete document.documentElement.dataset.theme;
      } else {
        document.documentElement.dataset.theme = 'night';
      }
      try { localStorage.setItem('magnat-theme', night ? 'day' : 'night'); } catch (e) {}
    });
  }

  /* ---------- кнопка «наверх» ---------- */

  var toTop = document.querySelector('[data-to-top]');
  if (toTop) {
    var toTopTick = false;
    var updateToTop = function () {
      toTop.classList.toggle('is-visible', window.scrollY > 700);
      toTopTick = false;
    };
    window.addEventListener('scroll', function () {
      if (!toTopTick) {
        toTopTick = true;
        requestAnimationFrame(updateToTop);
      }
    }, { passive: true });
    updateToTop();
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  /* ---------- логотип и ссылки «#top»: всегда наверх, без залипшего хэша ---------- */

  document.querySelectorAll('a[href="#top"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
    });
  });

  /* ---------- скроллспай: подсветка активного раздела в шапке ---------- */

  var navWrap = document.querySelector('.header__nav');
  var navLinks = document.querySelectorAll('.header__nav a[href^="#"]');
  var navInk = null;
  var activeLink = null;

  if (navWrap && navLinks.length) {
    navInk = document.createElement('span');
    navInk.className = 'nav-ink';
    navWrap.appendChild(navInk);
  }

  function setActiveLink(link) {
    activeLink = link || null;
    navLinks.forEach(function (b) { b.classList.remove('is-active'); });
    if (!navInk) return;
    if (link) {
      link.classList.add('is-active');
      navInk.style.width = link.offsetWidth + 'px';
      navInk.style.transform = 'translateX(' + link.offsetLeft + 'px)';
      navInk.classList.add('is-on');
    } else {
      navInk.classList.remove('is-on');
    }
  }

  /* пока плавный скролл по клику едет к цели, скроллспай молчит —
     иначе подчёркивание скачет по всем промежуточным пунктам */
  var spyLocked = false;
  var spyUnlockTimer = null;

  function unlockSpy() {
    spyLocked = false;
    if (spyUnlockTimer) { clearTimeout(spyUnlockTimer); spyUnlockTimer = null; }
  }

  window.addEventListener('scrollend', unlockSpy, { passive: true });

  navLinks.forEach(function (a) {
    a.addEventListener('click', function () {
      setActiveLink(a);
      spyLocked = true;
      if (spyUnlockTimer) clearTimeout(spyUnlockTimer);
      spyUnlockTimer = setTimeout(unlockSpy, 1500); // страховка для браузеров без scrollend
    });
  });

  window.addEventListener('resize', function () {
    if (activeLink) setActiveLink(activeLink);
  });

  if (navLinks.length && 'IntersectionObserver' in window) {
    var linkById = {};
    navLinks.forEach(function (a) { linkById[a.getAttribute('href').slice(1)] = a; });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || spyLocked) return;
        setActiveLink(linkById[entry.target.id] || null);
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    Object.keys(linkById).forEach(function (id) {
      var sec = document.getElementById(id);
      if (sec) spy.observe(sec);
    });
  }

  /* ---------- карточки карусели: грузим заранее, но не в первую волну ----------
     нативный lazy здесь не работает: лента едет, и карточка въезжает в кадр
     раньше, чем браузер решит её подгрузить — в ленте появляются пустые рамки.
     Поэтому грузим всю ленту разом, когда до неё остаётся около экрана прокрутки:
     первый экран не тормозится, а к моменту показа картинки уже на месте */

  (function preloadMarquee() {
    var marquees = document.querySelectorAll('.marquee');
    if (!marquees.length) return;

    function load(marquee) {
      marquee.querySelectorAll('img[data-src]').forEach(function (img) {
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
      });
    }

    if (!('IntersectionObserver' in window)) {
      marquees.forEach(load);
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        load(entry.target);
        io.unobserve(entry.target);
      });
    }, { rootMargin: '1200px 0px' });

    marquees.forEach(function (m) { io.observe(m); });
  })();

  /* ---------- лайтбокс: карточка карусели в полный размер ---------- */

  var lightbox = document.querySelector('[data-lightbox]');
  if (lightbox) {
    var lbImg = lightbox.querySelector('.lightbox__img');
    var lbClose = lightbox.querySelector('.lightbox__close');
    var BLANK_PIXEL = lbImg.getAttribute('src');
    var lastFocused = null;

    var openLightbox = function (img) {
      /* полный размер прописан в data-full: подмена расширения в имени
         молча ломалась бы на любой картинке без парного файла */
      lbImg.src = img.dataset.full || img.src;
      lbImg.alt = img.alt;
      lastFocused = document.activeElement;
      lightbox.hidden = false;
      document.body.classList.add('lightbox-open');
      lbClose.focus();
    };

    var closeLightbox = function () {
      if (lightbox.hidden) return;
      lightbox.hidden = true;
      lbImg.src = BLANK_PIXEL;
      document.body.classList.remove('lightbox-open');
      if (lastFocused && lastFocused.focus) lastFocused.focus();
      lastFocused = null;
    };

    document.querySelectorAll('.marquee').forEach(function (m) {
      m.addEventListener('click', function (e) {
        var img = e.target.closest('.marquee__img');
        if (img) openLightbox(img);
      });
      /* карточки открываются и с клавиатуры: Enter или пробел */
      m.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
        var img = e.target.closest('.marquee__img[role="button"]');
        if (!img) return;
        e.preventDefault();
        openLightbox(img);
      });
    });

    lightbox.addEventListener('click', closeLightbox);

    document.addEventListener('keydown', function (e) {
      if (lightbox.hidden) return;
      if (e.key === 'Escape') { closeLightbox(); return; }
      /* пока окно открыто, фокус не убегает на страницу под ним */
      if (e.key === 'Tab') { e.preventDefault(); lbClose.focus(); }
    });
  }

  /* ---------- бесшовный цикл лент отзывов: дублируем группу ---------- */

  document.querySelectorAll('.rev-track').forEach(function (track) {
    var group = track.querySelector('.rev-group');
    if (group) {
      var copy = group.cloneNode(true);
      copy.setAttribute('aria-hidden', 'true');
      track.appendChild(copy);
    }
  });

  /* ---------- появление секций: opacity + translateY(16px), 400ms ---------- */

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!reduceMotion && 'IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        if (el.hasAttribute('data-reveal-group')) {
          Array.prototype.forEach.call(el.children, function (child, i) {
            child.style.setProperty('--reveal-delay', Math.min(i * 60, 360) + 'ms');
          });
        }
        el.classList.add('is-revealed');
        revealObserver.unobserve(el);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });

    document.querySelectorAll('[data-reveal], [data-reveal-group]').forEach(function (el) {
      revealObserver.observe(el);
    });
  } else {
    document.querySelectorAll('[data-reveal], [data-reveal-group]').forEach(function (el) {
      el.classList.add('is-revealed');
    });
  }

  /* ---------- нижняя панель: прячется у финальной формы и футера ---------- */

  var mobilebar = document.querySelector('.mobilebar');
  var finalCta = document.getElementById('final-cta');

  if (mobilebar && finalCta && 'IntersectionObserver' in window) {
    var barObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        mobilebar.classList.toggle('is-hidden', entry.isIntersecting);
      });
    }, { threshold: 0.15 });
    barObserver.observe(finalCta);
  }

  /* ---------- переход к форме: на десктопе — к началу hero целиком,
     на мобильном — к самой форме; без обрубленного первого экрана ---------- */

  function scrollToLeadForm() {
    var behavior = reduceMotion ? 'auto' : 'smooth';
    if (window.matchMedia('(min-width: 1024px)').matches) {
      window.scrollTo({ top: 0, behavior: behavior });
    } else {
      var target = document.getElementById('lead-form');
      if (target) target.scrollIntoView({ behavior: behavior, block: 'start' });
    }
    if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
    setTimeout(function () {
      var phoneInput = document.getElementById('lf-phone');
      if (phoneInput) phoneInput.focus({ preventScroll: true });
    }, reduceMotion ? 0 : 600);
  }

  document.querySelectorAll('a[href="#lead-form"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      scrollToLeadForm();
    });
  });

})();
