/* =========================================================
   ZZ — portfolio
   原生 JavaScript，无依赖。按功能分块，方便你删改。
   ========================================================= */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, n) => a + (b - a) * n;
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE_POINTER = window.matchMedia('(pointer: fine)').matches;

  /* ---------------------------------------------------------
     0. 主题（先执行，避免闪白）
     --------------------------------------------------------- */
  const root = document.documentElement;
  const themeBtn = $('#themeBtn');
  const stored = localStorage.getItem('zz-theme');
  if (stored === 'light' || stored === 'dark') root.dataset.theme = stored;

  const isLight = () => root.dataset.theme === 'light';
  const syncThemeUI = () => {
    themeBtn?.setAttribute('aria-pressed', String(isLight()));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', isLight() ? '#f1eee6' : '#0b0b0c');
  };
  syncThemeUI();

  themeBtn?.addEventListener('click', () => {
    root.dataset.theme = isLight() ? 'dark' : 'light';
    localStorage.setItem('zz-theme', root.dataset.theme);
    syncThemeUI();
    window.dispatchEvent(new Event('themechange'));
  });

  /* ---------------------------------------------------------
     1. 载入动画
     --------------------------------------------------------- */
  const preloader = $('#preloader');
  const countEl = $('#count');
  const barEl = $('#preBar');

  const finishLoad = () => {
    document.body.classList.remove('is-loading');
    document.body.classList.add('is-ready');
    preloader?.classList.add('is-done');
    setTimeout(() => preloader?.remove(), 1400);
  };

  if (REDUCED || !preloader) {
    finishLoad();
  } else {
    document.body.classList.add('is-loading');
    const start = performance.now();
    const DURATION = 1500;
    const tick = (now) => {
      const p = clamp((now - start) / DURATION, 0, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = Math.round(eased * 100);
      if (countEl) countEl.textContent = String(val).padStart(2, '0');
      if (barEl) barEl.style.width = val + '%';
      if (p < 1) requestAnimationFrame(tick);
      else setTimeout(finishLoad, 260);
    };
    requestAnimationFrame(tick);
  }

  /* ---------------------------------------------------------
     2. 标题逐字拆解
     --------------------------------------------------------- */
  $$('[data-split]').forEach((el) => {
    let index = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          // 折叠空白：HTML 里的缩进换行不能变成可见空格
          let text = child.textContent.replace(/\s+/g, ' ');
          if (!text.trim()) { child.remove(); return; }
          if (index === 0) text = text.replace(/^ /, '');
          const frag = document.createDocumentFragment();
          [...text].forEach((ch) => {
            const span = document.createElement('span');
            span.className = 'ch' + (ch === ' ' ? ' ch--space' : '');
            span.textContent = ch === ' ' ? '\u00a0' : ch;
            span.style.setProperty('--i', index++);
            frag.appendChild(span);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1 && child.tagName !== 'BR') {
          walk(child);
        }
      });
    };
    walk(el);
  });

  /* ---------------------------------------------------------
     3. 自定义光标
     --------------------------------------------------------- */
  const cursor = $('#cursor');
  if (cursor && FINE_POINTER && !REDUCED) {
    document.body.classList.add('has-cursor');
    const dot = $('.cursor__dot', cursor);
    const ring = $('.cursor__ring', cursor);
    const label = document.createElement('span');
    label.className = 'cursor__label';
    cursor.appendChild(label);

    const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const ringPos = { ...mouse };
    let visible = false;

    window.addEventListener('pointermove', (e) => {
      mouse.x = e.clientX; mouse.y = e.clientY;
      if (!visible) { visible = true; cursor.classList.add('is-on'); }
      if (dot) dot.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;

      const el = e.target instanceof Element ? e.target : null;
      const target = el?.closest('[data-cursor]');
      if (target) {
        cursor.classList.add('is-hover');
        label.textContent = target.dataset.cursor || '';
      } else if (el?.closest('a, button')) {
        cursor.classList.add('is-hover');
        label.textContent = '';
      } else {
        cursor.classList.remove('is-hover');
      }
    }, { passive: true });

    window.addEventListener('pointerleave', () => cursor.classList.remove('is-on'));

    const loop = () => {
      ringPos.x = lerp(ringPos.x, mouse.x, 0.14);
      ringPos.y = lerp(ringPos.y, mouse.y, 0.14);
      if (ring) ring.style.transform =
        `translate(${ringPos.x}px, ${ringPos.y}px) translate(-50%, -50%)`;
      if (label) label.style.transform =
        `translate(${ringPos.x}px, ${ringPos.y}px) translate(-50%, -50%)`;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /* ---------------------------------------------------------
     4. 磁吸按钮
     --------------------------------------------------------- */
  if (FINE_POINTER && !REDUCED) {
    $$('[data-magnet]').forEach((el) => {
      const strength = 0.28;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
      });
      el.addEventListener('pointerleave', () => {
        el.style.transition = 'transform .6s cubic-bezier(.16,1,.3,1)';
        el.style.transform = 'translate(0,0)';
        setTimeout(() => { el.style.transition = ''; }, 620);
      });
    });
  }

  /* ---------------------------------------------------------
     5. 滚动：进度条 / 导航 / 出场
     --------------------------------------------------------- */
  const progress = $('#scrollProgress');
  const nav = $('#nav');
  let lastY = window.scrollY;

  const onScroll = () => {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;

    nav?.classList.toggle('is-solid', y > 40);
    if (nav && !REDUCED) {
      const goingDown = y > lastY && y > 320;
      nav.classList.toggle('is-hidden', goingDown);
    }
    lastY = y;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('in-view');
      io.unobserve(en.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

  const reveals = $$('[data-reveal]');
  reveals.forEach((el, i) => {
    el.style.setProperty('--d', `${Math.min(i, 6) * 60}ms`);
    io.observe(el);
  });

  /* 兜底：万一 IntersectionObserver 不可用或没触发，就按位置手动显示 */
  const revealInView = () => {
    $$('[data-reveal]:not(.in-view)').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.94 && r.bottom > -40) {
        el.classList.add('in-view');
        io.unobserve(el);
      }
    });
    $$('.pills:not(.in-view)').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.94 && r.bottom > -40) el.classList.add('in-view');
    });
  };
  window.addEventListener('scroll', revealInView, { passive: true });
  window.addEventListener('resize', revealInView);
  setTimeout(revealInView, 600);

  $$('.pills').forEach((ul) => {
    [...ul.children].forEach((li, i) => {
      li.style.transitionDelay = `${i * 70}ms`;
    });
  });

  /* ---------------------------------------------------------
     6. 时钟
     --------------------------------------------------------- */
  const clockEl = $('#clock');
  if (clockEl) {
    const fmt = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit',
      second: '2-digit', hour12: false
    });
    const tickClock = () => { clockEl.textContent = fmt.format(new Date()); };
    tickClock();
    setInterval(tickClock, 1000);
  }

  /* ---------------------------------------------------------
     7. Canvas 生成艺术（作品缩略图）
     --------------------------------------------------------- */
  let palCache = null;
  const palette = () => {
    if (palCache) return palCache;
    const cs = getComputedStyle(root);
    const pick = (v, fb) => {
      const val = cs.getPropertyValue(v).trim() || fb;
      return val.startsWith('#') ? val : fb;
    };
    palCache = {
      bg: pick('--bg-soft', '#111113'),
      fg: pick('--fg', '#f2efe8'),
      accent: pick('--accent', '#c8ff4d'),
      light: root.dataset.theme === 'light'
    };
    return palCache;
  };
  const invalidatePalette = () => { palCache = null; };

  const hexToRgb = (hex) => {
    const h = hex.replace('#', '');
    const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const n = parseInt(v, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const rgba = (hex, a) => `rgba(${hexToRgb(hex).join(',')},${a})`;

  /* 流场推进一步 */
  const stepFlow = (ctx, w, h, t, P) => {
    ctx.lineWidth = 1;
    for (const p of ctx._parts) {
      const ang = Math.sin(p.x * 0.0045 + t * 0.00018) * Math.PI * 1.4 +
                  Math.cos(p.y * 0.0062 - t * 0.00013) * Math.PI;
      p.px = p.x; p.py = p.y;
      p.x += Math.cos(ang) * 1.35;
      p.y += Math.sin(ang) * 1.35;
      if (p.x < 0 || p.x > w || p.y < 0 || p.y > h) {
        p.x = Math.random() * w; p.y = Math.random() * h;
        continue;
      }
      ctx.strokeStyle = rgba(P.accent, 0.30);
      ctx.beginPath(); ctx.moveTo(p.px, p.py); ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.strokeStyle = rgba(P.fg, 0.09);
      ctx.beginPath(); ctx.moveTo(p.px, p.py); ctx.lineTo(p.x, p.y); ctx.stroke();
    }
  };

  const ART = {
    /* 流场：粒子沿噪声方向漂移，留下尾迹 */
    flow(ctx, w, h, t, P) {
      const N = 300;
      const first = !ctx._parts || ctx._parts.length !== N;
      if (first) {
        ctx.fillStyle = P.bg;
        ctx.fillRect(0, 0, w, h);
        ctx._parts = Array.from({ length: N }, () => ({
          x: Math.random() * w, y: Math.random() * h, px: 0, py: 0
        }));
        // 预热，让画布一出现就是「有东西」的状态
        ctx.globalCompositeOperation = P.light ? 'source-over' : 'lighter';
        for (let k = 80; k > 0; k--) stepFlow(ctx, w, h, t - k * 16, P);
        ctx.globalCompositeOperation = 'source-over';
        return;
      }
      ctx.fillStyle = rgba(P.bg, 0.07);
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = P.light ? 'source-over' : 'lighter';
      stepFlow(ctx, w, h, t, P);
      ctx.globalCompositeOperation = 'source-over';
    },

    /* 波形：叠加正弦线，扫描式相位 */
    wave(ctx, w, h, t) {
      const P = palette();
      ctx.clearRect(0, 0, w, h);
      const rows = 18;
      for (let i = 0; i < rows; i++) {
        const yBase = (i / (rows - 1)) * h;
        const amp = (h * 0.052) * (0.35 + Math.sin(i * 0.6 + t * 0.0012) * 0.65 + 1) * 0.5;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 4) {
          const ph = x * 0.011 + t * 0.0012 + i * 0.34;
          const y = yBase + Math.sin(ph) * amp + Math.sin(ph * 2.7 + i) * amp * 0.24;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        const strong = i % 6 === 2;
        ctx.strokeStyle = strong ? rgba(P.accent, 0.85) : rgba(P.fg, P.light ? 0.16 : 0.2);
        ctx.lineWidth = strong ? 1.6 : 1;
        ctx.stroke();
      }
    },

    /* 摩尔纹：两组同心圆干涉 */
    moire(ctx, w, h, t) {
      const P = palette();
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      const off = Math.sin(t * 0.0009) * w * 0.06;
      ctx.lineWidth = 1;
      for (let k = 0; k < 2; k++) {
        const ox = k === 0 ? cx + off : cx - off;
        const oy = k === 0 ? cy + off * 0.4 : cy - off * 0.4;
        ctx.strokeStyle = k === 0 ? rgba(P.fg, P.light ? 0.28 : 0.34) : rgba(P.accent, 0.5);
        for (let r = 6; r < Math.hypot(w, h) * 0.62; r += 11) {
          ctx.beginPath();
          ctx.arc(ox, oy, r, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.fillStyle = rgba(P.accent, 0.9);
      ctx.beginPath();
      ctx.arc(cx, cy, 3.2, 0, Math.PI * 2);
      ctx.fill();
    },

    /* 点阵：从中心扩散的波纹 */
    dots(ctx, w, h, t) {
      const P = palette();
      ctx.clearRect(0, 0, w, h);
      const step = 22;
      const cx = w / 2, cy = h / 2;
      for (let x = step / 2; x < w; x += step) {
        for (let y = step / 2; y < h; y += step) {
          const d = Math.hypot(x - cx, y - cy);
          const wave = Math.sin(d * 0.028 - t * 0.0022);
          const r = 1.1 + Math.max(0, wave) * 3.4;
          const a = 0.12 + Math.max(0, wave) * 0.7;
          ctx.fillStyle = wave > 0.55 ? rgba(P.accent, a) : rgba(P.fg, a * 0.8);
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  };

  const artInstances = [];

  $$('canvas[data-art]').forEach((canvas) => {
    const type = canvas.dataset.art;
    const draw = ART[type];
    if (!draw) return;

    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, dpr = 1;
    const state = { canvas, ctx, w, h, visible: false, started: performance.now() };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width; h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx._parts = null; // 让流场重新撒粒子
      state.w = w; state.h = h;
      invalidatePalette();
      // 首帧（也用于 reduced-motion 的静态图）
      draw(ctx, w, h, REDUCED ? 1200 : performance.now() - state.started, palette());
    };

    new ResizeObserver(resize).observe(canvas);
    resize();

    const vio = new IntersectionObserver(([en]) => {
      state.visible = en.isIntersecting;
    }, { threshold: 0.05 });
    vio.observe(canvas);

    artInstances.push(state);
  });

  /* ---------------------------------------------------------
     8. 统一的渲染循环（作品缩略图，仅可见 + 悬停时加速）
     --------------------------------------------------------- */
  if (!REDUCED) {
    const loop = (now) => {
      artInstances.forEach((s) => {
        if (!s.visible || s.w === 0) return;
        ART[s.canvas.dataset.art](s.ctx, s.w, s.h, now - s.started, palette());
      });
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  window.addEventListener('themechange', () => {
    invalidatePalette();
    artInstances.forEach((s) => {
      if (!s.w) return;
      s.ctx._parts = null;
      s.ctx.clearRect(0, 0, s.w, s.h);
      ART[s.canvas.dataset.art](s.ctx, s.w, s.h, 1200, palette());
    });
  });

  /* ---------------------------------------------------------
     10. 复制邮箱
     --------------------------------------------------------- */
  const toast = $('#toast');
  const showToast = (msg) => {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('is-on');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('is-on'), 2000);
  };

  const mailBtn = $('#mailBtn');
  mailBtn?.addEventListener('click', async () => {
    const mail = '2930316366@qq.com';
    try {
      await navigator.clipboard.writeText(mail);
      showToast('邮箱已复制 · ' + mail);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = mail; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
      showToast('邮箱已复制 · ' + mail);
    }
  });

  /* ---------------------------------------------------------
     11. 彩蛋：G 键混沌模式
     --------------------------------------------------------- */
  const chaosBtn = $('#chaosBtn');
  const toggleChaos = () => {
    const on = document.body.classList.toggle('chaos');
    chaosBtn?.setAttribute('aria-pressed', String(on));
    if (on) showToast('混沌模式：开。再按一次关掉。');
  };
  chaosBtn?.addEventListener('click', toggleChaos);
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (document.activeElement?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    if (e.key.toLowerCase() === 'g') toggleChaos();
  });

  /* ---------------------------------------------------------
     12. 视频灯箱（B 站内嵌播放器，零带宽成本）
     --------------------------------------------------------- */
  const lightbox = $('#lightbox');
  const lbFrame = $('#lbFrame');
  const lbCap = $('#lbCap');
  const lbClose = $('#lbClose');
  let lastFocused = null;

  const openVideo = (bv, title, trigger) => {
    if (!lightbox || !lbFrame) return;
    lastFocused = trigger || document.activeElement;
    lbFrame.src = `https://player.bilibili.com/player.html?bvid=${bv}&page=1&high_quality=1&danmaku=1&autoplay=1`;
    if (lbCap) lbCap.textContent = title || '';
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    lightbox.focus({ preventScroll: true });
  };

  const closeVideo = () => {
    if (!lightbox || !lightbox.classList.contains('is-open')) return;
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    // 清空 src 才会真的停止播放
    setTimeout(() => { if (lbFrame) lbFrame.src = 'about:blank'; }, 380);
    lastFocused?.focus?.({ preventScroll: true });
  };

  $$('[data-video]').forEach((card) => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      openVideo(card.dataset.video, card.dataset.videoTitle, card);
    });
  });
  lbClose?.addEventListener('click', closeVideo);
  lightbox?.addEventListener('click', (e) => {
    if (e.target === lightbox) closeVideo();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeVideo();
  });

  /* ---------------------------------------------------------
     13. 年份
     --------------------------------------------------------- */
  const yearEl = $('.foot__row span');
  if (yearEl) yearEl.textContent = `© ${new Date().getFullYear()} 卓正`;
})();




