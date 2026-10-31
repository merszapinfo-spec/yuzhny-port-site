import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isDesktop = () => window.matchMedia('(min-width: 901px)').matches;

/* ---------- Плавный скролл ---------- */

let lenis = null;
if (!reduceMotion) {
  lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

function scrollToTarget(target) {
  if (lenis) lenis.scrollTo(target, { duration: 1.4 });
  else if (typeof target === 'number') window.scrollTo({ top: target });
  else target.scrollIntoView();
}

/* ---------- Разбивка заголовков на слова ---------- */

function splitWords(el) {
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) {
            frag.append(document.createTextNode(' '));
            return;
          }
          const word = document.createElement('span');
          word.className = 'word';
          const inner = document.createElement('span');
          inner.textContent = part;
          word.append(inner);
          frag.append(word);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child);
      }
    });
  };
  el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
  walk(el);
}

$$('[data-split]').forEach(splitWords);

/* ---------- Шапка и меню ---------- */

const header = $('[data-header]');
const burger = $('[data-burger]');
const menu = $('[data-menu]');
let lastY = 0;

function onScroll(y) {
  header.classList.toggle('is-solid', y > 40);
  const menuOpen = burger.getAttribute('aria-expanded') === 'true';
  header.classList.toggle('is-hidden', !menuOpen && y > 400 && y > lastY);
  lastY = y;
}
if (lenis) lenis.on('scroll', ({ scroll }) => onScroll(scroll));
else window.addEventListener('scroll', () => onScroll(window.scrollY), { passive: true });

function setMenu(open) {
  burger.setAttribute('aria-expanded', String(open));
  burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  menu.hidden = !open;
  if (lenis) open ? lenis.stop() : lenis.start();
}
burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));

document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href^="#"]');
  if (!link) return;
  const id = link.getAttribute('href');
  const target = id === '#top' ? 0 : $(id);
  if (target === null) return;
  e.preventDefault();
  setMenu(false);
  scrollToTarget(target);
});

// Подсветка активного пункта меню
$$('.header__nav a').forEach((link) => {
  const section = $(link.getAttribute('href'));
  if (!section) return;
  ScrollTrigger.create({
    trigger: section,
    start: 'top 50%',
    end: 'bottom 50%',
    onToggle: ({ isActive }) => link.classList.toggle('is-active', isActive),
  });
});

/* ---------- Генплан ---------- */

const plan = $('[data-plan]');
if (plan) {
  const pins = $$('[data-pin]', plan);
  const infos = $$('[data-info]', plan);
  const activate = (i) => {
    pins.forEach((p, k) => p.classList.toggle('is-active', k === i));
    infos.forEach((p, k) => p.classList.toggle('is-active', k === i));
  };
  pins.forEach((pin, i) => {
    pin.addEventListener('click', () => activate(i));
    pin.addEventListener('mouseenter', () => isDesktop() && activate(i));
  });
}

/* ---------- Форма заявки ---------- */

const form = $('[data-lead-form]');
if (form) {
  const phone = $('[data-phone]', form);
  const status = $('[data-form-status]', form);

  phone.addEventListener('input', () => {
    let d = phone.value.replace(/\D/g, '');
    if (d.startsWith('8')) d = '7' + d.slice(1);
    if (!d.startsWith('7')) d = '7' + d;
    d = d.slice(0, 11);
    const p = [d.slice(1, 4), d.slice(4, 7), d.slice(7, 9), d.slice(9, 11)];
    let out = '+7';
    if (p[0]) out += ` (${p[0]}`;
    if (p[0].length === 3) out += ')';
    if (p[1]) out += ` ${p[1]}`;
    if (p[2]) out += `-${p[2]}`;
    if (p[3]) out += `-${p[3]}`;
    phone.value = out;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const nameOk = (data.name || '').trim().length > 1;
    const phoneOk = (data.phone || '').replace(/\D/g, '').length === 11;
    form.elements.name.classList.toggle('is-invalid', !nameOk);
    phone.classList.toggle('is-invalid', !phoneOk);
    status.className = 'form__status';

    if (!nameOk || !phoneOk) {
      status.textContent = 'Проверьте имя и номер телефона.';
      status.classList.add('is-error');
      return;
    }
    if (!data.consent) {
      status.textContent = 'Нужно согласие на обработку персональных данных.';
      status.classList.add('is-error');
      return;
    }

    // Адрес обработчика (Telegram-бот) задаётся при сборке: PUBLIC_LEAD_ENDPOINT.
    const endpoint = import.meta.env.PUBLIC_LEAD_ENDPOINT;
    if (!endpoint) {
      status.textContent = 'Форма в тестовом режиме: отправка заявок ещё не подключена.';
      status.classList.add('is-error');
      return;
    }

    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.name.trim(), phone: data.phone, page: location.href }),
      });
      if (!res.ok) throw new Error(String(res.status));
      form.reset();
      status.textContent = 'Спасибо! Мы перезвоним в ближайшее время.';
      status.classList.add('is-ok');
    } catch {
      status.textContent = 'Не удалось отправить заявку. Позвоните нам: +7 (495) 540-09-09.';
      status.classList.add('is-error');
    } finally {
      btn.disabled = false;
    }
  });
}

