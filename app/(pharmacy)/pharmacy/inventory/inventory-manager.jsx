"use client";

// Inventory list with search, inline edit and "Add medicine". Pharmacists see
// exact numbers for their own shop. Saving is checked on the server.
import { useActionState, useId, useMemo, useRef, useState } from "react";
import { CircleCheck, Pencil, Plus, Search } from "lucide-react";
import { RxBadge, StockBadge } from "@/components/badges";
import {
  FocusMessage,
  FormField,
  TextInput,
  useFocusFirstError,
  useReturnFocus,
} from "@/components/form-field";
import { EmptyState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { perUnit } from "@/lib/constants";
import { addStockAction, updateStockAction } from "../actions";

const today = () =>
  new Date(Date.now() + 6 * 3_600_000).toISOString().slice(0, 10);

function Saved({ text }) {
  return (
    <FocusMessage className="flex items-center gap-1 text-sm text-in-stock-foreground">
      <CircleCheck className="size-4" aria-hidden="true" />
      {text}
    </FocusMessage>
  );
}

// `editing`: existing stock may have a past expiry (it can be corrected or set
// to 0); new stock must expire in the future.
function StockFields({
  idPrefix,
  errors,
  defaults = {},
  editing = false,
  autoFocus = false,
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <FormField
        id={`${idPrefix}-qty`}
        label="Quantity on shelf"
        error={errors.quantity}
      >
        {(a) => (
          <TextInput
            autoFocus={autoFocus}
            id={`${idPrefix}-qty`}
            name="quantity"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            required
            defaultValue={defaults.quantity ?? ""}
            {...a}
          />
        )}
      </FormField>
      <FormField
        id={`${idPrefix}-price`}
        label="Selling price (৳ per tablet, capsule, bottle or vial)"
        error={errors.sellingPrice}
      >
        {(a) => (
          <TextInput
            id={`${idPrefix}-price`}
            name="sellingPrice"
            type="number"
            inputMode="decimal"
            min={0.01}
            step={0.01}
            required
            defaultValue={defaults.sellingPrice ?? ""}
            {...a}
          />
        )}
      </FormField>
      <FormField
        id={`${idPrefix}-exp`}
        label="Expiry date"
        error={errors.expiryDate}
      >
        {(a) => (
          <TextInput
            id={`${idPrefix}-exp`}
            name="expiryDate"
            type="date"
            min={editing ? undefined : today()}
            required
            defaultValue={defaults.expiryDate ?? ""}
            {...a}
          />
        )}
      </FormField>
    </div>
  );
}

function InventoryRow({ row }) {
  const [editing, setEditing] = useState(false);
  const editButtonRef = useReturnFocus(editing);
  const [state, formAction, pending] = useActionState(updateStockAction, {
    status: "idle",
  });
  const formRef = useRef(null);
  useFocusFirstError(formRef, state);
  const errors = state.fieldErrors ?? {};
  const prefix = useId();

  return (
    <li className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold">
            {row.brandName}{" "}
            <span className="font-normal text-muted-foreground">
              {row.strength} · {row.form}
            </span>
          </h3>
          <p className="text-sm text-muted-foreground">
            {row.genericName} · {row.manufacturer}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StockBadge band={row.band} />
          {row.prescriptionOnly && <RxBadge />}
          {row.expired && (
            <Badge className="border-transparent bg-destructive text-white">
              Expired: can&apos;t be sold or reserved
            </Badge>
          )}
          {row.expiringSoon && (
            <Badge className="border-transparent bg-destructive/10 text-destructive">
              Expires soon
            </Badge>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-5">
        <div>
          <dt className="text-muted-foreground">On shelf</dt>
          <dd className="font-medium tabular-nums">{row.quantity}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Reserved</dt>
          <dd className="font-medium tabular-nums">{row.heldQuantity}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Can sell</dt>
          <dd className="font-semibold tabular-nums">{row.available}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Price</dt>
          <dd className="font-medium tabular-nums">
            {perUnit(row.sellingPrice, row.form)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Expiry</dt>
          <dd className="font-medium tabular-nums">{row.expiryDate}</dd>
        </div>
      </dl>

      {state.status === "saved" && !editing && (
        <Saved text="Changes accepted." />
      )}

      {editing ? (
        <form
          ref={formRef}
          action={formAction}
          noValidate
          className="space-y-3 border-t pt-3"
        >
          <input type="hidden" name="medicineId" value={row.medicineId} />
          {state.formError && (
            <p role="alert" className="text-sm text-destructive">
              {state.formError}
            </p>
          )}
          <StockFields
            idPrefix={prefix}
            errors={errors}
            defaults={state.values ?? row}
            editing
            autoFocus
          />
          {row.heldQuantity > 0 && (
            <p className="text-xs text-muted-foreground">
              {row.heldQuantity} reserved for pickup: quantity can&apos;t go
              below {row.heldQuantity}.
            </p>
          )}
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
        >
          <Pencil aria-hidden="true" />
          Edit stock
        </Button>
      )}
    </li>
  );
}

function AddStock({ catalog }) {
  const [open, setOpen] = useState(false);
  const addButtonRef = useReturnFocus(open);
  const [state, formAction, pending] = useActionState(addStockAction, {
    status: "idle",
  });
  const formRef = useRef(null);
  useFocusFirstError(formRef, state, 'select[name="medicineId"]');
  const errors = state.fieldErrors ?? {};

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
      aria-labelledby="add-heading"
      className="space-y-3 rounded-xl border bg-card p-4"
    >
      <h2 id="add-heading" className="font-semibold">
        Add a medicine from the catalog
      </h2>
      <form ref={formRef} action={formAction} noValidate className="space-y-3">
        {state.formError && (
          <p role="alert" className="text-sm text-destructive">
            {state.formError}
          </p>
        )}
        <FormField id="add-med" label="Medicine" error={errors.medicineId}>
          {(a) => (
            <select
              autoFocus
              id="add-med"
              name="medicineId"
              required
              key={state.values?.medicineId ?? ""}
              defaultValue={state.values?.medicineId ?? ""}
              aria-invalid={a.invalid || undefined}
              aria-describedby={a.describedBy}
              className="h-11 w-full rounded-lg border border-input bg-card px-3 text-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <option value="">Choose from the catalog</option>
              {catalog.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          )}
        </FormField>
        <StockFields idPrefix="add" errors={errors} defaults={state.values} />
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Adding…" : "Add to stock"}
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
        {state.status === "saved" && <Saved text="Medicine accepted." />}
      </form>
    </section>
  );
}

export function InventoryManager({ rows, catalog }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t
      ? rows.filter(
          (r) =>
            r.brandName.toLowerCase().includes(t) ||
            r.genericName.toLowerCase().includes(t),
        )
      : rows;
  }, [rows, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="relative sm:w-80">
          <label htmlFor="inv-q" className="sr-only">
            Search your stock
          </label>
          <Search
            className="pointer-events-none absolute top-3.5 left-3 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="inv-q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search brand or generic"
            className="h-11 pl-9"
          />
        </div>
        <AddStock catalog={catalog} />
      </div>
      <p className="text-sm text-muted-foreground">
        Medicine not in the catalog? Contact the MedKothay admin to add it.
      </p>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {filtered.length} of {rows.length} medicines
      </p>
      {filtered.length === 0 ? (
        <EmptyState
          title={
            rows.length ? "No medicine matches your search" : "No stock yet"
          }
          description={
            rows.length
              ? "Try the brand or the generic name."
              : "Add your first medicine from the catalog."
          }
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((r) => (
            <InventoryRow key={r.medicineId} row={r} />
          ))}
        </ul>
      )}
    </div>
  );
}
