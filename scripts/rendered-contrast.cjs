// Called by phone-sized browser QA; measures the final cascade, including disabled opacity.
exports.renderedContrast = function () {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const color = value => {
    ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1);
    return [...ctx.getImageData(0, 0, 1, 1).data].map((v, i) => i === 3 ? v / 255 : v);
  };
  const over = (top, base) => top.slice(0, 3).map((v, i) => v * top[3] + base[i] * (1 - top[3]));
  const lum = c => c.map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; })
    .reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
  const ratio = (a, b) => (Math.max(lum(a), lum(b)) + .05) / (Math.min(lum(a), lum(b)) + .05);
  const results = [], walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode, el = node.parentElement, text = node.textContent.trim();
    if (!text || !el || el.closest('svg,script,style,[aria-hidden="true"]') || !el.getClientRects().length) continue;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || !el.checkVisibility({ visibilityProperty: true })) continue;
    if (el.closest('details:not([open])') && !el.closest('summary')) continue;
    const ancestors = []; let parent = el;
    while (parent) { ancestors.unshift(parent); parent = parent.parentElement; }
    let backgrounds = [[255, 255, 255]], opacity = 1;
    for (const ancestor of ancestors) {
      const css = getComputedStyle(ancestor); opacity *= Number(css.opacity);
      backgrounds = backgrounds.map(base => over(color(css.backgroundColor), base));
      if (css.backgroundImage.includes('gradient(')) {
        const layers = []; let depth = 0, start = 0;
        for (let i = 0; i < css.backgroundImage.length; i++) {
          if (css.backgroundImage[i] === '(') depth++;
          if (css.backgroundImage[i] === ')') depth--;
          if (css.backgroundImage[i] === ',' && depth === 0) { layers.push(css.backgroundImage.slice(start, i)); start = i + 1; }
        }
        layers.push(css.backgroundImage.slice(start));
        for (const layer of layers.reverse()) {
          const stops = layer.match(/rgba?\([^)]*\)|color\([^)]*\)/g) ?? [];
          if (stops.length) backgrounds = backgrounds.flatMap(base => stops.map(stop => over(color(stop), base))).slice(-64);
        }
      }
      if (ancestor.classList.contains('bike-timer-ring')) {
        const inset = getComputedStyle(ancestor, '::after');
        backgrounds = backgrounds.map(base => over(color(inset.backgroundColor), base));
      }
    }
    if (opacity < .05) continue;
    const foreground = color(style.color); foreground[3] *= opacity;
    const contrast = Math.min(...backgrounds.map(bg => ratio(over(foreground, bg), bg)));
    const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700);
    results.push({ text: text.slice(0, 100), contrast: +contrast.toFixed(2), required: large ? 3 : 4.5,
      tag: el.tagName, className: el.className, color: style.color, opacity, disabled: Boolean(el.closest(':disabled')) });
  }
  return { results, failures: results.filter(row => row.contrast < row.required),
    overflow: document.documentElement.scrollWidth > innerWidth };
};
