/**
 * A picture shown big, over everything (tap one in the Gallery). Tap anywhere or press Escape to
 * close it; Escape closes just the picture, not the card underneath.
 */
export class Lightbox {
  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'lightbox';
    this.el.hidden = true;
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.setAttribute('aria-label', 'Picture');
    this.el.innerHTML = `
      <img class="lightbox__img" alt="" />
      <button type="button" class="lightbox__x" aria-label="Close the picture">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" /></svg>
      </button>`;
    document.body.append(this.el);
    this.img = this.el.querySelector('img');
    this.el.addEventListener('click', () => this.close());
    // (capturing, so it gets Escape before the card does)
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.key !== 'Escape' || !this.isOpen) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        this.close();
      },
      true,
    );
  }

  get isOpen() {
    return !this.el.hidden;
  }

  open(img) {
    this.img.src = img.currentSrc || img.src;
    this.img.alt = img.alt;
    this.returnTo = img;
    this.el.hidden = false;
    this.el.querySelector('button').focus({ preventScroll: true });
  }

  close() {
    if (!this.isOpen) return;
    this.el.hidden = true;
    this.img.removeAttribute('src');
    this.returnTo?.focus?.({ preventScroll: true });
    this.returnTo = null;
  }
}
