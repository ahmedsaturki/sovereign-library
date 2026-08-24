export class PriorityHeap {
  constructor(compare) {
    this.compare = compare;
    this.items = [];
  }

  get size() {
    return this.items.length;
  }

  peek() {
    return this.items[0];
  }

  push(item) {
    this.items.push(item);
    this.#bubbleUp(this.items.length - 1);
  }

  pop() {
    if (this.items.length === 0) return undefined;
    const root = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0) {
      this.items[0] = last;
      this.#bubbleDown(0);
    }
    return root;
  }

  remove(predicate) {
    const index = this.items.findIndex(predicate);
    if (index === -1) return undefined;
    const removed = this.items[index];
    const last = this.items.pop();
    if (index < this.items.length) {
      this.items[index] = last;
      const parent = Math.floor((index - 1) / 2);
      if (index > 0 && this.compare(this.items[index], this.items[parent]) < 0) {
        this.#bubbleUp(index);
      } else {
        this.#bubbleDown(index);
      }
    }
    return removed;
  }

  values() {
    return [...this.items];
  }

  #bubbleUp(index) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.compare(this.items[index], this.items[parent]) >= 0) break;
      [this.items[index], this.items[parent]] = [this.items[parent], this.items[index]];
      index = parent;
    }
  }

  #bubbleDown(index) {
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      if (left < this.items.length && this.compare(this.items[left], this.items[smallest]) < 0) smallest = left;
      if (right < this.items.length && this.compare(this.items[right], this.items[smallest]) < 0) smallest = right;
      if (smallest === index) return;
      [this.items[index], this.items[smallest]] = [this.items[smallest], this.items[index]];
      index = smallest;
    }
  }
}
