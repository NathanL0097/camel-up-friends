(() => {
  const names=new Set(['crown','chalice','sword','eye','seal','dice','coin','chip','train','move','floor','attack','bag','jewel','star','candle','scales','moon','cat','camel','pyramid']);
  window.GameArt=Object.freeze({icon(name){return `<svg class="game-mark" aria-hidden="true" focusable="false" viewBox="0 0 64 64"><use href="/assets/game-marks.svg#${names.has(name)?name:'seal'}"></use></svg>`;}});
})();
