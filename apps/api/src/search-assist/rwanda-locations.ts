// Known Rwandan cities/places with their approximate centre and a sensible
// search radius. The search API filters geographically (PostGIS on the
// provider's home base or service-area circle) but has no geocoder of its
// own, so a place named by a client — or by the AI search interpreter — is
// resolved here instead. Deliberately a fixed list rather than a geocoding
// call: the product's coverage is Rwanda, a short offline table beats a
// network round trip, and an unknown name simply does not resolve (the
// caller reports it as skipped instead of guessing coordinates).
export interface RwandanLocation {
  /** Display label used in search chips. */
  label: string;
  lat: number;
  lng: number;
  /** Default search radius around the centre, in km. */
  radiusKm: number;
  /** Names and former/colonial spellings matched case-insensitively. */
  aliases: string[];
}

export const RWANDA_LOCATIONS: RwandanLocation[] = [
  { label: 'Kigali', lat: -1.9441, lng: 30.0619, radiusKm: 30, aliases: ['kigali'] },
  { label: 'Huye (Butare)', lat: -2.6078, lng: 29.7335, radiusKm: 25, aliases: ['huye', 'butare'] },
  { label: 'Rubavu (Gisenyi)', lat: -1.6771, lng: 29.2589, radiusKm: 25, aliases: ['rubavu', 'gisenyi'] },
  { label: 'Musanze (Ruhengeri)', lat: -1.4996, lng: 29.6344, radiusKm: 25, aliases: ['musanze', 'ruhengeri'] },
  { label: 'Karongi (Kibuye)', lat: -2.0774, lng: 29.2579, radiusKm: 25, aliases: ['karongi', 'kibuye'] },
  { label: 'Nyagatare', lat: -1.2924, lng: 30.327, radiusKm: 25, aliases: ['nyagatare'] },
  { label: 'Rwamagana', lat: -1.949, lng: 30.4346, radiusKm: 20, aliases: ['rwamagana'] },
  { label: 'Muhanga', lat: -2.0774, lng: 29.7567, radiusKm: 20, aliases: ['muhanga', 'gitarama'] },
  { label: 'Ruhango', lat: -2.1774, lng: 29.7895, radiusKm: 20, aliases: ['ruhango'] },
  { label: 'Nsanza', lat: -2.3519, lng: 29.3337, radiusKm: 20, aliases: ['nsanza', 'nyanza'] },
  { label: 'Rusizi', lat: -2.4841, lng: 28.9079, radiusKm: 25, aliases: ['rusizi', 'cyangugu'] },
  { label: 'Rulindo', lat: -1.8583, lng: 29.9806, radiusKm: 20, aliases: ['rulindo'] },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Resolve a place mentioned in free text to a known Rwandan location.
 * Longest alias first so "huye" cannot shadow a longer name, and every
 * match is word-boundary based — "nyanza" must not match "nyanzamasheke".
 */
export function resolveRwandaLocation(text: string | null | undefined): RwandanLocation | undefined {
  if (!text) return undefined;
  const haystack = ` ${normalize(text)} `;
  const entries = RWANDA_LOCATIONS.flatMap((loc) =>
    loc.aliases.map((alias) => ({ loc, alias: normalize(alias) })),
  ).sort((a, b) => b.alias.length - a.alias.length);

  for (const { loc, alias } of entries) {
    if (haystack.includes(` ${alias} `)) return loc;
  }
  return undefined;
}