/* ---------- Куки ---------- */

const cookie = $('[data-cookie]');
if (cookie) {
  let accepted = false;
  try {
    accepted = localStorage.getItem('cookie-ok') === '1';
  } catch {}
  if (!accepted) setTimeout(() => (cookie.hidden = false), 1500);
  $('[data-cookie-ok]', cookie).addEventListener('click', () => {
    cookie.hidden = true;
    try {
      localStorage.setItem('cookie-ok', '1');
    } catch {}
  });
}

/* ---------- Анимации ---------- */

const fmt = (n, d) => n.toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });

function setupCounters() {
  $$('[data-count]').forEach((el) => {
    const target = parseFloat(el.dataset.count);
    const d = parseInt(el.dataset.decimals || '0', 10);
    const obj = { v: 0 };
    el.textContent = fmt(0, d);
    gsap.to(obj, {
      v: target,
      duration: 2.2,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      onUpdate: () => (el.textContent = fmt(obj.v, d)),
    });
  });

  // Шкала сроков 2024–2041: доля прошедшего времени
  const bar = $('[data-timeline]');
  if (bar) {
    const now = new Date().getFullYear() + new Date().getMonth() / 12;
    const part = Math.min(1, Math.max(0.02, (now - 2024) / (2041 - 2024)));
    gsap.fromTo(bar, { scaleX: 0 }, { scaleX: part, duration: 1.8, ease: 'power3.out', scrollTrigger: { trigger: bar, start: 'top 90%', once: true } });
  }
}

function setupHero() {
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.from('[data-hero-media]', { scale: 1.25, duration: 2.6 })
    .from('[data-hero-line]', { yPercent: 110, duration: 1.6, stagger: 0.12 }, 0.2)
    .from('[data-hero-fade]', { opacity: 0, y: 30, duration: 1.4, stagger: 0.15 }, 0.7)
    .from('.header', { opacity: 0, y: -20, duration: 1.2 }, 0.9);

  gsap.to('[data-hero-media]', {
    yPercent: 14,
    ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  });
}

function setupReveals() {
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 88%',
    once: true,
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', stagger: 0.1 }),
  });

  $$('[data-split]').forEach((el) => {
    if (el.closest('[data-emb-hero]')) return; // этот заголовок анимируется вместе с секцией
    gsap.to($$('.word > span', el), {
      yPercent: -5,
      y: 0,
      duration: 1.3,
      ease: 'expo.out',
      stagger: 0.06,
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });

  $$('[data-parallax]').forEach((el) => {
    const amount = parseFloat(el.dataset.parallax);
    gsap.fromTo(el, { yPercent: amount }, {
      yPercent: -amount,
      ease: 'none',
      scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });

  $$('[data-clip]').forEach((el) => {
    gsap.fromTo(el, { clipPath: 'inset(12% 8% 12% 8%)' }, {
      clipPath: 'inset(0% 0% 0% 0%)',
      ease: 'none',
      scrollTrigger: { trigger: el, start: 'top bottom', end: 'top 30%', scrub: true },
    });
  });
}

function setupArchitecture(mm) {
  mm.add('(min-width: 901px)', () => {
    const pin = $('[data-hscroll]');
    const track = $('[data-hscroll-track]');
    const progress = $('[data-hscroll-progress]');
    const distance = () => track.scrollWidth - window.innerWidth;

    const tween = gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: pin,
        start: 'center center',
        end: () => `+=${distance()}`,
        pin: true,
        scrub: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => gsap.set(progress, { scaleX: self.progress }),
      },
    });

    $$('[data-hscroll-img]', track).forEach((img) => {
      gsap.fromTo(img, { xPercent: 6 }, {
        xPercent: -6,
        ease: 'none',
        scrollTrigger: { trigger: img.closest('.arch__panel'), containerAnimation: tween, start: 'left right', end: 'right left', scrub: true },
      });
    });
  });
}

