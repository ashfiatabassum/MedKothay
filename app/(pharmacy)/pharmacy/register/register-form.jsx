"use client";

// Step 2 of 2: the pharmacy itself (D6 fields). The browser checks the photo
// early for convenience; the server checks everything again.
import { useActionState, useRef, useState } from "react";
import { Crosshair, MailCheck, MapPin } from "lucide-react";
import {
  FormField,
  SuccessHeading,
  TextInput,
  useFocusFirstError,
} from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { AREAS, findArea } from "@/lib/areas";
import { LICENCE_MAX_BYTES } from "@/lib/constants";
import { registerPharmacyAction } from "../actions";

const ACCEPT = "image/jpeg,image/png,image/webp";

// `initial` pre-fills a rejected shop's details when resubmitting.
export function RegisterForm({ resubmit, initial = {}, rejectionReason }) {
  const [state, formAction, pending] = useActionState(registerPharmacyAction, {
    status: "idle",
  });
  const formRef = useRef(null);
  // Earliest allowed expiry, as today in Dhaka; read the clock once, not each render.
  const [today] = useState(() =>
    new Date(Date.now() + 6 * 3_600_000).toISOString().slice(0, 10),
  );
  useFocusFirstError(formRef, state, "#reg-name");

  const v = state.values ?? initial;
  const [areaId, setAreaId] = useState(v.area ?? "");
  const [coords, setCoords] = useState(() =>
    Number.isFinite(initial.lat) && Number.isFinite(initial.lng)
      ? {
          lat: initial.lat,
          lng: initial.lng,
          source: initial.locationSource === "device" ? "device" : "area",
        }
      : null,
  );
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState(null);
  // Tied to the server state they were set under: after a submit React clears
  // the file input, so an old file name or error must not linger.
  const [photo, setPhoto] = useState({ for: null, name: null, error: null });
  // Fields edited since the last server response no longer show its error.
  const [edited, setEdited] = useState({ for: null, names: [] });

  if (state.status === "submitted") {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-3 rounded-xl border bg-card px-5 py-8 text-center"
      >
        <MailCheck className="size-10 text-primary" aria-hidden="true" />
        <SuccessHeading>
          Thank you. Your pharmacy is under review.
        </SuccessHeading>
        <p className="max-w-md text-sm text-muted-foreground">
          We received the registration for{" "}
          <span className="font-medium text-foreground">{state.shopName}</span>.
          An admin will check your DGDA licence, usually within 1 to 2 days.
          We&apos;ll try to email you the result, and you&apos;ll also see it on
          your dashboard. Until then your shop is hidden from customers, but you
          can already add your stock.
        </p>
      </div>
    );
  }

  const area = findArea(areaId);
  const location =
    coords ?? (area ? { lat: area.lat, lng: area.lng, source: "area" } : null);
  const photoNow = photo.for === state ? photo : { name: null, error: null };
  const editedNow = edited.for === state ? edited.names : [];
  const errors = Object.fromEntries(
    Object.entries(state.fieldErrors ?? {}).filter(
      ([k]) => !editedNow.includes(k),
    ),
  );
  const markEdited = (e) => {
    const name =
      e.target.name === "lat" || e.target.name === "lng"
        ? "location"
        : e.target.name;
    if (!name || editedNow.includes(name)) return;
    setEdited({
      for: state,
      names: [...editedNow, name, ...(name === "area" ? ["location"] : [])],
    });
  };

  function locate() {
    setGeoError(null);
    if (!("geolocation" in navigator)) {
      setGeoError(
        "This browser can't share its location. Your shop location has not changed.",
      );
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({
          lat: Number(p.coords.latitude.toFixed(5)),
          lng: Number(p.coords.longitude.toFixed(5)),
          source: "device",
        });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setGeoError(
          "We couldn't get your current location. Your shop location has not changed.",
        );
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  function onPhoto(e) {
    const f = e.target.files?.[0];
    if (!f) return setPhoto({ for: state, name: null, error: null });
    const error = !ACCEPT.split(",").includes(f.type)
      ? "Use a JPG, PNG or WebP photo."
      : f.size > LICENCE_MAX_BYTES
        ? "The photo must be 5 MB or smaller."
        : null;
    setPhoto({
      for: state,
      name: `${f.name} (${(f.size / 1024 / 1024).toFixed(1)} MB)`,
      error,
    });
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      onChange={markEdited}
      className="space-y-5"
    >
      <p className="text-sm text-muted-foreground">All fields are required.</p>
      {state.formError && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {state.formError}
        </p>
      )}
      {resubmit && (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">
          <span className="font-medium">Not approved:</span>{" "}
          {rejectionReason || "No reason given."} Correct it, then submit again.
        </p>
      )}

      <fieldset className="space-y-5">
        <legend className="mb-1 text-base font-semibold">Your shop</legend>
        <FormField id="reg-name" label="Shop name" error={errors.name}>
          {(a) => (
            <TextInput
              id="reg-name"
              name="name"
              required
              maxLength={80}
              autoComplete="organization"
              defaultValue={v.name ?? ""}
              {...a}
            />
          )}
        </FormField>
        <FormField
          id="reg-address"
          label="Address"
          hint="House, road and area, as customers would look for it."
          error={errors.address}
        >
          {(a) => (
            <TextInput
              id="reg-address"
              name="address"
              required
              maxLength={200}
              autoComplete="street-address"
              defaultValue={v.address ?? ""}
              {...a}
            />
          )}
        </FormField>
        <FormField id="reg-area" label="Area" error={errors.area}>
          {(a) => (
            <select
              id="reg-area"
              name="area"
              required
              value={areaId}
              onChange={(e) => {
                setAreaId(e.target.value);
                setCoords(null);
              }}
              aria-invalid={a.invalid || undefined}
              aria-describedby={a.describedBy}
              className="h-11 w-full rounded-lg border border-input bg-card px-3 text-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none aria-invalid:border-destructive"
            >
              <option value="">Choose the area</option>
              {AREAS.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          )}
        </FormField>

        <div className="space-y-2">
          <p id="reg-location-label" className="text-sm font-medium">
            Shop location
          </p>
          <input type="hidden" name="lat" value={location?.lat ?? ""} />
          {/* D21: the admin sees whether the pin is the area centre or the phone. */}
          <input
            type="hidden"
            name="locationSource"
            value={location?.source === "device" ? "device" : "area"}
          />
          <input type="hidden" name="lng" value={location?.lng ?? ""} />
          <p
            className="flex items-start gap-1 text-sm text-muted-foreground"
            aria-live="polite"
            aria-describedby="reg-location-label"
          >
            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {location
              ? location.source === "device"
                ? `Device location (${location.lat}, ${location.lng}). Customers' distances are measured from here. Use your current location to update it.`
                : `Centre of ${area.name}. For accurate distances, use your location while you are in the shop.`
              : "Choose the area first."}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={locate}
            disabled={locating || !area}
          >
            <Crosshair aria-hidden="true" />
            {locating ? "Finding you…" : "Use my current location"}
          </Button>
          {(geoError || errors.location) && (
            <p role="alert" className="text-sm text-destructive">
              {geoError ?? errors.location}
            </p>
          )}
        </div>

        <FormField
          id="reg-phone"
          label="Shop mobile number"
          hint="Shown to customers who reserve, like 01712-345678."
          error={errors.phone}
        >
          {(a) => (
            <TextInput
              id="reg-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              required
              autoComplete="tel"
              defaultValue={v.phone ?? ""}
              {...a}
            />
          )}
        </FormField>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="mb-1 text-base font-semibold">DGDA licence</legend>
        <FormField
          id="reg-licence"
          label="Licence number"
          error={errors.licenceNumber}
        >
          {(a) => (
            <TextInput
              id="reg-licence"
              name="licenceNumber"
              required
              maxLength={40}
              autoCapitalize="characters"
              defaultValue={v.licenceNumber ?? ""}
              {...a}
            />
          )}
        </FormField>
        <FormField
          id="reg-expiry"
          label="Licence expiry date"
          error={errors.licenceExpiry}
        >
          {(a) => (
            <TextInput
              id="reg-expiry"
              name="licenceExpiry"
              type="date"
              min={today}
              required
              defaultValue={v.licenceExpiry ?? ""}
              {...a}
            />
          )}
        </FormField>
        <FormField
          id="reg-photo"
          label="Licence photo"
          hint={
            state.status === "error"
              ? "Choose the photo again: for safety, browsers clear it after each try."
              : "A clear photo of the licence. JPG, PNG or WebP, up to 5 MB. Only you and MedKothay admins can see it."
          }
          error={photoNow.error ?? errors.licencePhoto}
        >
          {(a) => (
            <>
              <input
                id="reg-photo"
                name="licencePhoto"
                type="file"
                accept={ACCEPT}
                required
                onChange={onPhoto}
                aria-invalid={a.invalid || undefined}
                aria-describedby={a.describedBy}
                className="block w-full text-sm file:mr-3 file:h-10 file:rounded-lg file:border-0 file:bg-secondary file:px-4 file:font-medium file:text-secondary-foreground"
              />
              {photoNow.name && (
                <p className="text-xs text-muted-foreground">{photoNow.name}</p>
              )}
            </>
          )}
        </FormField>
      </fieldset>

      <Button
        type="submit"
        size="lg"
        disabled={pending || Boolean(photoNow.error)}
        className="h-11 w-full"
      >
        {pending
          ? "Submitting…"
          : resubmit
            ? "Submit again for review"
            : "Submit for review"}
      </Button>
    </form>
  );
}
