// Search results (CLAUDE.md "Search", D3): approved pharmacies within 5 km,
// nearest first; if none has stock, the nearest ones further away, labelled.
import { PackageSearch } from "lucide-react";
import { EmptyState } from "@/components/states";
import { ResultCard } from "@/components/search/result-card";
import { SearchForm } from "@/components/search/search-form";
import { findArea } from "@/lib/areas";
import { SEARCH_RADIUS_KM } from "@/lib/constants";
import { searchMedicine } from "@/lib/data/customer";

export async function generateMetadata({ searchParams }) {
  const { q } = await searchParams;
  return { title: q ? `"${String(q).slice(0, 40)}" near you` : "Search" };
}

// Rough box around Bangladesh; anything else is treated as "no location".
const inBangladesh = (lat, lng) => lat > 20 && lat < 27 && lng > 88 && lng < 93;

// Query values can repeat (?q=a&q=b); use the first, as a string.
const one = (v) => String(Array.isArray(v) ? v[0] : (v ?? ""));
const MIN_QUERY = 2; // same rule as the search form

function readLocation({ area, lat, lng }) {
  const a = findArea(one(area));
  if (a)
    return {
      coords: { lat: a.lat, lng: a.lng },
      form: { kind: "area", id: a.id },
    };
  // Number(), not parseFloat: "23.7abc" must not count as a coordinate.
  const la = one(lat) === "" ? NaN : Number(one(lat));
  const ln = one(lng) === "" ? NaN : Number(one(lng));
  if (Number.isFinite(la) && Number.isFinite(ln) && inBangladesh(la, ln))
    return {
      coords: { lat: la, lng: ln },
      form: { kind: "gps", lat: la, lng: ln },
    };
  return { coords: null, form: null };
}

export default async function SearchPage({ searchParams }) {
  const params = await searchParams;
  const q = one(params.q).slice(0, 60);
  const tooShort = q.trim().length < MIN_QUERY;
  const { coords, form } = readLocation(params);

  const result = await searchMedicine({
    query: tooShort ? "" : q,
    lat: coords?.lat,
    lng: coords?.lng,
  });
  const { withinRadius, outsideRadius, needsLocation } = result;
  const searched = !tooShort && !needsLocation;

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Search results</h1>
      <SearchForm
        key={`${q}|${params.area ?? ""}|${params.lat ?? ""}|${params.lng ?? ""}`}
        variant="compact"
        initial={{ q, location: form }}
      />

      {!needsLocation && tooShort && (
        <EmptyState
          icon={PackageSearch}
          title="What are you looking for?"
          description="Type at least 2 letters of a medicine name, brand or generic."
        />
      )}

      {needsLocation && (
        <EmptyState
          title="Where are you?"
          description="Choose your area or use your location, so we can show pharmacies near you."
        />
      )}

      {searched && withinRadius.length === 0 && outsideRadius.length === 0 && (
        <EmptyState
          icon={PackageSearch}
          title={`No pharmacy has "${q}" right now`}
          description="Check the spelling, or try the generic name (for example Paracetamol instead of Napa)."
        />
      )}

      {withinRadius.length > 0 && (
        <section aria-labelledby="near-heading" className="space-y-3">
          <h2 id="near-heading" className="text-lg font-semibold">
            Within {SEARCH_RADIUS_KM} km{" "}
            <span className="text-sm font-normal text-muted-foreground">
              · {withinRadius.length}{" "}
              {withinRadius.length === 1 ? "result" : "results"}, nearest first
            </span>
          </h2>
          <ul className="space-y-3">
            {withinRadius.map((r) => (
              <ResultCard key={`${r.pharmacyId}-${r.medicine.id}`} result={r} />
            ))}
          </ul>
        </section>
      )}

      {searched && outsideRadius.length > 0 && (
        <section aria-labelledby="far-heading" className="space-y-3">
          <h2 id="far-heading" className="text-lg font-semibold">
            Outside {SEARCH_RADIUS_KM} km
          </h2>
          <p className="text-sm text-muted-foreground">
            {withinRadius.length === 0
              ? `No pharmacy within ${SEARCH_RADIUS_KM} km has "${q}". These are the nearest ones that do.`
              : `None of the pharmacies within ${SEARCH_RADIUS_KM} km has it in stock. These are the nearest ones that do.`}
          </p>
          <ul className="space-y-3">
            {outsideRadius.map((r) => (
              <ResultCard key={`${r.pharmacyId}-${r.medicine.id}`} result={r} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
