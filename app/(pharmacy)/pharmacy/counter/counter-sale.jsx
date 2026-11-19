"use client";

// Counter sale: find by brand or generic, add, set quantities, complete.
// Only available stock can be sold; units on hold for a reservation are
// blocked with a message saying how many are reserved (CLAUDE.md "Counter sale").
import { useMemo, useRef, useState, useTransition } from "react";
import { CircleCheck, Minus, Plus, Search, Trash2 } from "lucide-react";
import { RxBadge, StockBadge } from "@/components/badges";
import { FocusMessage, SuccessHeading } from "@/components/form-field";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_SALE_LINES, formatTaka } from "@/lib/constants";
import { completeSaleAction } from "../actions";

export function CounterSale({ stock }) {
  const [q, setQ] = useState("");
  const [lines, setLines] = useState([]); // [{ medicineId, quantity }]
  const [result, setResult] = useState(null);
  const [pending, startTransition] = useTransition();
  const searchRef = useRef(null);

  const byId = useMemo(
    () => new Map(stock.map((s) => [s.medicineId, s])),
    [stock],
  );
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    return stock
      .filter(
        (s) =>
          s.brandName.toLowerCase().includes(t) ||
          s.genericName.toLowerCase().includes(t),
      )
      .slice(0, 8);
  }, [stock, q]);

  const change = (fn) => {
    setResult(null);
    setLines(fn);
  };
  const full = lines.length >= MAX_SALE_LINES;
  const add = (id) =>
    change((ls) =>
      ls.some((l) => l.medicineId === id) || ls.length >= MAX_SALE_LINES
        ? ls
        : [...ls, { medicineId: id, quantity: 1 }],
    );
  // Quantity may be "" while the person is typing; it becomes 1..1000 on blur.
  const setQty = (id, n) =>
    change((ls) =>
      ls.map((l) =>
        l.medicineId === id
          ? {
              ...l,
              quantity:
                n === ""
                  ? ""
                  : Math.max(1, Math.min(1000, Math.trunc(Number(n)) || 1)),
            }
          : l,
      ),
    );
  const removeLine = (id) =>
    change((ls) => ls.filter((l) => l.medicineId !== id));

  const total = lines.reduce(
    (sum, l) =>
      sum +
      (Number(l.quantity) || 0) * (byId.get(l.medicineId)?.sellingPrice ?? 0),
    0,
  );

  function complete() {
    setResult(null);
    startTransition(async () => {
      const res = await completeSaleAction({
        items: lines.map((l) => ({ ...l, quantity: Number(l.quantity) || 1 })),
      });
      setResult(res);
      if (res.status === "sold") {
        setLines([]);
        setQ("");
      }
    });
  }

  if (result?.status === "sold") {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-3 rounded-xl border bg-card px-5 py-8 text-center"
      >
        <CircleCheck
          className="size-10 text-in-stock-foreground"
          aria-hidden="true"
        />
        <SuccessHeading>
          Sale complete · {formatTaka(result.total)}
        </SuccessHeading>
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          Demo: sales and stock changes are saved from step W2.
        </p>
        <Button
          onClick={() => {
            setResult(null);
            setTimeout(() => searchRef.current?.focus(), 0);
          }}
        >
          New sale
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section aria-labelledby="find-heading" className="space-y-3">
        <h2 id="find-heading" className="font-semibold">
          Find medicine
        </h2>
        <div className="relative">
          <label htmlFor="counter-q" className="sr-only">
            Search brand or generic
          </label>
          <Search
            className="pointer-events-none absolute top-3.5 left-3 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            ref={searchRef}
            id="counter-q"
            type="search"
            value={q}
            autoFocus
            onChange={(e) => setQ(e.target.value)}
            placeholder="Brand or generic, e.g. Napa"
            className="h-11 pl-9"
            autoComplete="off"
          />
        </div>
        {q.trim().length >= 2 && matches.length === 0 && (
          <p className="text-sm text-muted-foreground">Not in your stock.</p>
        )}
        {full && (
          <p className="text-sm text-muted-foreground">
            This sale has {MAX_SALE_LINES} medicines, the most one sale can
            hold. Complete it, then start a new sale.
          </p>
        )}
        <ul className="space-y-2">
          {matches.map((s) => {
            const inSale = lines.some((l) => l.medicineId === s.medicineId);
            return (
              <li
                key={s.medicineId}
                className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3"
              >
                <div className="min-w-0 text-sm">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {s.brandName}{" "}
                    <span className="font-normal text-muted-foreground">
                      {s.strength}
                    </span>
                    {s.prescriptionOnly && <RxBadge />}
                  </p>
                  <p className="text-muted-foreground tabular-nums">
                    Can sell {s.available}
                    {s.heldQuantity > 0 &&
                      ` · ${s.heldQuantity} reserved`} ·{" "}
                    {formatTaka(s.sellingPrice)}
                  </p>
                </div>
                <Button
                  variant={inSale ? "secondary" : "outline"}
                  onClick={() => add(s.medicineId)}
                  // Locked while a sale is being completed, so nothing is
                  // added after the request was sent.
                  disabled={
                    inSale || s.available <= 0 || pending || (full && !inSale)
                  }
                  aria-label={`${inSale ? "Added" : s.available <= 0 ? (s.heldQuantity > 0 ? "All reserved" : "None left") : "Add"}: ${s.brandName} ${s.strength}`}
                >
                  {inSale
                    ? "Added"
                    : s.available <= 0
                      ? s.heldQuantity > 0
                        ? "All reserved"
                        : "None left"
                      : "Add"}
                </Button>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="sale-heading" className="space-y-3">
        <h2 id="sale-heading" className="font-semibold">
          This sale
        </h2>
        {lines.length === 0 ? (
          <EmptyState
            title="No items yet"
            description="Search for a medicine and add it."
            headingLevel={3}
          />
        ) : (
          <div className="space-y-3 rounded-xl border bg-card p-4">
            <ul className="divide-y">
              {lines.map((l) => {
                const s = byId.get(l.medicineId);
                const blocked =
                  result?.status === "error" &&
                  result.medicineId === l.medicineId;
                return (
                  <li
                    key={l.medicineId}
                    className={
                      "flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between" +
                      (blocked ? " rounded-lg bg-destructive/5 px-2" : "")
                    }
                  >
                    <div className="min-w-0">
                      <p className="font-medium">
                        {s.brandName} {s.strength}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <StockBadge band={s.band} />
                        <span className="tabular-nums">
                          {formatTaka(s.sellingPrice)} each
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setQty(l.medicineId, (Number(l.quantity) || 1) - 1)
                        }
                        disabled={!(l.quantity > 1) || pending}
                        aria-label={`One less ${s.brandName}`}
                      >
                        <Minus aria-hidden="true" />
                      </Button>
                      <label
                        className="sr-only"
                        htmlFor={`qty-${l.medicineId}`}
                      >
                        Quantity of {s.brandName}
                      </label>
                      <Input
                        id={`qty-${l.medicineId}`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={l.quantity}
                        disabled={pending}
                        onChange={(e) => setQty(l.medicineId, e.target.value)}
                        onBlur={() =>
                          l.quantity === "" && setQty(l.medicineId, 1)
                        }
                        className="h-10 w-16 text-center tabular-nums"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setQty(l.medicineId, (Number(l.quantity) || 0) + 1)
                        }
                        disabled={pending}
                        aria-label={`One more ${s.brandName}`}
                      >
                        <Plus aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLine(l.medicineId)}
                        disabled={pending}
                        aria-label={`Remove ${s.brandName}`}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="flex justify-between border-t pt-3 font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatTaka(total)}</span>
            </div>
            {result?.status === "error" && (
              <FocusMessage
                key={result.message}
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {result.message}
              </FocusMessage>
            )}
            <Button
              size="lg"
              className="w-full"
              onClick={complete}
              disabled={pending}
            >
              {pending ? "Completing…" : "Complete sale"}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
