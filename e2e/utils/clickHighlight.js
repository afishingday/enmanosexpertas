// Se inyecta en cada página (context.addInitScript) para que, en el video,
// quede visible dónde se hace cada click (mouse real o simulado por Playwright).
// Puramente visual: pointer-events:none, no interfiere con la interacción.
export const CLICK_HIGHLIGHT_SCRIPT = `(() => {
  const STYLE_ID = '__pw_click_highlight_style__';
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = \`
    .__pw_click_ripple__ {
      position: fixed; z-index: 2147483647; pointer-events: none;
      width: 40px; height: 40px; margin-left: -20px; margin-top: -20px;
      border-radius: 50%; background: rgba(242,169,0,.5);
      border: 3px solid rgba(242,169,0,.95);
      transform: scale(.25); opacity: 1;
      transition: transform .5s cubic-bezier(.2,.7,.3,1), opacity .5s ease-out;
    }
    .__pw_click_dot__ {
      position: fixed; z-index: 2147483647; pointer-events: none;
      width: 10px; height: 10px; margin-left: -5px; margin-top: -5px;
      border-radius: 50%; background: #F2A900;
      box-shadow: 0 0 0 2px #fff, 0 1px 4px rgba(0,0,0,.5);
    }
  \`;
  document.head.appendChild(style);

  function ping(x, y) {
    const ripple = document.createElement('div');
    ripple.className = '__pw_click_ripple__';
    ripple.style.left = x + 'px'; ripple.style.top = y + 'px';
    document.body.appendChild(ripple);
    requestAnimationFrame(() => {
      ripple.style.transform = 'scale(1)';
      ripple.style.opacity = '0';
    });
    setTimeout(() => ripple.remove(), 550);

    const dot = document.createElement('div');
    dot.className = '__pw_click_dot__';
    dot.style.left = x + 'px'; dot.style.top = y + 'px';
    document.body.appendChild(dot);
    setTimeout(() => dot.remove(), 260);
  }

  window.addEventListener('mousedown', (e) => ping(e.clientX, e.clientY), true);
  window.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    if (t) ping(t.clientX, t.clientY);
  }, true);
})();`
