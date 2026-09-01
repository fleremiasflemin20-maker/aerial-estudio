(() => {
  'use strict';

  gsap.registerPlugin(ScrollTrigger);

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Smooth scroll (Lenis) synced to GSAP's ticker ----------
  let lenis = null;
  function initSmoothScroll() {
    if (prefersReducedMotion || typeof Lenis === 'undefined') return;
    lenis = new Lenis({
      duration: 1.05,
      easing: (t) => 1 - Math.pow(1 - t, 3),
      smoothWheel: true,
      autoRaf: false
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  const FRAME_COUNT = 241;
  const FRAME_PATH = (i) => `frames/frame_${String(i).padStart(3, '0')}.jpg`;

  const loader = document.getElementById('loader');
  const loaderFill = document.getElementById('loaderFill');
  const main = document.getElementById('main');
  const canvas = document.getElementById('heroCanvas');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('heroOverlay');

  const images = new Array(FRAME_COUNT);
  let loadedCount = 0;

  const state = {
    frame: 0,          // frame currently drawn
    targetFrame: 0,     // frame requested by scroll progress
    dpr: Math.min(window.devicePixelRatio || 1, 2),
    canvasW: 0,
    canvasH: 0
  };

  // ---------- Preload ----------
  function preloadImages(onComplete) {
    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = new Image();
      img.onload = img.onerror = () => {
        loadedCount++;
        const pct = Math.round((loadedCount / FRAME_COUNT) * 100);
        loaderFill.style.width = pct + '%';
        if (loadedCount === FRAME_COUNT) onComplete();
      };
      img.src = FRAME_PATH(i + 1);
      images[i] = img;
    }
  }

  // ---------- Canvas sizing (object-fit: cover) ----------
  function resizeCanvas() {
    state.canvasW = window.innerWidth;
    state.canvasH = window.innerHeight;
    canvas.width = state.canvasW * state.dpr;
    canvas.height = state.canvasH * state.dpr;
    canvas.style.width = state.canvasW + 'px';
    canvas.style.height = state.canvasH + 'px';
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    drawFrame(state.frame, true);
  }

  function drawFrame(index, force) {
    if (!force && index === state.frame && state._drawn) return;
    const img = images[index];
    if (!img || !img.complete || img.naturalWidth === 0) return;

    const cw = state.canvasW;
    const ch = state.canvasH;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    // cover: scale image to fill canvas, cropping overflow
    const scale = Math.max(cw / iw, ch / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;

    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, dx, dy, dw, dh);

    state.frame = index;
    state._drawn = true;
  }

  // ---------- rAF render loop: only draws when target frame changes ----------
  let rafId = null;
  function renderLoop() {
    if (state.targetFrame !== state.frame) {
      drawFrame(state.targetFrame, false);
    }
    rafId = requestAnimationFrame(renderLoop);
  }

  // ---------- Debounce ----------
  function debounce(fn, wait) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  // ---------- Scroll-driven sequence ----------
  function initSequence() {
    resizeCanvas();
    drawFrame(0, true);
    rafId = requestAnimationFrame(renderLoop);

    ScrollTrigger.create({
      trigger: '#hero',
      start: 'top top',
      end: '+=300%',
      pin: true,
      scrub: true,
      anticipatePin: 1,
      onUpdate: (self) => {
        const idx = Math.round(self.progress * (FRAME_COUNT - 1));
        state.targetFrame = Math.max(0, Math.min(FRAME_COUNT - 1, idx));

        const fadeProgress = Math.min(self.progress / 0.33, 1);
        overlay.style.opacity = String(1 - fadeProgress);
      }
    });

    window.addEventListener('resize', debounce(() => {
      resizeCanvas();
      ScrollTrigger.refresh();
    }, 200));
  }

  // ---------- Panel reveal animations (staggered children) ----------
  function initPanelReveals() {
    document.querySelectorAll('.panel__inner').forEach((el) => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: el,
          start: 'top 78%',
          toggleActions: 'play none none reverse'
        }
      });
      tl.to(el, { opacity: 1, duration: 0.6, ease: 'power2.out' })
        .to(el.children, { y: 0, duration: 0.85, ease: 'power2.out', stagger: 0.12 }, '<');
    });
  }

  // ---------- Line-art illustrations: draw on scroll ----------
  function initLineArt() {
    document.querySelectorAll('.panel__visual').forEach((visual) => {
      const draws = visual.querySelectorAll('.draw');
      const dots = visual.querySelectorAll('.fill-dot');
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: visual,
          start: 'top 80%',
          end: 'top 25%',
          scrub: 0.6
        }
      });
      if (draws.length) tl.to(draws, { strokeDashoffset: 0, ease: 'none', stagger: 0.15 });
      if (dots.length) tl.to(dots, { opacity: 1, ease: 'none', stagger: 0.08 }, '<0.2');
    });
  }

  // ---------- Big background numerals: subtle parallax ----------
  function initBigNumParallax() {
    document.querySelectorAll('.panel__bignum').forEach((el) => {
      const amount = parseFloat(el.dataset.parallax || '0.15') * 100;
      gsap.to(el, {
        yPercent: amount,
        ease: 'none',
        scrollTrigger: {
          trigger: el.closest('.panel'),
          start: 'top bottom',
          end: 'bottom top',
          scrub: true
        }
      });
    });
  }

  // ---------- Custom cursor ----------
  function initCustomCursor() {
    if (prefersReducedMotion) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const dot = document.getElementById('cursorDot');
    if (!dot) return;

    const moveX = gsap.quickTo(dot, 'x', { duration: 0.35, ease: 'power3' });
    const moveY = gsap.quickTo(dot, 'y', { duration: 0.35, ease: 'power3' });

    window.addEventListener('mousemove', (e) => {
      if (!dot.classList.contains('is-active')) {
        dot.classList.add('is-active');
        document.body.classList.add('has-cursor');
      }
      moveX(e.clientX);
      moveY(e.clientY);
    });

    document.querySelectorAll('a, button, .hero__scrollcue').forEach((el) => {
      el.addEventListener('mouseenter', () => dot.classList.add('is-hover'));
      el.addEventListener('mouseleave', () => dot.classList.remove('is-hover'));
    });
  }

  // ---------- Places carousel: active-card highlight + drag/wheel scroll ----------
  function initPlacesCarousel() {
    const track = document.getElementById('placesTrack');
    if (!track) return;

    const cards = Array.from(track.querySelectorAll('.place-card'));
    const prevBtn = document.getElementById('placesPrev');
    const nextBtn = document.getElementById('placesNext');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle('is-active', entry.intersectionRatio > 0.6);
      });
    }, { root: track, threshold: [0, 0.6, 1] });

    cards.forEach((card) => observer.observe(card));
    cards[0].classList.add('is-active');

    // Let vertical wheel scroll drive the horizontal track while hovering it.
    track.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      track.scrollLeft += e.deltaY;
    }, { passive: false });

    function scrollByCard(dir) {
      const card = cards[0];
      const amount = (card.getBoundingClientRect().width + 24) * dir;
      track.scrollBy({ left: amount, behavior: 'smooth' });
    }

    if (prevBtn) prevBtn.addEventListener('click', () => scrollByCard(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => scrollByCard(1));
  }

  // ---------- Boot ----------
  initSmoothScroll();
  initCustomCursor();

  preloadImages(() => {
    loader.classList.add('is-hidden');
    main.classList.remove('hidden');
    initSequence();
    initPanelReveals();
    initLineArt();
    initBigNumParallax();
    initPlacesCarousel();
    ScrollTrigger.refresh();
  });
})();
