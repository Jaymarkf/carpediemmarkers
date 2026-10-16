import { Component } from '@theme/component';
import { sectionRenderer } from '@theme/section-renderer';
import { CartLinesUpdateEvent, StandardEvents } from '@shopify/events';

/** Collection products remain independent Shopify products; only their presentation is grouped. */
class CarpeCollectionOrder extends Component {
  #observer;
  #pageController;
  #cartController;
  #busy = false;
  #uncertain = false;
  #messages = {};
  #groupController;
  #groupIndexUrl;
  #groupIndexComplete = false;
  #indexGroups = new Map();
  #activeGroup;
  #feedbackController;
  #feedbackFlight;
  #feedbackPulse;
  #feedbackTimeout;
  #presenceListeners;
  #presenceRequest;
  #presenceTimer;
  #presenceRevision = 0;
  #cartPresence;

  connectedCallback() {
    super.connectedCallback();
    this.#initialize();
  }

  updatedCallback() {
    super.updatedCallback();
    this.#clearCartFeedback();
    this.#stopCartPresence();
    this.#cartPresence = undefined;
    this.#pageController?.abort();
    this.#pageController = undefined;
    this.#groupController?.abort();
    this.#groupController = undefined;
    this.#groupIndexUrl = undefined;
    this.#groupIndexComplete = false;
    this.#indexGroups.clear();
    this.#activeGroup = undefined;
    this.#initialize();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#clearCartFeedback();
    this.#stopCartPresence();
    this.#observer?.disconnect();
    this.#pageController?.abort();
    this.#pageController = undefined;
    this.#groupController?.abort();
    this.#groupController = undefined;
    // An aborted POST may already have reached Shopify. Never silently submit it again.
    if (this.#busy) this.#uncertain = true;
    this.#cartController?.abort();
  }

  #initialize() {
    this.#messages = JSON.parse(this.querySelector('[data-order-messages]')?.textContent || '{}');
    this.setAttribute('data-enhanced', '');
    this.#renderGroups();
    this.#updateSelection();
    this.#observeNext();
    this.loadGroupIndex();
    this.#connectCartPresence();
  }

