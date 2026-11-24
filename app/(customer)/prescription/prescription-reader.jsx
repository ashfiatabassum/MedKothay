"use client";

// Upload a prescription photo, then check and edit the medicine list. Each
// name links to the normal search; nothing is reserved automatically.
import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { FormField, TextInput } from "@/components/form-field";
import { cn } from "@/lib/utils";
import { readPrescriptionAction } from "./actions";

const MAX_ROWS = 20;
// Shrink photos above 1.5 MB; refuse anything still above 4 MB, safely under
// the platform's ~4.5 MB request limit (the server still checks ≤ 5 MB).
const SHRINK_ABOVE_BYTES = 1.5 * 1024 * 1024;
const UPLOAD_MAX_BYTES = 4 * 1024 * 1024;
const MAX_SIDE_PX = 2000;
const TOO_BIG =
  "This photo is too large to send. Take it again with a lower camera resolution, or crop it.";

/** Longest side at most MAX_SIDE_PX, re-saved as JPEG. */
async function shrink(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    MAX_SIDE_PX / Math.max(bitmap.width, bitmap.height),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob"))),
      "image/jpeg",
      0.85,
    ),
  );
  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}
let nextKey = 0;
const row = (m) => ({ key: nextKey++, ...m });

function CatalogBadge({ inCatalog }) {
  // Edited or added names were not checked, so they get no badge.
  if (inCatalog === undefined || inCatalog === null) return null;
  return (
    <Badge
      className={cn(
        "border-transparent",
        inCatalog
          ? "bg-in-stock text-in-stock-foreground"
          : "bg-out-of-stock text-out-of-stock-foreground",
      )}
    >
      {inCatalog ? "In our catalog" : "Not in our catalog"}
    </Badge>
  );
}

export function PrescriptionReader() {
  const [state, formAction, pending] = useActionState(readPrescriptionAction, {
    status: "idle",
  });
  const [rows, setRows] = useState([]);
  const [shownState, setShownState] = useState(state);
  const [photo, setPhoto] = useState({ preparing: false, error: null });
  const [focusKey, setFocusKey] = useState(null);
  const listRef = useRef(null);

  // A new successful read replaces the list (adjusted during render, as React
  // recommends, rather than in an effect).
  if (state !== shownState) {
    setShownState(state);
    if (state.status === "read") setRows(state.medicines.map(row));
  }
  // Then move focus to the list so screen readers hear the result.
  useEffect(() => {
    if (state.status === "read") listRef.current?.focus();
  }, [state]);

  const edit = (key, name) =>
    setRows((rs) =>
      rs.map((r) => (r.key === key ? { key, name, strength: "" } : r)),
    );
  const remove = (key) => {
    setRows((rs) => rs.filter((r) => r.key !== key));
    // The focused button is gone; keep keyboard users in the list.
    listRef.current?.focus();
  };
  const add = () => {
    if (rows.length >= MAX_ROWS) return;
    const added = row({ name: "", strength: "" });
    setRows((rs) => [...rs, added]);
    setFocusKey(added.key);
  };

  // Phone photos are often 3–8 MB, above the hosting platform's ~4.5 MB
  // request limit (code review). Shrink big ones in the browser before upload.
  async function preparePhoto(input) {
    const file = input.files?.[0];
    if (!file) return setPhoto({ preparing: false, error: null });
    setPhoto({ preparing: true, error: null });
    try {
      if (file.size > SHRINK_ABOVE_BYTES) {
        const small = await shrink(file);
        const dt = new DataTransfer();
        dt.items.add(small);
        input.files = dt.files;
      }
      const size = input.files[0].size;
      setPhoto({
        preparing: false,
        error: size > UPLOAD_MAX_BYTES ? TOO_BIG : null,
      });
    } catch {
      setPhoto({
        preparing: false,
        error: file.size > UPLOAD_MAX_BYTES ? TOO_BIG : null,
      });
    }
  }

  return (
    <div className="space-y-6">
      <form
        action={formAction}
        className="space-y-4 rounded-xl border bg-card p-4"
      >
        <FormField
          id="rx-photo"
          label="Prescription photo"
          hint="JPG, PNG or WebP. The photo is sent to Google's Gemini service to read the names; MedKothay does not store it."
          error={
            photo.error ?? (state.status === "error" ? state.message : null)
          }
        >
          {(a) => (
            <input
              id="rx-photo"
              name="prescription"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              required
              aria-describedby={a.describedBy}
              aria-invalid={a.invalid || undefined}
              onChange={(e) => preparePhoto(e.target)}
              className="block w-full text-sm file:mr-3 file:h-11 file:rounded-md file:border-0 file:bg-secondary file:px-4 file:text-secondary-foreground"
            />
          )}
        </FormField>
        <Button
          type="submit"
          disabled={pending || photo.preparing || Boolean(photo.error)}
          className="h-11 w-full sm:w-auto"
        >
          {pending
            ? "Reading the prescription…"
            : photo.preparing
              ? "Preparing the photo…"
              : "Read prescription"}
        </Button>
        <p role="status" aria-live="polite" className="sr-only">
          {pending
            ? "Reading the prescription. This can take up to half a minute."
            : ""}
        </p>
      </form>

      {rows.length > 0 || state.status === "read" ? (
        <section
          ref={listRef}
          tabIndex={-1}
          aria-labelledby="rx-list-heading"
          className="space-y-3 focus:outline-none"
        >
          <div>
            <h2 id="rx-list-heading" className="font-semibold">
              Medicines found
            </h2>
            <p className="text-sm text-muted-foreground">
              Check each name against the prescription and correct it if needed.
              This is not medical advice.
              {state.status === "read" &&
                ` ${state.remaining} ${state.remaining === 1 ? "read" : "reads"} left today.`}
            </p>
          </div>
          {rows.length === 0 && (
            <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              No medicines in the list. Add one, or read another photo.
            </p>
          )}
          <ul className="space-y-2">
            {rows.map((r, i) => {
              const q = r.name.trim();
              return (
                <li
                  key={r.key}
                  className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-end"
                >
                  <div className="min-w-0 flex-1">
                    <FormField
                      id={`rx-name-${r.key}`}
                      label={`Medicine ${i + 1}`}
                    >
                      {(a) => (
                        <TextInput
                          id={`rx-name-${r.key}`}
                          value={r.name}
                          maxLength={60}
                          autoFocus={r.key === focusKey}
                          onChange={(e) => edit(r.key, e.target.value)}
                          {...a}
                        />
                      )}
                    </FormField>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {r.strength && <span>Written: {r.strength}</span>}
                      <CatalogBadge inCatalog={r.inCatalog} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {q.length >= 2 ? (
                      <Link
                        href={`/search?q=${encodeURIComponent(q)}`}
                        className={cn(buttonVariants(), "h-11 flex-1")}
                        aria-label={`Search for ${q}`}
                      >
                        <Search className="size-4" aria-hidden="true" />
                        Search
                      </Link>
                    ) : (
                      <Button disabled className="h-11 flex-1">
                        Search
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="h-11"
                      onClick={() => remove(r.key)}
                      aria-label={`Remove medicine ${i + 1}`}
                    >
                      <X className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
          <Button
            variant="outline"
            onClick={add}
            disabled={rows.length >= MAX_ROWS}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add a medicine
          </Button>
        </section>
      ) : null}
    </div>
  );
}
