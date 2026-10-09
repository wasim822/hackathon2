// "Visit [Company]'s official website?" prompt. Opening a site only ever
// happens inside the Yes button's click handler (a direct user gesture).

export class WebsiteModal {
  constructor(root) {
    this.root = root;
    this.titleEl = root.querySelector('#modal-title');
    this.msgEl = root.querySelector('#modal-msg');
    this.urlEl = root.querySelector('#modal-url');
    this.yes = root.querySelector('#modal-yes');
    this.no = root.querySelector('#modal-no');
    this.brand = null;
    this.onClose = null;
    this.yes.addEventListener('click', () => {
      if (!this.brand) return;
      window.open(this.brand.url, '_blank', 'noopener,noreferrer');
      this.close();
    });
    this.no.addEventListener('click', () => this.close());
    window.addEventListener('keydown', (e) => {
      if (this.isOpen && e.code === 'Escape') { e.preventDefault(); this.close(); }
    });
  }

  get isOpen() { return !!this.brand; }

  open(brand, onClose) {
    this.brand = brand;
    this.onClose = onClose;
    this.titleEl.textContent = brand.name;
    // "McDonald's" already carries the possessive
    const owner = /'s$/.test(brand.name) ? brand.name : `${brand.name}'s`;
    this.msgEl.textContent = `Visit ${owner} official website?`;
    this.urlEl.textContent = brand.url.replace(/^https?:\/\//, '');
    this.root.classList.add('open');
    this.root.setAttribute('aria-hidden', 'false');
    setTimeout(() => this.no.focus(), 0);
  }

  close() {
    if (!this.brand) return;
    const cb = this.onClose;
    this.brand = null;
    this.onClose = null;
    this.root.classList.remove('open');
    this.root.setAttribute('aria-hidden', 'true');
    this.no.blur(); this.yes.blur();
    cb?.();
  }
}