function setupEmbankment(mm) {
  const hero = $('[data-emb-hero]');
  const heroImg = $('[data-emb-hero-img]');
  const title = $('[data-split]', hero);

  gsap.fromTo(heroImg, { clipPath: 'inset(18% 14% 18% 14% round 12px)', scale: 1.2 }, {
    clipPath: 'inset(0% 0% 0% 0% round 0px)',
    scale: 1,
    ease: 'none',
    scrollTrigger: { trigger: hero, start: 'top bottom', end: 'top top', scrub: true },
  });
  gsap.to($$('.word > span', title), {
    y: 0,
    yPercent: -5,
    duration: 1.4,
    ease: 'expo.out',
    stagger: 0.08,
    scrollTrigger: { trigger: hero, start: 'top 20%', once: true },
  });

  const routeEl = $('[data-route]');
  const line = $('[data-route-line]');
  const pts = $$('[data-route-pt]');
  const cards = $$('[data-route-card]');
  const counter = $('[data-route-current]');
  const n = pts.length;
  let current = -1;

  const setActive = (i) => {
    if (i === current) return;
    current = i;
    pts.forEach((p, k) => {
      p.classList.toggle('is-active', k === i);
      p.classList.toggle('is-passed', k <= i);
    });
    cards.forEach((c, k) => c.classList.toggle('is-active', k === i));
    counter.textContent = String(i + 1).padStart(2, '0');
  };

  mm.add('(min-width: 901px)', () => {
    setActive(0);
    const st = ScrollTrigger.create({
      trigger: routeEl,
      start: 'top top',
      end: () => `+=${window.innerHeight * 3}`,
      pin: true,
      scrub: true,
      onUpdate: (self) => {
        gsap.set(line, { strokeDashoffset: 1 - self.progress });
        setActive(Math.min(n - 1, Math.floor(self.progress * n)));
      },
    });
    const onPt = (e) => {
      const i = Number(e.currentTarget.dataset.routePt);
      scrollToTarget(st.start + ((i + 0.5) / n) * (st.end - st.start));
    };
    pts.forEach((p) => p.addEventListener('click', onPt));
    return () => pts.forEach((p) => p.removeEventListener('click', onPt));
  });

  mm.add('(max-width: 900px)', () => {
    pts.forEach((p) => p.classList.add('is-passed'));
    gsap.fromTo(line, { strokeDashoffset: 1 }, {
      strokeDashoffset: 0,
      duration: 2.4,
      ease: 'power2.inOut',
      scrollTrigger: { trigger: routeEl, start: 'top 70%', once: true },
    });
  });
}

if (reduceMotion) {
  // Без анимаций показываем всё сразу: снимаем .js, от которого зависят скрытые стартовые состояния
  document.documentElement.classList.remove('js');
  $$('[data-route-line]').forEach((l) => (l.style.strokeDashoffset = '0'));
  $$('[data-route-pt]').forEach((p) => p.classList.add('is-passed'));
} else {
  const mm = gsap.matchMedia();
  setupHero();
  setupReveals();
  setupCounters();
  setupArchitecture(mm);
  setupEmbankment(mm);
  window.addEventListener('load', () => ScrollTrigger.refresh());
}
