import { Component } from '@theme/component';
import { sectionRenderer } from '@theme/section-renderer';
import { CartLinesUpdateEvent } from '@shopify/events';

/** Collection products remain independent Shopify products; only their presentation is grouped. */
class CarpeCollectionOrder extends Component {
  #observer;
  #pageController;
  #cartController;
  #busy = false;
  #uncertain = false;
  #messages = {};

  connectedCallback() {
    super.connectedCallback();
    this.#initialize();
  }

  updatedCallback() {
    super.updatedCallback();
    this.#pageController?.abort();
    this.#pageController = undefined;
    this.#initialize();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#observer?.disconnect();
    this.#pageController?.abort();
    // An aborted POST may already have reached Shopify. Never silently submit it again.
    if (this.#busy) this.#uncertain = true;
    this.#cartController?.abort();
  }

  #initialize() {
    this.#messages = JSON.parse(this.querySelector('[data-order-messages]')?.textContent || '{}');
    this.setAttribute('data-enhanced', '');
    this.#updateSelection();
    this.#observeNext();
  }

  get quantities() {
    return [...this.querySelectorAll('[data-order-quantity]')];
  }

  #status(message) {
    const status = this.querySelector('[data-order-status]');
    if (status) status.textContent = message;
  }

  #updateSelection() {
    const inputs = this.quantities;
    const total = inputs.reduce((sum, input) => sum + Math.max(0, Number(input.value) || 0), 0);
    const count = this.querySelector('[data-order-count]');
    if (count) count.textContent = String(total);
    const submit = this.querySelector('[data-order-submit]');
    if (submit) submit.disabled = this.#busy || this.#uncertain || total === 0;
    const clear = this.querySelector('[data-order-clear]');
    if (clear) clear.disabled = this.#busy;
    for (const control of this.querySelectorAll('.carpe-order__quantity button, [data-order-quantity]')) {
      control.disabled = this.#busy || this.#uncertain;
    }
    this.setAttribute('aria-busy', String(this.#busy));
  }

  /** @param {Event} event */
  quantityChanged(event) {
    if (!(event.target instanceof HTMLInputElement)) return;
    event.target.setCustomValidity('');
    this.#status('');
    this.#updateSelection();
  }

  /** @param {MouseEvent} event */
  adjustQuantity(event) {
    if (this.#busy || this.#uncertain || !(event.target instanceof HTMLElement)) return;
    const button = event.target.closest('[data-delta]');
    const input = button?.closest('[data-order-row]')?.querySelector('[data-order-quantity]');
    if (!(input instanceof HTMLInputElement)) return;
    const minimum = Number(input.dataset.min) || 1;
    const step = Number(input.dataset.step) || 1;
    const maximum = input.max === '' ? Infinity : Number(input.max);
    const current = Math.max(0, Number(input.value) || 0);
    const delta = Number(button.dataset.delta);
    let next = 0;
    if (delta > 0) next = current < minimum ? minimum : minimum + (Math.floor((current - minimum) / step) + 1) * step;
    else if (current > minimum) next = minimum + (Math.ceil((current - minimum) / step) - 1) * step;
    if (next > maximum) return;
    input.value = String(next);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  clearSelection() {
    if (this.#busy) return;
    for (const input of this.quantities) {
      input.value = '0';
      input.setCustomValidity('');
    }
    this.#uncertain = false;
    this.#status('');
    this.#updateSelection();
  }

  #observeNext() {
    this.#observer?.disconnect();
    const next = this.querySelector('[data-order-next]');
    if (this.dataset.autoLoad !== 'true' || !next?.hasAttribute('href') || !('IntersectionObserver' in window)) return;
    this.#observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) this.loadMore();
    }, { rootMargin: '0px 0px 160px 0px' });
    this.#observer.observe(next);
  }

  /** Append only rows: never morph the inputs holding the shopper's selections.
   * @param {MouseEvent} [event]
   */
  async loadMore(event) {
    event?.preventDefault();
    const next = this.querySelector('[data-order-next]');
    if (!next?.hasAttribute('href') || this.#pageController) return;
    this.#observer?.disconnect();
    const controller = new AbortController();
    this.#pageController = controller;
    next.setAttribute('aria-disabled', 'true');
    const status = this.querySelector('[data-load-status]');
    if (status) status.textContent = this.#messages.loading;
    let success = false;
    try {
      const url = new URL(next.href, location.href);
      if (url.origin !== location.origin) throw new Error('Unexpected pagination origin');
      const html = await sectionRenderer.getSectionHTML(this.dataset.sectionId, false, url, controller.signal);
      if (controller.signal.aborted || !this.isConnected) return;
      const parsed = new DOMParser().parseFromString(html, 'text/html');
      const incoming = parsed.getElementById(this.id);
      const rows = incoming?.querySelectorAll('[data-order-row]');
      if (!rows?.length) throw new Error('Missing product rows');
      const existing = new Set([...this.querySelectorAll('[data-order-row]')].map((row) => row.dataset.productId));
      const fragment = document.createDocumentFragment();
      for (const row of rows) {
        if (!existing.has(row.dataset.productId)) {
          fragment.append(row);
          existing.add(row.dataset.productId);
        }
      }
      this.querySelector('[data-order-rows]')?.append(fragment);
      const following = incoming.querySelector('[data-order-next]');
      if (following?.hasAttribute('href') && following.getAttribute('href') !== next.getAttribute('href')) {
        next.setAttribute('href', following.getAttribute('href'));
      } else {
        next.removeAttribute('href');
        next.hidden = true;
        // Don't strand keyboard focus on a link that just disappeared.
        if (document.activeElement === next) this.querySelector('[data-order-clear]')?.focus();
      }
      if (status) status.textContent = '';
      this.#updateSelection();
      success = true;
    } catch (error) {
      if (error.name !== 'AbortError' && status) status.textContent = this.#messages.loadError;
    } finally {
      if (this.#pageController === controller) this.#pageController = undefined;
      next.removeAttribute('aria-disabled');
      // A failure waits for an explicit retry instead of a scroll-triggered request loop.
      if (success && this.isConnected) this.#observeNext();
    }
  }

  async #readCart(signal) {
    const response = await fetch(this.dataset.cartUrl, { cache: 'no-store', signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Cart refresh failed');
    return response.json();
  }

  async addSelected() {
    if (this.#busy || this.#uncertain) return;
    const items = [];
    for (const input of this.quantities) {
      const quantity = input.value === '' ? 0 : Number(input.value);
      const minimum = Number(input.dataset.min) || 1;
      const step = Number(input.dataset.step) || 1;
      const maximum = input.max === '' ? Infinity : Number(input.max);
      const valid = Number.isSafeInteger(quantity) && quantity >= 0 &&
        (quantity === 0 || (quantity >= minimum && quantity <= maximum && (quantity - minimum) % step === 0));
      if (!valid || input.validity.badInput) {
        input.setCustomValidity(this.#messages.invalid);
        input.reportValidity();
        input.focus();
        return;
      }
      input.setCustomValidity('');
      if (quantity > 0) items.push({ id: Number(input.dataset.variantId), quantity });
    }
    if (!items.length) return;
    this.#busy = true;
    this.#updateSelection();
    this.#status(this.#messages.adding);
    const controller = new AbortController();
    this.#cartController = controller;
    const timeout = setTimeout(() => controller.abort(), 30000);
    const deferred = CartLinesUpdateEvent.createPromise();
    // Also observe rejection when no cart components are mounted.
    deferred.promise.catch(() => {});
    this.dispatchEvent(new CartLinesUpdateEvent({
      action: 'add', context: 'product',
      lines: items.map((item) => ({ merchandiseId: String(item.id), quantity: item.quantity })),
      promise: deferred.promise,
    }));
    let added = false;
    try {
      const sections = [...new Set([...document.querySelectorAll('cart-items-component')]
        .map((component) => component.dataset.sectionId).filter(Boolean))].slice(0, 5);
      const response = await fetch(this.dataset.addUrl, {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items, sections: sections.join(','), sections_url: location.pathname + location.search }),
      });
      const result = await response.json();
      if (!response.ok || result.status) throw new Error(typeof result.description === 'string' ? result.description : '');
      added = true;
      // Clear immediately after confirmed success even if the follow-up cart GET fails.
      for (const input of this.quantities) input.value = '0';
      const cart = await this.#readCart(controller.signal);
      deferred.resolve({
        cart: CartLinesUpdateEvent.createCartFromAjaxResponse(cart),
        detail: {
          source: 'carpe-collection-order', sourceId: this.id, items: cart.items,
          itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
          sections: result.sections, didError: false,
        },
      });
      this.#status(this.#messages.success);
    } catch (error) {
      this.#uncertain = !added;
      this.#status(added ? this.#messages.syncError : this.#messages.cartError);
      // Shopify can partially change a cart on an error. Reconcile it, but never retry the POST.
      if (!controller.signal.aborted) {
        try {
          const cart = await this.#readCart(controller.signal);
          deferred.resolve({
            cart: CartLinesUpdateEvent.createCartFromAjaxResponse(cart),
            detail: { source: 'carpe-collection-order', sourceId: this.id, items: cart.items, didError: true },
          });
        } catch (refreshError) {
          deferred.reject(refreshError);
        }
      } else deferred.reject(error);
    } finally {
      clearTimeout(timeout);
      this.#cartController = undefined;
      this.#busy = false;
      this.#updateSelection();
    }
  }
}

if (!customElements.get('carpe-collection-order-component')) {
  customElements.define('carpe-collection-order-component', CarpeCollectionOrder);
}
