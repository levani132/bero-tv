export class Observable<T = any> {
  private observers: Function[] = [];

  constructor(public value?: T) {}

  public subscribe(observer: (data?: T) => void) {
    if (this.observers.some((obs) => obs === observer)) return;
    this.observers.push(observer);
    observer(this.value);
  }

  public unsubscribe(observer: (data: T) => void) {
    this.observers = this.observers.filter((obs) => obs !== observer);
  }

  public set(data: T) {
    this.value = data;
    this.observers.forEach((observer) => observer(data));
  }

  public update(mutate: (current: T) => T) {
    this.set(mutate(this.value as T));
  }
}
