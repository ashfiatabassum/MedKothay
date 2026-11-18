// Dhaka areas for the location picker (used when the browser location is not
// shared). Centre points are approximate. Kept in code, not the database: it is a
// fixed list and both the customer picker and pharmacy registration use it.
export const AREAS = [
  { id: "dhanmondi", name: "Dhanmondi", lat: 23.7461, lng: 90.3742 },
  { id: "mirpur-10", name: "Mirpur 10", lat: 23.8069, lng: 90.3687 },
  { id: "uttara-7", name: "Uttara Sector 7", lat: 23.8728, lng: 90.3984 },
  { id: "bashundhara", name: "Bashundhara R/A", lat: 23.8193, lng: 90.4526 },
  { id: "mohakhali", name: "Mohakhali", lat: 23.7778, lng: 90.4057 },
  { id: "banani", name: "Banani", lat: 23.7937, lng: 90.4066 },
  { id: "gulshan-1", name: "Gulshan 1", lat: 23.7806, lng: 90.4167 },
  { id: "motijheel", name: "Motijheel", lat: 23.733, lng: 90.4172 },
];

export function findArea(id) {
  return AREAS.find((a) => a.id === id) ?? null;
}
