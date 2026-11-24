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
  const [fileName, setFileName] = useState(null);
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
  const remove = (key) => setRows((rs) => rs.filter((r) => r.key !== key));
  const add = () =>
    setRows((rs) =>
      rs.length >= MAX_ROWS ? rs : [...rs, row({ name: "", strength: "" })],
    );

  return (
    <div className="space-y-6">
      <form
        action={formAction}
        className="space-y-4 rounded-xl border bg-card p-4"
      >
        <FormField
          id="rx-photo"
          label="Prescription photo"
          hint="JPG, PNG or WebP, up to 5 MB. The photo is read once and not stored."
          error={state.status === "error" ? state.message : null}
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
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
              className="block w-full text-sm file:mr-3 file:h-11 file:rounded-md file:border-0 file:bg-secondary file:px-4 file:text-secondary-foreground"
            />
          )}
        </FormField>
        {fileName && (
          <p className="text-xs text-muted-foreground">{fileName}</p>
        )}
        <Button
          type="submit"
          disabled={pending}
          className="h-11 w-full sm:w-auto"
        >
          {pending ? "Reading the prescription…" : "Read prescription"}
        </Button>
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
