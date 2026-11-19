"use client";

// Master medicine list: search, add, edit. Pharmacies pick from this list.
import { useActionState, useMemo, useRef, useState } from "react";
import { CircleCheck, Pencil, Plus, Search } from "lucide-react";
import { RxBadge } from "@/components/badges";
import {
  FocusMessage,
  FormField,
  TextInput,
  useFocusFirstError,
  useReturnFocus,
} from "@/components/form-field";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addMedicineAction, updateMedicineAction } from "../actions";

import { MEDICINE_FORMS as FORMS } from "@/lib/constants";

function Saved({ text }) {
  return (
    <FocusMessage className="flex items-center gap-1 text-sm text-in-stock-foreground">
      <CircleCheck className="size-4" aria-hidden="true" />
      {text}{" "}
      <span className="text-xs text-muted-foreground">
        (demo: saving starts in step W1, so the list still shows the old values)
      </span>
    </FocusMessage>
  );
}

// Select and checkbox ignore a changed default after mount, so they are keyed
// on it: after React resets the form they show the submitted value.
function MedicineFields({ prefix, errors, d = {}, autoFocus = false }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <FormField
        id={`${prefix}-brand`}
        label="Brand name"
        error={errors.brandName}
      >
        {(a) => (
          <TextInput
            autoFocus={autoFocus}
            id={`${prefix}-brand`}
            name="brandName"
            required
            maxLength={60}
            defaultValue={d.brandName ?? ""}
            {...a}
          />
        )}
      </FormField>
      <FormField
        id={`${prefix}-generic`}
        label="Generic name"
        error={errors.genericName}
      >
        {(a) => (
          <TextInput
            id={`${prefix}-generic`}
            name="genericName"
            required
            maxLength={120}
            defaultValue={d.genericName ?? ""}
            {...a}
          />
        )}
      </FormField>
      <FormField
        id={`${prefix}-maker`}
        label="Manufacturer"
        error={errors.manufacturer}
      >
        {(a) => (
          <TextInput
            id={`${prefix}-maker`}
            name="manufacturer"
            required
            maxLength={60}
            defaultValue={d.manufacturer ?? ""}
            {...a}
          />
        )}
      </FormField>
      <FormField
        id={`${prefix}-strength`}
        label="Strength"
        hint="e.g. 500mg or 120mg/5ml"
        error={errors.strength}
      >
        {(a) => (
          <TextInput
            id={`${prefix}-strength`}
            name="strength"
            required
            maxLength={40}
            defaultValue={d.strength ?? ""}
            {...a}
          />
        )}
      </FormField>
      <FormField id={`${prefix}-form`} label="Form" error={errors.form}>
        {(a) => (
          <select
            key={`form-${d.form ?? ""}`}
            id={`${prefix}-form`}
            name="form"
            required
            defaultValue={d.form ?? ""}
            aria-invalid={a.invalid || undefined}
            aria-describedby={a.describedBy}
            className="h-11 w-full rounded-lg border border-input bg-card px-3 text-sm capitalize focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none aria-invalid:border-destructive"
          >
            <option value="">Choose</option>
            {FORMS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        )}
      </FormField>
      <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
        <input
          key={`rx-${Boolean(d.prescriptionOnly)}`}
          type="checkbox"
          name="prescriptionOnly"
          defaultChecked={Boolean(d.prescriptionOnly)}
          className="size-5 accent-primary"
        />
        Prescription only (Rx)
      </label>
    </div>
  );
}

function MedicineRow({ m }) {
  const [editing, setEditing] = useState(false);
  const editButtonRef = useReturnFocus(editing);
  const [state, formAction, pending] = useActionState(updateMedicineAction, {
    status: "idle",
  });
  const formRef = useRef(null);
  useFocusFirstError(formRef, state);

  return (
    <li className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold">
            {m.brandName}{" "}
            <span className="font-normal text-muted-foreground">
              {m.strength} · {m.form}
            </span>
          </h3>
          <p className="text-sm text-muted-foreground">
            {m.genericName} · {m.manufacturer}
          </p>
        </div>
        {m.prescriptionOnly && <RxBadge />}
      </div>
      {editing ? (
        <form
          ref={formRef}
          action={formAction}
          noValidate
          className="space-y-3 border-t pt-3"
        >
          <input type="hidden" name="medicineId" value={m.id} />
          {state.formError && (
            <FocusMessage role="alert" className="text-sm text-destructive">
              {state.formError}
            </FocusMessage>
          )}
          <MedicineFields
            prefix={`edit-${m.id}`}
            errors={state.fieldErrors ?? {}}
            d={state.values ?? m}
            autoFocus
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditing(false)}
              disabled={pending}
            >
              Close
            </Button>
          </div>
          {state.status === "saved" && <Saved text="Changes accepted." />}
        </form>
      ) : (
        <Button
          ref={editButtonRef}
          variant="outline"
          onClick={() => setEditing(true)}
          aria-label={`Edit ${m.brandName} ${m.strength}`}
        >
          <Pencil aria-hidden="true" />
          Edit
        </Button>
      )}
    </li>
  );
}

function AddMedicine() {
  const [open, setOpen] = useState(false);
  const addButtonRef = useReturnFocus(open);
  const [state, formAction, pending] = useActionState(addMedicineAction, {
    status: "idle",
  });
  const formRef = useRef(null);
  useFocusFirstError(formRef, state, "#add-brand");

  if (!open) {
    return (
      <Button ref={addButtonRef} onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" />
        Add medicine
      </Button>
    );
  }
  return (
    <section
      aria-labelledby="add-med-heading"
      className="w-full space-y-3 rounded-xl border bg-card p-4"
    >
      <h2 id="add-med-heading" className="font-semibold">
        Add a medicine to the catalog
      </h2>
      <p className="text-sm text-muted-foreground">
        All fields are required; tick Rx only for prescription medicines.
      </p>
      <form ref={formRef} action={formAction} noValidate className="space-y-3">
        {state.formError && (
          <FocusMessage role="alert" className="text-sm text-destructive">
            {state.formError}
          </FocusMessage>
        )}
        <MedicineFields
          prefix="add"
          errors={state.fieldErrors ?? {}}
          d={state.values}
          autoFocus
        />
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Adding…" : "Add to catalog"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Close
          </Button>
        </div>
        {state.status === "saved" && <Saved text={`${state.name} accepted.`} />}
      </form>
    </section>
  );
}

export function CatalogManager({ medicines }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t
      ? medicines.filter((m) =>
          [m.brandName, m.genericName, m.manufacturer].some((x) =>
            x.toLowerCase().includes(t),
          ),
        )
      : medicines;
  }, [medicines, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="relative sm:w-80">
          <label htmlFor="cat-q" className="sr-only">
            Search the catalog
          </label>
          <Search
            className="pointer-events-none absolute top-3.5 left-3 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="cat-q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Brand, generic or manufacturer"
            className="h-11 pl-9"
          />
        </div>
        <AddMedicine />
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {filtered.length} of {medicines.length} medicines
      </p>
      {filtered.length === 0 ? (
        <EmptyState
          title="No medicine matches your search"
          description="Try the brand, the generic name or the manufacturer."
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {filtered.map((m) => (
            <MedicineRow key={m.id} m={m} />
          ))}
        </ul>
      )}
    </div>
  );
}
