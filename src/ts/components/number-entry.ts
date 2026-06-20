// Transient numeric channel-entry overlay (FR-008a). Accumulates digits and, after
// a short idle, resolves to a channel number via the provided lookup.
class NumberEntry {
  private buffer = "";
  private timer: any = null;
  private container: HTMLElement | null = null;
  private onResolve: ((num: number) => void) | null = null;

  attach(container: HTMLElement, onResolve: (num: number) => void) {
    this.container = container;
    this.onResolve = onResolve;
  }

  pushDigit(d: string) {
    this.buffer = (this.buffer + d).slice(0, 4);
    this.render();
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.commit(), 1500);
  }

  private commit() {
    const num = parseInt(this.buffer, 10);
    this.buffer = "";
    this.render();
    if (!isNaN(num) && this.onResolve) this.onResolve(num);
  }

  isActive() {
    return this.buffer.length > 0;
  }

  private render() {
    if (!this.container) return;
    this.container.innerHTML = this.buffer
      ? '<div class="number-entry">' + this.buffer + "</div>"
      : "";
  }
}

export function createNumberEntry() {
  return new NumberEntry();
}