  #connectCartPresence() {
    if (!this.querySelector('[data-order-in-cart]')) return;
    this.#stopCartPresence();
    const listeners = new AbortController();
    this.#presenceListeners = listeners;
    document.addEventListener(StandardEvents.cartLinesUpdate, this.#onCartPresenceEvent, {signal: listeners.signal});
    window.addEventListener('pageshow', (event) => { if (event.persisted) this.#scheduleCartPresence(); }, {signal: listeners.signal});
    window.addEventListener('focus', this.#scheduleCartPresence, {signal: listeners.signal});
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') this.#scheduleCartPresence(); }, {signal: listeners.signal});
    // Liquid already renders the current cart. This single reconciliation also handles cached navigation.
    void this.#refreshCartPresence();
  }

  #stopCartPresence() {
    this.#presenceRevision++;
    this.#presenceListeners?.abort();
    this.#presenceListeners = undefined;
    this.#presenceRequest?.abort();
    this.#presenceRequest = undefined;
    clearTimeout(this.#presenceTimer);
    this.#presenceTimer = undefined;
  }

  #scheduleCartPresence = () => {
    if (!this.isConnected || !this.#presenceListeners || this.#presenceTimer) return;
    this.#presenceTimer = setTimeout(() => {
      this.#presenceTimer = undefined;
      void this.#refreshCartPresence();
    }, 80);
  };

  /** Wait for the standard cart event's settled result; its request may still be in progress.
   * @param {CartLinesUpdateEvent} event
   */
  #onCartPresenceEvent = (event) => {
    const revision = ++this.#presenceRevision;
    this.#presenceRequest?.abort();
    this.#presenceRequest = undefined;
    clearTimeout(this.#presenceTimer);
    this.#presenceTimer = undefined;
    Promise.resolve(event.promise).then((result) => {
      if (!this.isConnected || revision !== this.#presenceRevision) return;
      const items = result?.detail?.items;
      const total = result?.cart?.totalQuantity;
      // Reuse an authoritative full-cart payload. Never mistake an add response's partial items for the cart.
      if (Array.isArray(items) && Number.isSafeInteger(total) && items.reduce((sum, item) => sum + Number(item.quantity || 0), 0) === total) {
        this.#setCartPresence({items});
      } else this.#scheduleCartPresence();
    }).catch(() => {
      if (this.isConnected && revision === this.#presenceRevision) this.#scheduleCartPresence();
    });
  };

  async #refreshCartPresence() {
    if (!this.#presenceListeners || this.#presenceRequest || this.#busy) return;
    const controller = new AbortController();
    const revision = this.#presenceRevision;
    this.#presenceRequest = controller;
    try { await this.#readCart(controller.signal, revision); }
    catch { /* Preserve the last confirmed badges on an offline/network failure; no retry loop. */ }
    finally { if (this.#presenceRequest === controller) this.#presenceRequest = undefined; }
  }

  #setCartPresence(cart) {
    if (!Array.isArray(cart?.items)) return;
    const variants = new Map();
    const products = new Map();
    for (const item of cart.items) {
      const quantity = Number(item.quantity);
      if (!Number.isSafeInteger(quantity) || quantity < 0) return;
      const variant = String(item.variant_id ?? item.id ?? '');
      const product = String(item.product_id ?? '');
      if (variant) variants.set(variant, (variants.get(variant) || 0) + quantity);
      if (product) products.set(product, (products.get(product) || 0) + quantity);
    }
    this.#cartPresence = {variants, products};
    this.#renderCartPresence();
  }

  #renderCartPresence() {
    if (!this.#cartPresence) return;
    const formatter = new Intl.NumberFormat(document.documentElement.lang || undefined);
    for (const badge of this.querySelectorAll('[data-order-in-cart]')) {
      const quantity = badge.dataset.cartVariantId
        ? this.#cartPresence.variants.get(badge.dataset.cartVariantId) || 0
        : this.#cartPresence.products.get(badge.dataset.cartProductId) || 0;
      const count = badge.querySelector('[data-order-cart-count]');
      if (count) count.textContent = formatter.format(quantity);
      const label = badge.querySelector('[data-order-cart-label]');
      if (label && this.#messages.inCartQuantity) label.textContent = this.#messages.inCartQuantity.replace('__count__', formatter.format(quantity));
      badge.hidden = quantity === 0;
    }
  }

  #groupKey(value) {
    return String(value || '').trim().normalize('NFC').toLocaleLowerCase();
  }

  #hasGroupRows() {
    return [...this.querySelectorAll('[data-order-row]')].some((row) => !row.hidden);
  }

  #renderGroups() {
    const nav = this.querySelector('[data-order-tabs]');
    if (!nav) return;
    const groups = new Map(this.#indexGroups);
    const rows = [...this.querySelectorAll('[data-order-row]')];
    for (const row of rows) {
      const label = String(row.dataset.orderGroup || '').trim();
      const key = this.#groupKey(label);
      if (!groups.has(key)) groups.set(key, label);
    }
    const named = [...groups].filter(([key]) => key !== '').sort((a, b) => a[1].localeCompare(b[1], undefined, {numeric: true, sensitivity: 'base'}));
    if (named.length && groups.has('')) named.push(['', this.#messages.otherGroup]);
    nav.hidden = named.length === 0;
    if (this.#activeGroup === undefined || !groups.has(this.#activeGroup)) this.#activeGroup = named[0]?.[0];
    const table = this.querySelector('.carpe-order__scroll');
    // Reuse buttons so discovery of later tabs never steals keyboard focus.
    const existing = new Map([...nav.querySelectorAll('[data-order-tab]')].map((button) => [button.dataset.orderTab, button]));
    const wanted = new Set(named.map(([key]) => key));
    for (const [key, button] of existing) if (!wanted.has(key)) button.remove();
    let position = 0;
    for (const [key, label] of named) {
      let button = existing.get(key);
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'carpe-order__tab';
        button.dataset.orderTab = key;
        button.id = `${this.id}-group-${encodeURIComponent(key) || 'other'}`;
        button.setAttribute('role', 'tab');
        if (table?.id) button.setAttribute('aria-controls', table.id);
      }
      button.textContent = label;
      const active = key === this.#activeGroup;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      if (nav.children[position] !== button) nav.insertBefore(button, nav.children[position] || null);
      position++;
      if (active && table) table.setAttribute('aria-labelledby', button.id);
    }
    if (table) {
      table.setAttribute('role', named.length ? 'tabpanel' : 'region');
      if (!named.length) table.removeAttribute('aria-labelledby');
    }
    for (const row of rows) row.hidden = named.length > 0 && this.#groupKey(row.dataset.orderGroup) !== this.#activeGroup;
    const empty = this.querySelector('[data-order-group-empty]');
    if (empty) empty.hidden = !named.length || this.#hasGroupRows();
  }

  /** The directory contains only group labels, so later tabs don't require downloading every table row.
   * @param {MouseEvent} [event]
   */
  async loadGroupIndex(event) {
    event?.preventDefault();
    if (!this.dataset.groupIndexUrl || this.#groupController || this.#groupIndexComplete) return;
    const controller = new AbortController();
    this.#groupController = controller;
    const status = this.querySelector('[data-order-group-status]');
    const retry = this.querySelector('[data-order-group-retry]');
    if (status) status.textContent = '';
    if (retry) retry.hidden = true;
    try {
      let url = new URL(this.#groupIndexUrl || this.dataset.groupIndexUrl, location.href);
      const visited = new Set();
      while (url) {
        if (url.origin !== location.origin || visited.has(url.href)) throw new Error('Invalid group directory pagination');
        visited.add(url.href);
        this.#groupIndexUrl = url.href;
        const response = await fetch(url, {signal: controller.signal, headers: {Accept: 'text/html'}});
        if (!response.ok) throw new Error('Group directory unavailable');
        const html = await response.text();
        if (controller.signal.aborted || !this.isConnected) return;
        const directory = new DOMParser().parseFromString(html, 'text/html').querySelector('[data-order-group-index]');
        if (!directory) throw new Error('Missing group directory');
        for (const item of directory.querySelectorAll('[data-index-group]')) {
          const label = String(item.dataset.indexGroup || '').trim();
          const key = this.#groupKey(label);
          if (!this.#indexGroups.has(key)) this.#indexGroups.set(key, label);
        }
        this.#renderGroups();
        const following = directory.querySelector('[data-index-next]');
        url = following?.hasAttribute('href') ? new URL(following.getAttribute('href'), url) : null;
        if (url) this.#groupIndexUrl = url.href;
      }
      this.#groupIndexComplete = true;
      this.#observeNext();
    } catch (error) {
      if (error.name !== 'AbortError') {
        if (status) status.textContent = this.#messages.groupError;
        if (retry) retry.hidden = false;
      }
    } finally {
      if (this.#groupController === controller) this.#groupController = undefined;
    }
  }

  /** @param {MouseEvent} event */
  selectGroup(event) {
    const target = event.composedPath?.()[0] || event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest('[data-order-tab]');
    if (!button || !this.contains(button)) return;
    this.#activeGroup = button.dataset.orderTab;
    this.#renderGroups();
    this.#observeNext();
  }

  /** @param {KeyboardEvent} event */
  groupKeydown(event) {
    const target = event.composedPath?.()[0] || event.target;
    if (!(target instanceof HTMLElement) || !target.matches('[data-order-tab]')) return;
    const tabs = [...this.querySelectorAll('[data-order-tab]')];
    const current = tabs.indexOf(target);
    const rtl = getComputedStyle(this).direction === 'rtl';
    let index;
    if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = tabs.length - 1;
    else if (event.key === 'ArrowRight') index = (current + (rtl ? -1 : 1) + tabs.length) % tabs.length;
    else if (event.key === 'ArrowLeft') index = (current + (rtl ? 1 : -1) + tabs.length) % tabs.length;
    else return;
    event.preventDefault();
    tabs[index].focus();
    tabs[index].click();
    tabs[index].scrollIntoView({block: 'nearest', inline: 'nearest', behavior: 'instant'});
  }

  get quantities() {
    return [...this.querySelectorAll('[data-order-quantity]')];
  }

  #status(message, success = false) {
    const status = this.querySelector('[data-order-status]');
    if (!status) return;
    status.textContent = '';
    status.dataset.success = String(success);
    if (success) {
      const template = this.querySelector('[data-order-success-icon]');
      if (template instanceof HTMLTemplateElement) status.append(template.content.cloneNode(true));
    }
    status.append(document.createTextNode(message));
  }

  #clearCartFeedback() {
    this.#feedbackController?.abort();
    this.#feedbackController = undefined;
    clearTimeout(this.#feedbackTimeout);
    this.#feedbackTimeout = undefined;
    this.#feedbackFlight?.remove();
    this.#feedbackFlight = undefined;
    this.#feedbackPulse?.cancel();
    this.#feedbackPulse = undefined;
  }

  #visibleFeedbackTarget(element) {
    if (!(element instanceof HTMLElement) || !element.isConnected) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) !== 0 &&
      rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight;
  }

  /** Decorative only: this never sends a request, changes focus, or delays cart updates.
   * Reuses Horizon's fly-to-cart element, shared styles and existing cart SVG.
   * @param {number} count - Confirmed units added across all tabs
   */
  async #animateAdded(count) {
    this.#clearCartFeedback();
    if (this.dataset.cartAnimation !== 'true' || matchMedia('(prefers-reduced-motion: reduce)').matches || !this.isConnected) return;
    const template = this.querySelector('[data-order-flight]');
    const source = this.querySelector('[data-order-submit]');
    if (!(template instanceof HTMLTemplateElement) || !this.#visibleFeedbackTarget(source)) return;
    const controller = new AbortController();
    this.#feedbackController = controller;
    const cleanup = () => { if (this.#feedbackController === controller) this.#clearCartFeedback(); };
    try {
      await import('@theme/fly-to-cart');
      if (controller.signal.aborted || !this.isConnected) return;
      const destination = [...document.querySelectorAll('header-actions .header-actions__cart-icon')].find((element) => this.#visibleFeedbackTarget(element));
      if (!destination || !this.#visibleFeedbackTarget(source)) { cleanup(); return; }
      const flight = document.createElement('fly-to-cart');
      flight.className = 'fly-to-cart--order';
      flight.setAttribute('aria-hidden', 'true');
      flight.inert = true;
      flight.append(template.content.cloneNode(true));
      const badge = flight.querySelector('[data-order-flight-count]');
      if (badge) badge.textContent = `+${new Intl.NumberFormat(document.documentElement.lang || undefined).format(count)}`;
      const colors = getComputedStyle(source);
      flight.style.setProperty('--carpe-flight-background', colors.getPropertyValue('--color-primary-button-background') || colors.backgroundColor);
      flight.style.setProperty('--carpe-flight-color', colors.getPropertyValue('--color-primary-button-text') || colors.color);
      flight.style.setProperty('--start-opacity', '0');
      flight.source = source;
      flight.destination = destination;
      this.#feedbackFlight = flight;
      flight.addEventListener('animationend', (event) => {
        if (event.target !== flight || event.animationName !== 'travel-scale' || controller.signal.aborted) return;
        flight.remove();
        this.#feedbackFlight = undefined;
        if (!this.#visibleFeedbackTarget(destination) || typeof destination.animate !== 'function') { cleanup(); return; }
        // Pulse only the cart icon, not its clickable control or the header layout.
        try {
          this.#feedbackPulse = destination.animate([
            {transform: 'translateY(0) scale(1)'},
            {transform: 'translateY(-3px) scale(1.2)', offset: 0.4},
            {transform: 'translateY(0) scale(1)'},
          ], {duration: 420, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)'});
          this.#feedbackPulse.finished.then(cleanup, cleanup);
        } catch { cleanup(); }
      }, {signal: controller.signal});
      // Cancel if geometry or motion preference changes rather than flying to a stale position.
      document.addEventListener('scroll', cleanup, {capture: true, passive: true, signal: controller.signal});
      window.addEventListener('resize', cleanup, {passive: true, signal: controller.signal});
      matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', cleanup, {signal: controller.signal});
      this.#feedbackTimeout = setTimeout(cleanup, 1800);
      document.body.append(flight);
    } catch {
      // A missing animation module or unsupported enhancement must never turn a successful add into an error.
      cleanup();
    }
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
    if (this.#activeGroup !== undefined && !this.#hasGroupRows() && next?.hasAttribute('href')) {
      this.loadMore();
      return;
    }
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
      this.#renderGroups();
      this.#renderCartPresence();
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

  async #readCart(signal, revision = this.#presenceRevision) {
    const response = await fetch(this.dataset.cartUrl, { cache: 'no-store', signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Cart refresh failed');
    const cart = await response.json();
    if (!signal?.aborted && this.isConnected && revision === this.#presenceRevision) this.#setCartPresence(cart);
    return cart;
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
        this.#activeGroup = this.#groupKey(input.closest('[data-order-row]')?.dataset.orderGroup);
        this.#renderGroups();
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
    const presenceRevision = this.#presenceRevision;
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
      void this.#animateAdded(items.reduce((sum, item) => sum + item.quantity, 0));
      // Clear immediately after confirmed success even if the follow-up cart GET fails.
      for (const input of this.quantities) input.value = '0';
      const cart = await this.#readCart(controller.signal, presenceRevision);
      deferred.resolve({
        cart: CartLinesUpdateEvent.createCartFromAjaxResponse(cart),
        detail: {
          source: 'carpe-collection-order', sourceId: this.id, items: cart.items,
          itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
          sections: result.sections, didError: false,
        },
      });
      this.#status(this.#messages.success, true);
    } catch (error) {
      this.#uncertain = !added;
      this.#status(added ? this.#messages.syncError : this.#messages.cartError);
      // Shopify can partially change a cart on an error. Reconcile it, but never retry the POST.
      if (!controller.signal.aborted) {
        try {
          const cart = await this.#readCart(controller.signal, presenceRevision);
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
