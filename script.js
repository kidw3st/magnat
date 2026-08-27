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

  /* ---------- выбор города в сетке: подставляем в заявку ---------- */

  function applyCity(city) {
    if (citySelect) citySelect.value = city;
    document.querySelectorAll('input[name="address"]').forEach(function (input) {
      if (!input.value.trim() || input.dataset.autofilled === '1') {
        input.value = city + ', ';
        input.dataset.autofilled = '1';
      }
    });
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

  /* ---------- плавный скролл к форме с фокусом на телефоне ---------- */

  document.querySelectorAll('a[href="#lead-form"]').forEach(function (link) {
    link.addEventListener('click', function () {
      setTimeout(function () {
        var phoneInput = document.getElementById('lf-phone');
        if (phoneInput) phoneInput.focus({ preventScroll: true });
      }, reduceMotion ? 0 : 450);
    });
  });

})();
