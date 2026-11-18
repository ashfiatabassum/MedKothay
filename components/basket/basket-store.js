// Browser-side basket store backed by localStorage, read through
// useSyncExternalStore. Cached so getSnapshot returns the same object until
// the basket changes (a requirement of useSyncExternalStore). Also follows
// changes made in other tabs via the "storage" event.
const KEY = "mk-basket-v1";
const listeners = new Set();
let cache; // undefined = not read yet; null = empty basket

const isText = (v) => typeof v === "string" && v.length > 0 && v.length <= 120;

// Anything stored by an older version, or edited by hand, must not crash the
// basket page: every item is checked, and a bad basket is simply dropped.
function isValidBasket(b) {
  return (
    b !== null &&
    typeof b === "object" &&
    isText(b.pharmacyId) &&
    isText(b.pharmacyName) &&
    typeof b.address === "string" &&
    Array.isArray(b.items) &&
    b.items.length > 0 &&
    b.items.length <= 20 &&
    b.items.every(
      (i) =>
        i !== null &&
        typeof i === "object" &&
        isText(i.medicineId) &&
        isText(i.brandName) &&
        typeof i.strength === "string" &&
        typeof i.form === "string" &&
        typeof i.prescriptionOnly === "boolean" &&
        Number.isFinite(i.unitPrice) &&
        Number.isInteger(i.quantity) &&
        i.quantity >= 1 &&
        i.quantity <= 5,
    )
  );
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    const b = raw ? JSON.parse(raw) : null;
    return isValidBasket(b) ? b : null;
  } catch {
    return null;
  }
}

export function getBasket() {
  if (cache === undefined) cache = load();
  return cache;
}

export function getServerBasket() {
  return null;
}

export function setBasket(next) {
  const value = next?.items?.length ? next : null;
  try {
    if (value) localStorage.setItem(KEY, JSON.stringify(value));
    else localStorage.removeItem(KEY);
  } catch {
    // Private mode or blocked storage: the basket still works on this page.
  }
  cache = value;
  listeners.forEach((l) => l());
}

export function subscribe(listener) {
  listeners.add(listener);
  const onStorage = (e) => {
    // e.key is null when another tab calls localStorage.clear().
    if (e.key === KEY || e.key === null) {
      cache = undefined;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
