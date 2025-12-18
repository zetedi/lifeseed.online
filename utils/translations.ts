
export type Language = 'en' | 'es' | 'hu' | 'qu' | 'sa' | 'ja' | 'ar' | 'sw';

const baseKeys = {
  forest: "Forest", pulses: "Pulses", visions: "Visions", oracle: "Oracle", about: "About", explore: "Explore",
  sign_in: "Sign in", sign_out: "Sign out", emit_pulse: "Emit Pulse", plant_lifetree: "Plant Lifetree",
  create_vision: "New Vision", short_title: "Short Title", vision: "Vision", title: "Title", body: "Body",
  webpage: "Webpage Link", mint: "Mint Pulse", generate: "Generate", generate_image: "Gen Image",
  block: "BLOCK", loading: "Loading...", planting: "Planting...", minting: "Minting...", creating: "Creating...",
  map_view: "Map View", list_view: "List View", upload_photo: "Upload Photo", validated: "VALIDATED",
  unvalidated: "Unvalidated", validate_action: "Validate Tree", quick_snap: "Quick Snap", back_forest: "Back",
  genesis: "Genesis Hash", steward: "Steward", location: "Location", tree_details: "Tree Details",
  profile: "Profile", my_trees: "My Trees", my_pulses: "My Pulses", my_matches: "My Matches",
  edit: "Edit", be_mother_tree: "Plant a Lifetree", guard_tree: "Guard Tree", matches: "Matches",
  pending_matches: "Pending Matches", no_pending_resonance: "No Resonance", search_placeholder: "Search...",
  guard: "Guard", nature: "Nature", lifetrees: "Lifetrees", no_trees_found: "None found", pending: "Pending",
  growth: "Growth", loves: "Loves", oracle_greeting: "Greetings, Seeker. I am the Oracle. Shall I help you plant your Lifetree, or guide you on the path to realizing your Vision?", ask_oracle: "Ask the Oracle...",
  more: "More", send_invite: "Send Invite", invitations: "Invitations", invites_remaining: "Invites Remaining",
  copy_invite: "Copy Link", delete_account: "Delete Account", delete_confirm_title: "Delete Profile",
  delete_confirm_desc: "This will delete all your data forever.", delete_goodbye: "Goodbye.",
  ai_login_required: "Sign in to use AI.", subscription_title: "One email every 7 weeks.", subscribe_action: "Subscribe",
  subscribed_success: "Subscribed!", invalid_email: "Invalid email", latest_hash: "Latest Hash",
  daily_limit_image: "Daily Vision limit reached (3/3).", daily_limit_text: "Daily Oracle limit reached (21/21).",
  ether_quiet: "The ether is quiet, no resonance detected.", match_request: "Match Request",
  from_another_tree: "from another tree", accept_sync: "Accept Sync", no_visions_found: "No visions found.",
  propose_match: "Propose Match", matching_with: "Matching with", match_request_desc: "Send a resonance request.",
  internal_pulse: "Internal (Growth) Pulse", send_request: "Send Request", invite_sent: "Invite sent!",
  invite_email_placeholder: "Friend's email", invite_message_placeholder: "Message (optional)",
  cancel: "Cancel", back: "Back", subscription_failed: "Failed.", stand_for_trees: "Stand for the Trees",
  subscribe: "Subscribe", subscription_desc: "Email every 7 weeks.", guard_tree_action: "Guard Tree",
  create_new_world: "Create a New World",
  type_lifetree: "Lifetree", type_guarded: "Guarded", type_kabbalistic: "Kabbalistic", type_family: "Family"
};

