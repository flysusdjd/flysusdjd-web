/* ============================================================
   个人主页脚本
   三件事：深浅色切换、元素滚动出现、小细节
   ============================================================ */

(function () {
  'use strict';

  /* ── 1. 深浅色 ────────────────────────────────────────── */
  var root = document.documentElement;
  var STORAGE_KEY = 'theme';

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0d0d0f' : '#fbfaf8');
  }

  var saved = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) { /* 隐私模式下会报错 */ }

  var prefersDark = window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;

  applyTheme(saved || (prefersDark ? 'dark' : 'light'));

  var toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try { localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* 忽略 */ }
    });
  }

  /* ── 2. 滚动出现动画 ──────────────────────────────────── */
  var items = Array.prototype.slice.call(document.querySelectorAll('.reveal'));

  if (!('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    items.forEach(function (el) { observer.observe(el); });

    // 同一批里错开一点，看起来更自然
    document.querySelectorAll('.cards').forEach(function (group) {
      Array.prototype.forEach.call(group.children, function (card, i) {
        card.style.transitionDelay = (i * 80) + 'ms';
      });
    });
  }

  /* ── 3. 滚动后给导航加一条分隔线 ──────────────────────── */
  var nav = document.getElementById('nav');
  if (nav) {
    var onScroll = function () {
      nav.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ── 4. 页脚年份 ──────────────────────────────────────── */
  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
