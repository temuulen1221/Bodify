// Minimal EventEmitter shim for browser environment
class EventEmitter {
  constructor() { this._events = Object.create(null); }
  on(name, listener) { (this._events[name] = this._events[name] || []).push(listener); return this; }
  addListener(name, listener) { return this.on(name, listener); }
  off(name, listener) { this._events[name] = (this._events[name] || []).filter(l => l !== listener); return this; }
  removeListener(name, listener) { return this.off(name, listener); }
  once(name, listener) {
    const wrapped = (...args) => { this.off(name, wrapped); listener.apply(this, args); };
    return this.on(name, wrapped);
  }
  emit(name, ...args) { (this._events[name] || []).slice().forEach(fn => { try { fn.apply(this, args); } catch (e) {} }); return !!(this._events[name] && this._events[name].length); }
}

module.exports = { EventEmitter, default: EventEmitter };
