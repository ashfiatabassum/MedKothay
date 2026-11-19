"use client";

// Medicine search with a location (D3): the browser's location, or an area
// picked from the list. Submits to /search?q=…&area=… or &lat=…&lng=….
// The last location is remembered in this browser for convenience only.
import { useId, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Crosshair, Loader2, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AREAS } from "@/lib/areas";
import { cn } from "@/lib/utils";

const LOCATION_KEY = "mk-location-v1";
let savedCache; // undefined = not read yet (useSyncExternalStore needs a stable value)

function readSaved() {
  if (savedCache !== undefined) return savedCache;
  savedCache = null;
  try {
    const v = JSON.parse(localStorage.getItem(LOCATION_KEY) ?? "null");
    if (v?.kind === "area" && AREAS.some((a) => a.id === v.id)) savedCache = v;
    else if (
      v?.kind === "gps" &&
      Number.isFinite(v.lat) &&
      Number.isFinite(v.lng)
    )
      savedCache = v;
  } catch {}
  return savedCache;
}

function saveLocation(v) {
  savedCache = v;
  try {
    localStorage.setItem(LOCATION_KEY, JSON.stringify(v));
  } catch {}
}

const noopSubscribe = () => () => {};

/**
 * initial = { q, location } from the current URL (location as above, or null).
 * variant "hero" sits in the blue box on the home page; "compact" on /search.
 */
export function SearchForm({ initial = {}, variant = "hero" }) {
  const router = useRouter();
  const ids = useId();
  const [q, setQ] = useState(initial.q ?? "");
  // `chosen` is what the user picked on this page (undefined = nothing yet);
  // otherwise fall back to the URL's location, then the remembered one.
  const [chosen, setLocation] = useState(undefined);
  const saved = useSyncExternalStore(noopSubscribe, readSaved, () => null);
  // The remembered location prefills only the home page form; on /search the
  // form must match the URL that produced the results.
  const fallback = variant === "hero" ? saved : null;
  const location =
    chosen !== undefined ? chosen : (initial.location ?? fallback);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState(null); // { field: "q"|"location", message }

  function chooseArea(id) {
    const v = id ? { kind: "area", id } : null;
    setLocation(v);
    if (v) saveLocation(v);
    if (error?.field === "location") setError(null);
  }

  function locateMe() {
    if (!("geolocation" in navigator)) {
      setError({
        field: "location",
        message:
          "This browser can't share your location. Pick your area instead.",
      });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const v = {
          kind: "gps",
          lat: Number(pos.coords.latitude.toFixed(4)),
          lng: Number(pos.coords.longitude.toFixed(4)),
        };
        setLocation(v);
        saveLocation(v);
        setLocating(false);
        if (error?.field === "location") setError(null);
      },
      () => {
        setLocating(false);
        setError({
          field: "location",
          message: "We couldn't get your location. Pick your area instead.",
        });
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  function onSubmit(e) {
    e.preventDefault();
    const text = q.trim();
    if (text.length < 2) {
      setError({
        field: "q",
        message: "Type at least 2 letters of a medicine name.",
      });
      document.getElementById(`${ids}-q`)?.focus();
      return;
    }
    if (!location) {
      setError({
        field: "location",
        message: "Choose your area, or use your location.",
      });
      document.getElementById(`${ids}-area`)?.focus();
      return;
    }
    const params = new URLSearchParams({ q: text });
    if (location.kind === "area") params.set("area", location.id);
    else {
      params.set("lat", String(location.lat));
      params.set("lng", String(location.lng));
    }
    router.push(`/search?${params}`);
  }

  const hero = variant === "hero";
  const qError = error?.field === "q" ? error.message : null;
  const locError = error?.field === "location" ? error.message : null;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      role="search"
      aria-label="Search medicines"
      className={cn(
        "space-y-3 rounded-xl bg-card p-4 text-card-foreground",
        hero ? "shadow-sm" : "border",
      )}
    >
      <div className="space-y-1.5">
        <label htmlFor={`${ids}-q`} className="text-sm font-medium">
          Medicine name
        </label>
        <div className="flex gap-2">
          <Input
            id={`${ids}-q`}
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              if (qError) setError(null);
            }}
            placeholder="Brand or generic, e.g. Napa or Paracetamol"
            autoComplete="off"
            enterKeyHint="search"
            maxLength={60}
            aria-invalid={qError ? true : undefined}
            aria-describedby={qError ? `${ids}-q-error` : undefined}
            className="h-11 flex-1"
          />
          <Button
            type="submit"
            size="lg"
            className="h-11 shrink-0"
            aria-label="Search"
          >
            <Search aria-hidden="true" />
            <span className="hidden sm:inline">Search</span>
          </Button>
        </div>
        {qError && (
          <p
            id={`${ids}-q-error`}
            role="alert"
            className="text-sm text-destructive"
          >
            {qError}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor={`${ids}-area`} className="text-sm font-medium">
          Near
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            id={`${ids}-area`}
            value={location?.kind === "area" ? location.id : ""}
            onChange={(e) => chooseArea(e.target.value)}
            aria-invalid={locError ? true : undefined}
            aria-describedby={
              locError ? `${ids}-loc-error` : `${ids}-loc-status`
            }
            className="h-11 flex-none rounded-lg border border-input bg-card px-3 text-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none aria-invalid:border-destructive sm:flex-1"
          >
            <option value="">
              {location?.kind === "gps"
                ? "Using your location"
                : "Choose your area"}
            </option>
            {AREAS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            onClick={locateMe}
            disabled={locating}
            className="h-11"
          >
            {locating ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Crosshair aria-hidden="true" />
            )}
            {locating ? "Finding you…" : "Use my location"}
          </Button>
        </div>
        {locError ? (
          <p
            id={`${ids}-loc-error`}
            role="alert"
            className="text-sm text-destructive"
          >
            {locError}
          </p>
        ) : (
          <p
            id={`${ids}-loc-status`}
            className="flex items-center gap-1 text-sm text-muted-foreground"
          >
            <MapPin className="size-3.5" aria-hidden="true" />
            {location?.kind === "gps"
              ? "Using your current location."
              : location?.kind === "area"
                ? `Searching around ${AREAS.find((a) => a.id === location.id)?.name}.`
                : "We show pharmacies within 5 km."}
          </p>
        )}
      </div>
    </form>
  );
}
