// THE WORDS CONTRACT (ring 2026-08-14) — the domain never carries English, only KEYS; the
// words live once, in the dictionary (i18n-no-shortcuts). This module makes that seam point
// the right way for @lightseed/domain: the DOMAIN owns the manifest of every key its laws
// speak, and the app's dictionary proves coverage — a compile assertion in translations.ts
// (DomainKey extends TranslationKey) plus a runtime belt in tests. Domain depends on app:
// never again. A key added here without words there fails COMPILATION.
export const DOMAIN_KEYS = [
  // beingIndex — the lid index's refusals and descriptions
  'being_entry_home', 'rebind_kind_change',
  // lid62 — the printed short name's arithmetic
  'lid62_length', 'lid62_char',
  // limits — the node's planting caps and its fullness (the 144)
  'limit_lifetrees', 'limit_guarded', 'node_faces_full', 'node_full_seed',
  // signing — the crystal's phrase law
  'signing_seed_bytes', 'signing_phrase_words', 'signing_unknown_word',
  // stay — a request to sleep in a bed
  'stay_choose_nights', 'stay_order', 'stay_max_nights', 'stay_past',
  // gift — the suspended gift's refusals
  'gift_nothing', 'gift_whole_units', 'gift_needs_both', 'gift_own_offering',
  'gift_resting', 'gift_hold_less',
  // offering — a sound offering draft
  'offering_choose_kind', 'offering_name', 'offering_appreciation_positive',
  'offering_appreciation_whole', 'offering_link_http', 'offering_link_long',
  // the offering of care (ring 2026-09-06)
  'offering_code_link', 'offering_to_being', 'offering_from_tree',
  // charter — what a node is (ring 2026-09-06)
  'charter_version', 'charter_node_lid', 'charter_name', 'charter_domain', 'charter_faces',
  'charter_face', 'charter_project', 'charter_keeper', 'charter_push_key',
  // appearance — landing sections composed in the database (domain/appearance)
  'appearance_unknown_kind', 'appearance_bad_props',
  // lightHouse — the kinds a Light House may be consecrated as (domain/lightHouse)
  'lh_kind_temple', 'lh_kind_temple_desc', 'lh_kind_ashram', 'lh_kind_ashram_desc',
  'lh_kind_sanctuary', 'lh_kind_sanctuary_desc',
  // interbeingMatrix — typed community-to-community attestations
  'interbeing_collaborates_with', 'interbeing_collaborates_with_desc',
  'interbeing_recognises', 'interbeing_recognises_desc',
  'interbeing_shares_resources_with', 'interbeing_shares_resources_with_desc',
  // unmint — taking back an accidental head mint (domain/unmint)
  'unmint_not_author', 'unmint_not_mint', 'unmint_not_last', 'unmint_witnessed', 'unmint_coheld',
] as const;

export type DomainKey = (typeof DOMAIN_KEYS)[number];

// The ONE owner of the spoken-line format: `key::{json}` — speak() (the app's voice) parses
// exactly this shape. Both typed doors below and translations.ts's app-side spokenLine call
// through here, so the format can never fork.
export const line = (key: string, params: Record<string, string | number>): string =>
  `${key}::${JSON.stringify(params)}`;

// The domain's typed door — laws speak only manifest keys.
export const spokenLine = (key: DomainKey, params: Record<string, string | number>): string =>
  line(key, params);