export const translations: Record<Language, typeof baseKeys> = {
  en: baseKeys,
  es: { 
    ...baseKeys, forest: "Bosque", pulses: "Pulsos", visions: "Visiones", oracle: "Oráculo", about: "Acerca de", explore: "Explorar", 
    sign_in: "Iniciar sesión", sign_out: "Cerrar sesión", plant_lifetree: "Plantar Árbol", emit_pulse: "Emitir Pulso", 
    be_mother_tree: "Planta un Árbol de Vida", loading: "Cargando...", my_trees: "Mis Árboles", profile: "Perfil",
    pending_matches: "Coincidencias Pendientes", quick_snap: "Foto Rápida", validated: "VALIDADO", 
    validate_action: "Validar Árbol", create_vision: "Nueva Visión", create_new_world: "Crea un Nuevo Mundo"
  },
  hu: { 
    ...baseKeys, forest: "Erdő", pulses: "Pulzusok", visions: "Víziók", oracle: "Orákulum", about: "Rólunk", explore: "Felfedezés", 
    sign_in: "Belépés", sign_out: "Kilépés", plant_lifetree: "Ültetés", emit_pulse: "Pulzus", 
    be_mother_tree: "Ültess Életfát", loading: "Töltés...", my_trees: "Fáim", profile: "Profil",
    pending_matches: "Függőben", quick_snap: "Gyors Fotó", validated: "HITELESÍTVE", 
    validate_action: "Hitelesítés", create_vision: "Új Vízió", create_new_world: "Teremts Új Világot"
  },
  qu: { 
    ...baseKeys, forest: "Sach'a", pulses: "Sirkay", visions: "Musquy", oracle: "Willaq", about: "Kaymanta", explore: "Maskay", 
    sign_in: "Yaykuy", sign_out: "Lloqsiy", plant_lifetree: "Tarpuy", emit_pulse: "Sirkay", 
    be_mother_tree: "Mama Sach'a", loading: "Cargachkan...", my_trees: "Mallkikuna", profile: "Uyan",
    pending_matches: "Suyaq", quick_snap: "Utqaylla", validated: "CHASKISQA", 
    validate_action: "Chaskiy", create_vision: "Musquy", create_new_world: "Musuq Pachata Ruray"
  },
  sa: { 
    ...baseKeys, forest: "अरण्यम्", pulses: "स्पन्दनानि", visions: "दृष्टयः", oracle: "दैववाणी", about: "विषये", explore: "अन्वेषणम्", 
    sign_in: "प्रविशतु", sign_out: "निर्गच्छतु", plant_lifetree: "रोपयतु", emit_pulse: "स्पन्दनम्", 
    be_mother_tree: "जीवनवृक्षं रोपयतु", loading: "आरोचयति...", my_trees: "वृक्षाः", profile: "परिचयः",
    pending_matches: "लम्बित", quick_snap: "शीघ्रम्", validated: "प्रमाणित", 
    validate_action: "प्रमाणयतु", create_vision: "दृष्टिः", create_new_world: "नवं लोकं सृजतु"
  },
  ja: { 
    ...baseKeys, forest: "森", pulses: "パルス", visions: "ビジョン", oracle: "オラクル", about: "詳細", explore: "探索", 
    sign_in: "ログイン", sign_out: "ログアウト", plant_lifetree: "植樹", emit_pulse: "パルス", 
    be_mother_tree: "命の木を植える", loading: "読込中...", my_trees: "木", profile: "プロフ",
    pending_matches: "保留中", quick_snap: "スナップ", validated: "認証済", 
    validate_action: "認証", create_vision: "ビジョン", create_new_world: "新しい世界を創造する"
  },
  ar: { 
    ...baseKeys, forest: "الغابة", pulses: "نبضات", visions: "رؤى", oracle: "عراف", about: "عن", explore: "استكشاف", 
    sign_in: "دخول", sign_out: "خروج", plant_lifetree: "زرع", emit_pulse: "نبضة", 
    be_mother_tree: "ازرع شجرة حياة", loading: "تحميل...", my_trees: "أشجاري", profile: "ملف",
    pending_matches: "معلقة", quick_snap: "لقطة", validated: "مصدق", 
    validate_action: "صدق", create_vision: "رؤية", create_new_world: "اخلق عالما جديدا"
  },
  sw: { 
    ...baseKeys, forest: "Msitu", pulses: "Mapigo", visions: "Maono", oracle: "Mtabiri", about: "Kuhusu", explore: "Chunguza", 
    sign_in: "Ingia", sign_out: "Toka", plant_lifetree: "Panda", emit_pulse: "Pigo", 
    be_mother_tree: "Panda Mti wa Uhai", loading: "Inapakia...", my_trees: "Miti yangu", profile: "Wasifu",
    pending_matches: "Subiri", quick_snap: "Picha", validated: "IMETHIBITISHWA", 
    validate_action: "Thibitisha", create_vision: "Ono", create_new_world: "Unda Ulimwengu Mpya"
  }
};
