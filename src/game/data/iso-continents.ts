// ISO-3166-1 alpha-2 → continent, UN M49 geoscheme, kid-friendly names.
//
// Reference data (reviewed as data, never generated): every code is assigned
// to exactly one continent per the UN Statistics Division M49 standard
// areas. The "Americas" M49 region is split the conventional kid-friendly
// way: Central America + the Caribbean join North America.
//
// Transcontinental call-outs (deliberate, documented):
// - TR (Türkiye) → Asia. UN M49 places Türkiye in Western Asia.
// - RU (Russia) → Europe. UN M49 places the Russian Federation in Eastern
//   Europe, even though most of its land sits in Asia. We follow the UN
//   standard rather than inventing our own split.
// - EG (Egypt) → Africa. UN M49 places Egypt in Northern Africa.
// - KZ (Kazakhstan) → Asia. UN M49 places Kazakhstan in Central Asia.
// - The M49 "Antarctica" region covers AQ, BV, GS, HM, TF — uninhabited
//   territories, kept for table completeness.
// - XK (Kosovo) is user-assigned, not an official ISO code, but it appears
//   in the GeoNames chunks — assigned Europe per M49's Serbia context.
//
// Fail-closed: continentForIso2 returns null for missing, malformed, or
// unlisted codes. The Cold Trail generator treats null as a build error,
// never as a silently missing region.

export type KidContinent =
  | "North America"
  | "South America"
  | "Europe"
  | "Africa"
  | "Asia"
  | "Oceania"
  | "Antarctica";

const AFRICA: ReadonlyArray<string> = [
  // Northern Africa (UN M49)
  "DZ", "EG", "EH", "LY", "MA", "SD", "SS", "TN",
  // Western Africa
  "BF", "BJ", "CI", "CV", "GH", "GM", "GN", "GW", "LR", "ML", "MR", "NE",
  "NG", "SN", "SL", "TG",
  // Middle Africa
  "BI", "CM", "CF", "TD", "CG", "CD", "GA", "GQ", "ST",
  // Eastern + Southern Africa
  "AO", "BW", "DJ", "ER", "ET", "KE", "KM", "LS", "MG", "MW", "MU", "MZ",
  "NA", "RE", "RW", "SC", "SH", "SO", "SZ", "TZ", "UG", "YT", "ZA", "ZM", "ZW",
];

const ASIA: ReadonlyArray<string> = [
  // Western Asia (incl. TR per M49; AM/AZ/GE/CY per M49)
  "AE", "AM", "AZ", "BH", "CY", "GE", "IL", "IQ", "IR", "JO", "KW", "LB",
  "OM", "PS", "QA", "SA", "SY", "TR", "YE",
  // Central Asia (incl. KZ per M49)
  "KG", "KZ", "TJ", "TM", "UZ",
  // Eastern Asia
  "CN", "HK", "JP", "KP", "KR", "MN", "MO", "TW",
  // South-eastern Asia
  "BN", "ID", "KH", "LA", "MM", "MY", "PH", "SG", "TH", "TL", "VN",
  // Southern Asia
  "AF", "BD", "BT", "IN", "IO", "LK", "MV", "NP", "PK",
];

const EUROPE: ReadonlyArray<string> = [
  // RU per UN M49 (Eastern Europe); XK user-assigned, grouped with Europe
  "AD", "AL", "AT", "AX", "BA", "BE", "BG", "BY", "CH", "CZ", "DE", "DK",
  "EE", "ES", "FI", "FO", "FR", "GB", "GG", "GI", "GR", "HR", "HU", "IE",
  "IM", "IS", "IT", "JE", "LI", "LT", "LU", "LV", "MC", "MD", "ME", "MK",
  "MT", "NL", "NO", "PL", "PT", "RO", "RS", "RU", "SE", "SI", "SJ", "SK",
  "SM", "UA", "VA", "XK",
];

const NORTH_AMERICA: ReadonlyArray<string> = [
  // Northern America + Central America + Caribbean (M49 "Americas" split)
  "AG", "AI", "AW", "BB", "BL", "BM", "BQ", "BS", "BZ", "CA", "CR", "CU",
  "CW", "DM", "DO", "GD", "GL", "GP", "GT", "HN", "HT", "JM", "KN", "KY",
  "LC", "MF", "MQ", "MS", "MX", "NI", "PA", "PM", "PR", "SV", "SX", "TC",
  "TT", "US", "VC", "VG", "VI",
];

const SOUTH_AMERICA: ReadonlyArray<string> = [
  "AR", "BO", "BR", "CL", "CO", "EC", "FK", "GF", "GY", "PE", "PY", "SR",
  "UY", "VE",
];

const OCEANIA: ReadonlyArray<string> = [
  "AS", "AU", "CC", "CK", "CX", "FJ", "FM", "GU", "KI", "MH", "MP", "NC",
  "NF", "NR", "NU", "NZ", "PF", "PG", "PN", "PW", "SB", "TK", "TO", "TV",
  "UM", "VU", "WF", "WS",
];

const ANTARCTICA: ReadonlyArray<string> = ["AQ", "BV", "GS", "HM", "TF"];

const BY_CONTINENT: ReadonlyArray<readonly [KidContinent, ReadonlyArray<string>]> = [
  ["Africa", AFRICA],
  ["Asia", ASIA],
  ["Europe", EUROPE],
  ["North America", NORTH_AMERICA],
  ["South America", SOUTH_AMERICA],
  ["Oceania", OCEANIA],
  ["Antarctica", ANTARCTICA],
];

const ISO_TO_CONTINENT: ReadonlyMap<string, KidContinent> = new Map(
  BY_CONTINENT.flatMap(([continent, codes]) =>
    codes.map((code): [string, KidContinent] => [code, continent]),
  ),
);

/**
 * Fail-closed ISO-3166-1 alpha-2 → kid-friendly continent name.
 * Returns null for anything unresolvable: missing/malformed codes or codes
 * with no table entry. Never throws, never echoes the raw code.
 */
export function continentForIso2(iso2: string | null | undefined): KidContinent | null {
  if (typeof iso2 !== "string") return null;
  const code = iso2.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  return ISO_TO_CONTINENT.get(code) ?? null;
}
