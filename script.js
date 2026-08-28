/* МАГНАТ — срочный выкуп квартир. Vanilla JS, без зависимостей. */
(function () {
  'use strict';

  document.documentElement.classList.add('js');

  /* ============================================================
     Отправка заявки.
     TODO: подставьте ваш endpoint (CRM, телеграм-бот, почтовый шлюз).
     Функция должна вернуть Promise; reject или ok:false = ошибка.
     ============================================================ */
  async function sendLead(data) {
    // TODO: заменить на реальную отправку, например:
    // const res = await fetch('https://example.com/api/lead', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(data)
    // });
    // if (!res.ok) throw new Error('HTTP ' + res.status);
    // return res.json();

    await new Promise(function (r) { setTimeout(r, 800); }); // имитация сети
    return { ok: true };
  }

  /* ---------- маска телефона +7 (___) ___-__-__ ---------- */

  function digitsOf(value) {
    var d = value.replace(/\D/g, '');
    if (d.startsWith('8')) d = '7' + d.slice(1);
    if (d && !d.startsWith('7')) d = '7' + d;
    return d.slice(0, 11);
  }

  function formatPhone(digits) {
    if (!digits) return '';
    var rest = digits.slice(1);
    var out = '+7';
    if (rest.length) out += ' (' + rest.slice(0, 3);
    if (rest.length >= 3) out += ')';
    if (rest.length > 3) out += ' ' + rest.slice(3, 6);
    if (rest.length > 6) out += '-' + rest.slice(6, 8);
    if (rest.length > 8) out += '-' + rest.slice(8, 10);
    return out;
  }

  document.querySelectorAll('[data-phone]').forEach(function (input) {
    input.addEventListener('input', function () {
      input.value = formatPhone(digitsOf(input.value));
    });
    input.addEventListener('focus', function () {
      if (!input.value) input.value = '+7 (';
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
        var result = await sendLead({
          phone: phone.value,
          address: address.value.trim(),
          city: citySelect ? citySelect.value : '',
          page: location.href
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

  function personalizeHeading(city) {
    var inCase = CITY_IN[city];
    if (!inCase) return;
    document.querySelectorAll('[data-city-in]').forEach(function (el) {
      el.textContent = ' ' + inCase;
    });
    document.title = 'Срочный выкуп квартир ' + inCase + ' до 80% от рыночной стоимости | МАГНАТ';
    var call = document.querySelector('.hero__citycall');
    if (call) call.hidden = true;
  }

  /* ---------- выбор города в сетке: подставляем в заявку ---------- */

  function applyCity(city) {
    if (citySelect && CITY_IN[city]) citySelect.value = city;
    document.querySelectorAll('input[name="address"]').forEach(function (input) {
      if (!input.value.trim() || input.dataset.autofilled === '1') {
        input.value = city + ', ';
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
      if (e.target.closest('a')) return; // клик по ссылке «к форме» работает как ссылка
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
        input.value = pretty + ', ';
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

  document.querySelectorAll('a[href="#lead-form"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
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
    });
  });

})();
