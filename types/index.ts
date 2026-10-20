export interface Comment {
  id: number | string;
  author: string;
  content: string;
  createdAt: string;
  avatar?: string;
  /** The agent wrote it (vs the client). */
  isAgent?: boolean;
}

export interface PropertyInteraction {
  id: string;
  collection_id: string;
  property_id: string;
  user_id?: string;
  visitor_email?: string;
  liked: boolean;
  disliked: boolean;
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: string;
  ListingKey: string;
  ListingId?: string; // MLS Number
  FullStreetAddress: string;
  UnparsedAddress?: string;
  City: string;
  StateOrProvince: string;
  PostalCode?: string;

  ListPrice?: number;
  BedroomsTotal?: number;
  BathroomsTotal?: number;
  LivingArea?: number;
  LotSizeSquareFeet?: number;
  PropertyType?: string;
  MlsStatus: string;

  SubdivisionName?: string;

  ListPictureURL?: string;
  photos?: string[];
  Latitude?: number;
  Longitude?: number;

  // Hosting agent, for the open house Sign-In Sheet's branding block
  agentName?: string;
  agentBrokerage?: string;
  spotlightUrl?: string;
  agentPhotoUrl?: string | null;
  /** The hosting agent - whose QR centre logo the Sign-In Sheet draws. */
  agentId?: string;

  DaysOnMarket?: number;
  YearBuilt?: number;
  MLSListDate?: string;
  PriceChangeTimestamp?: string;
  PricePerSquareFoot?: number;
  IncorporatedCityName?: string;
  ModificationTimestamp?: string;

  // Collection metadata
  added_at?: string;
  is_new?: boolean;
  /** Upcoming MLS open houses, soonest first (lib/mlsOpenHouses). */
  open_houses?: { date: string; start?: string | null; end?: string | null }[] | null;
  AddedToCollectionAt?: string | null;
  liked?: boolean;
  disliked?: boolean;
  /** The agent's "I recommend this home for you" (Showcase) - tagged on the card, sorted first. */
  agentRecommended?: boolean;
  viewed?: boolean;
  viewCount?: number;
  lastViewedAt?: string;
  comments?: Comment[];
  unreadCommentCount?: number;
  visitorInteractions?: PropertyInteraction[];
  tourCount?: number;
  hasTourScheduled?: boolean;
  /** The buyer's showing request for this home: waiting on the agent, confirmed, or toured. */
  tourStatus?: 'pending' | 'confirmed' | 'done';
  updated_at?: string;
  LotSizeAcres?: number;
  SchoolDistrictName?: string;
}

export interface PropertyDetailResponse extends Property {
  PublicRemarks?: string;
  photos?: string[];

  // Listing Agent & Office
  ListAgentFullName?: string;
  ListAgentEmail?: string;
  ListAgentPreferredPhone?: string;
  ListOfficeName?: string;
  ListOfficePhone?: string;

  // Features
  ArchitecturalStyle?: string[];
  ConstructionMaterials?: string[];
  Roof?: string[];
  FoundationDetails?: string[];
  StructureType?: string[];
  Levels?: string[];

  InteriorFeatures?: string[];
  ExteriorFeatures?: string[];
  Flooring?: string[];
  Appliances?: string[];
  FireplacesTotal?: number;
  FireplaceFeatures?: string[];
  DoorFeatures?: string[];
  WindowFeatures?: string[];

  Cooling?: string[];
  Heating?: string[];
  WaterSource?: string[];
  Sewer?: string[];
  Utilities?: string[];

  AboveGradeFinishedArea?: number;
  BelowGradeFinishedArea?: number;
  Basement?: string[];
  AccessibilityFeatures?: string[];

  BasementYN?: boolean;
  CentralAirYN?: boolean;
  FireplaceYN?: boolean;

  GarageSpaces?: number;
  ParkingFeatures?: string[];
  GarageYN?: boolean;

  AssociationFee?: number;
  AssociationFeeFrequency?: string;
  AssociationFee2?: number;
  AssociationFee2Frequency?: string;
  AssociationAmenities?: string[];
  AssociationFeeIncludes?: string[];
  AssociationYN?: boolean;

  LotFeatures?: string[];
  View?: string[];
  WaterfrontFeatures?: string[];
  WaterfrontViewYN?: boolean;
  ViewYN?: boolean;

  TaxAnnualAmount?: number;
  TaxYear?: number;
  ListingTaxID?: string;

  ElementarySchool?: string;
  MiddleOrJuniorSchool?: string;
  HighSchool?: string;
  SchoolDistrictName?: string;

  County?: string;
  MLSAreaMajor?: string;
  Directions?: string;
  Zoning?: string;

  TaxAssessmentAmount?: number;
  AssessmentYear?: number;
  Possession?: string[];

  CoolingFuel?: string[];
  HeatingFuel?: string[];
  LotSizeAcres?: number;
  AttachedGarageYN?: boolean;
  NewConstructionYN?: boolean;
  SeniorCommunityYN?: boolean;
  PetsAllowed?: string[];

  OriginalListPrice?: number;
  CumulativeDaysOnMarket?: number;
  Stories?: number;
}

export interface PropertyImage {
  url: string;
  width: number;
  height: number;
  caption?: string;
  x?: number;
  y?: number;
}

export interface SearchPreferences {
  minPrice: number;
  maxPrice: number;
  minBeds: number;
  minBaths: number;
  minAcres?: number;
  radius: number;
}

export type OpenHouseWizardStep = 'ADDRESS' | 'PREFERENCES' | 'COVER_IMAGE' | 'CHEAT_SHEET_PHOTOS' | 'REVIEW';

// No-MLS Pro only (Bright MLS plans get the Guest Pass instead).
export type AfterSignin = 'hub' | 'none'
export type GuestSettingsPatch = { autoShowcase?: boolean; similarHomes?: boolean; afterSignin?: AfterSignin; guestPass?: boolean; passSignature?: boolean }

export interface OpenHouse {
  id: string;
  openHouseEventId: string;
  agentId?: string;
  address: string;
  property_data?: any; // New field for full MLS data object
  createdAt: string;
  qrCodeUrl: string;
  coverImageUrl: string;
  coverImagePosition?: { x: number; y: number } | null;
  formUrl: string;
  qrDarkMode?: boolean;
  shareGuestsWithListingAgent?: boolean;
  // Build a Showcase for each guest who signs in without an agent (on by default).
  autoShowcase?: boolean;
  // The kit's Similar Homes sheet + the similar homes on the Guest Pass (on by default; a listing
  // agent at their own listing starts with it - and autoShowcase - off).
  similarHomes?: boolean;
  // After signing in, guests' phones open their Guest Pass (Bright MLS plans - guestPassAvailable).
  guestPass?: boolean;
  guestPassAvailable?: boolean;
  // Guest Pass footer: the host's Email Signature card instead of the plain agent card (on by
  // default). passSignatureAvailable = the plan includes Email Signature.
  passSignature?: boolean;
  passSignatureAvailable?: boolean;
  // No-MLS Pro: send guests to the Agent Hub after signing in ("hub") or not.
  afterSignin?: AfterSignin | null;
  // The agent's own published Spotlight for this home - only set when it's their own listing (IDX).
  ownSpotlightUrl?: string | null;
  // Their own listing, IDX, no published Spotlight yet -> "Make Spotlight" ("Finish" when a draft exists).
  canMakeSpotlight?: boolean;
  spotlightDraftId?: string | null;
  // The plan includes an Agent Hub / it's set up enough to send guests to.
  hubAvailable?: boolean;
  hubReady?: boolean;
  // The agent's plan includes Showcases (Premium / IDX).
  showcasesAvailable?: boolean;
  bedrooms?: number;
  bathrooms?: number;
  livingArea?: number;
  price?: number;
  // Lot size in square feet (backend lot_size) - the flyer shows it as acres.
  lotSize?: number;
  BedroomsTotal?: number;
  BathroomsTotal?: number;
  LivingArea?: number;
  ListPrice?: number;
  city?: string;
  state?: string;
  zipcode?: string;
  latitude?: number;
  longitude?: number;
  listingKey?: string;
  notes?: string;
  similarPropertyIds?: string[];
  similarPropertiesSnapshot?: any[];
  cheatSheetPhotos?: any[];
  cheatSheetSnapshot?: any;
  visitorCount?: number;
  // Only populated for opens booked through an approved Open House Manager host request -
  // self-hosted/wizard opens are evergreen QR pages with no fixed schedule.
  scheduledDate?: string | null;
  scheduledStartTime?: string | null;
  scheduledEndTime?: string | null;
  // The listing agent's standing host notes (access info, lockbox code, parking...), sent down
  // ONLY while a guest-hosted scheduled open is still upcoming - see the note modal's "Notes &
  // Info" section. Cleared by the API once the open house date has passed.
  listingHostNotes?: string | null;
}

// A "Request Seller Disclosure" or "Schedule a Second Visit" submission from the Cheat Sheet
// QR codes - scoped to the open house it came from.
export interface OpenHouseFormRequest {
  id: string;
  openHouseEventId: string;
  formType: 'disclosure' | 'second_visit';
  fullName: string;
  email: string;
  phone: string;
  wantsAnotherTour?: boolean | null;
  anotherTourTime?: string | null;
  preferredVisitTime?: string | null;
  wantsDisclosure?: boolean | null;
  createdAt: string;
  completedAt?: string | null;
  propertyAddress?: string | null;
  propertyImage?: string | null;
}

export type OpenHouseStatus = 'needs_host' | 'scheduled';
export type HostRequestStatus = 'pending' | 'approved' | 'declined' | 'countered';
export type BroadcastStatus = 'open' | 'filled' | 'cancelled';
export type TeamMemberStatus = 'pending' | 'accepted' | 'declined';

export interface MyListingSummary {
  open_scheduled: number;
  needs_host: number;
  avg_guests_per_open: number;
  high_priority: number;
}

export interface MyListingItem {
  listing_key: string;
  image?: string | null;
  photos?: string[] | null;
  days_on_market?: number | null;
  status?: string | null;
  address: string;
  city?: string | null;
  state?: string | null;
  zipcode?: string | null;
  price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  living_area?: number | null;
  lot_size_acres?: number | null;
  open_house_status: OpenHouseStatus;
  avg_guests_per_open: number;
  opens_hosted_count: number;
  scheduled_opens_count: number;
  scheduled_opens: ScheduledOpen[];
  confirmed_pending_kit: ScheduledOpen[];
  needs_host_this_weekend: boolean;
  is_high_priority: boolean;
  pending_request_count: number;
  is_manual: boolean;
  /** "pending" = under contract, no open houses; "coming_soon" = go-live date unknown, none yet. */
  hosting_blocked?: 'pending' | 'off_market' | 'coming_soon' | null;
  /** Coming Soon: the first day an open house is allowed. */
  hosts_from?: string | null;
}

export interface MyListingsResponse {
  summary: MyListingSummary;
  listings: MyListingItem[];
}

export interface ManualListingPayload {
  address: string;
  city: string;
  state: string;
  zipcode?: string;
  price?: number;
  bedrooms?: number;
  bathrooms?: number;
  living_area?: number;
  image_url?: string;
}

export interface HostRequest {
  id: string;
  listing_key: string;
  property_address?: string | null;
  property_image?: string | null;
  listing_owner_agent_id: string;
  requesting_agent_id: string;
  requesting_agent_name: string;
  requesting_agent_brokerage?: string | null;
  requesting_agent_email?: string | null;
  listing_agent_name?: string | null;
  listing_agent_brokerage?: string | null;
  // One "Other time" each way - once used, that side can only say yes or no.
  listing_agent_suggested_time?: boolean
  host_suggested_time?: boolean
  requested_date: string;
  requested_start_time: string;
  requested_end_time: string;
  message?: string | null;
  status: HostRequestStatus;
  created_at: string;
  responded_at?: string | null;
  counter_date?: string | null;
  counter_start_time?: string | null;
  counter_end_time?: string | null;
  counter_message?: string | null;
  broadcast_id?: string | null;
  listing_host_notes?: string | null;
}

export interface CreateHostRequestPayload {
  listing_key: string;
  requested_date: string;
  requested_start_time: string;
  requested_end_time: string;
  message?: string;
  // Shared across multiple slots offered in one submission (e.g. "Offer a Second Open") so the
  // backend can treat them as a single ask - one notification, one badge count.
  group_id?: string;
}

export interface CreateHostRequestResult {
  on_platform: boolean;
  request?: HostRequest | null;
}

export interface CounterHostRequestPayload {
  counter_date: string;
  counter_start_time: string;
  counter_end_time: string;
  counter_message?: string;
}

export interface AgentSearchResult {
  id: string;
  name: string;
  brokerage?: string | null;
  mls_id?: string | null;
  email: string;
  photo_url?: string | null;
}

export interface TeamMember {
  id: string;
  agent_id: string;
  name: string;
  brokerage?: string | null;
  mls_id?: string | null;
  status: TeamMemberStatus;
  added_at: string;
  photo_url?: string | null;
}

// One OTHER agent's Open House Team the current agent is an accepted member of - an agent can be
// on any number of these at once, so this is always a list. Drives Discovery's Team filter.
export interface TeamMembership {
  owner_id: string;
  owner_name: string;
  owner_brokerage?: string | null;
}

export interface IncomingTeamInvite {
  id: string;
  owner_agent_id: string;
  owner_agent_name: string;
  owner_agent_brokerage?: string | null;
  status: TeamMemberStatus;
  created_at: string;
}

export interface TrustedHost {
  agent_id: string;
  name: string;
  brokerage?: string | null;
  mls_id?: string | null;
  times_hosted: number;
  last_hosted_at: string;
  photo_url?: string | null;
}

export interface HostRequestEvent {
  id: string;
  actor_id?: string | null;
  actor_name?: string | null;
  action: 'requested' | 'countered' | 'counter_accepted' | 'counter_declined' | 'approved' | 'declined' | 'note';
  proposed_date?: string | null;
  proposed_start_time?: string | null;
  proposed_end_time?: string | null;
  note?: string | null;
  created_at: string;
}

export interface CounterBackPayload {
  proposed_date: string;
  proposed_start_time: string;
  proposed_end_time: string;
  note?: string;
}

export interface RespondToBroadcastPayload {
  proposed_date?: string;
  proposed_start_time?: string;
  proposed_end_time?: string;
  note?: string;
}

export interface Broadcast {
  id: string;
  listing_key: string;
  property_address?: string | null;
  property_image?: string | null;
  requested_date: string;
  requested_start_time?: string | null;
  requested_end_time?: string | null;
  is_anytime: boolean;
  message?: string | null;
  status: BroadcastStatus;
  created_at: string;
  interested_requests: HostRequest[];
  is_direct: boolean;
  target_agent_name?: string | null;
}

export interface IncomingBroadcast {
  id: string;
  listing_key: string;
  property_address?: string | null;
  property_image?: string | null;
  owner_agent_name: string;
  owner_agent_brokerage?: string | null;
  requested_date: string;
  requested_start_time?: string | null;
  requested_end_time?: string | null;
  is_anytime: boolean;
  message?: string | null;
  status: BroadcastStatus;
  created_at: string;
  my_response_status?: HostRequestStatus | null;
  is_direct: boolean;
}

export interface CreateBroadcastPayload {
  listing_key: string;
  requested_date: string;
  requested_start_time?: string;
  requested_end_time?: string;
  is_anytime?: boolean;
  message?: string;
  target_agent_id?: string;
}

export interface NearbyPlace {
  name: string;
  address?: string | null;
  distance_miles?: number | null;
  place_type?: string | null;
}

export interface NearbyAmenitiesResponse {
  schools: NearbyPlace[];
  private_schools: NearbyPlace[];
  grocery_stores: NearbyPlace[];
  medical_care: NearbyPlace[];
  parks: NearbyPlace[];
  downtown_areas: NearbyPlace[];
  airports: NearbyPlace[];
  available: boolean;
  cached_at?: string | null;
}

export interface ScheduledOpen {
  id: string;
  scheduled_date?: string | null;
  scheduled_start_time?: string | null;
  scheduled_end_time?: string | null;
  hosting_agent_id: string;
  hosting_agent_name: string;
  hosting_agent_brokerage?: string | null;
  hosting_agent_photo_url?: string | null;
  kit_built: boolean;
}

export interface OpenHouseHistoryRow {
  id: string;
  event_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  hosting_agent_id: string;
  hosting_agent_name: string;
  hosting_agent_brokerage?: string | null;
  total_guests: number;
  unrepresented_guests: number;
  requested_updates: number;
  share_guests_enabled: boolean;
}

export interface OpenHouseKeyMetrics {
  total_guests: number;
  unrepresented_guests: number;
  requested_updates: number;
  total_opens_hosted: number;
}

export interface ListingHostNote {
  notes?: string | null;
  is_priority_override: boolean;
  updated_at?: string | null;
}

export interface ListingDetail {
  listing_key: string;
  address?: string | null;
  image?: string | null;
  scheduled_opens: ScheduledOpen[];
  confirmed_pending_kit: ScheduledOpen[];
  pending_requests: HostRequest[];
  history: OpenHouseHistoryRow[];
  key_metrics: OpenHouseKeyMetrics;
  notes: ListingHostNote;
}

export interface PropertyTour {
  id: string;
  collection_id: string;
  property_id: string;
  preferred_date: string;
  preferred_time: string;
  preferred_date_2?: string;
  preferred_time_2?: string;
  preferred_date_3?: string;
  preferred_time_3?: string;
  message?: string;
  confirmed_date?: string | null;
  confirmed_time?: string | null;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  is_completed: boolean;
  visitor_name?: string;
  visitor_email?: string;
  visitor_phone?: string;
  created_at: string;
  updated_at?: string;
  // Whose Showcase it came from - set in the all-Showcases Tour requests inbox.
  showcase_name?: string;
  // UI helper field
  property?: {
    street_address?: string;
    city?: string;
    state?: string;
    imageUrl?: string;
  };
}

export interface Customer {
  id?: string; // Changed to string to match backend UUID
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  preferredContact: 'EMAIL' | 'PHONE' | 'TEXT';
  interestedInSimilar?: boolean;
  visitingReason?: string;
  priceRange?: string;
  additionalComments?: string;
  is_blacklisted?: boolean;
}

export interface SignInFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  preferredContact: 'EMAIL' | 'PHONE' | 'TEXT';
  priceRange: string;
  interestedInSimilar: boolean;
  additionalComments: string;
  fullName: string;
  hasAgent: string;
  // Updated for new schema
  open_house_event_id?: string;
}

export interface CollectionPreferences {
  id?: string;
  collection_id?: string;
  min_beds?: number | null;
  max_beds?: number | null;
  min_baths?: number | null;
  max_baths?: number | null;
  min_price?: number | null;
  max_price?: number | null;
  min_year_built?: number | null;
  max_year_built?: number | null;
  min_sqft?: number | null;
  max_sqft?: number | null;
  min_acres?: number | null;
  max_acres?: number | null;
  lat?: number | null;
  long?: number | null;
  address?: string | null;
  city?: string | null; // Keep for backward compatibility
  cities?: string[]; // New field for multiple cities
  township?: string | null; // Keep for backward compatibility
  townships?: string[]; // New field for multiple townships
  school_districts?: string[]; // New field for school districts
  county?: string | null; // Legacy single-value field, superseded by `counties` below
  counties?: string[];
  diameter?: number | null;
  // Agent-drawn "Draw on Map" search area - GeoJSON Polygon/MultiPolygon, WGS84 lng/lat, the same
  // shape google.maps.Polygon.getPath() yields. Mutually exclusive with address/diameter and
  // cities/townships/school_districts.
  search_polygon?: { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] } | null;
  special_features?: string;
  is_town_house?: boolean | null;
  is_lot_land?: boolean | null;
  is_condo?: boolean | null;
  is_multi_family?: boolean | null;
  is_single_family?: boolean | null;
  is_apartment?: boolean | null;
  is_commercial?: boolean | null;
  is_farm?: boolean | null;
  visiting_reason?: string | null;
  has_agent?: string | null;
  // Match-score comparison ("X% Match" badge, lib/matchScore.ts) - the agent-chosen property to
  // score every match against (overrides the linked OpenHouseEvent's own property, if any), and
  // whether to show the badge at all.
  compare_property_listing_key?: string | null;
  show_match_score?: boolean;
  // Buyer side: "stop using a home" (just their filters), and whether their agent drew the area.
  remove_home?: boolean;
  has_drawn_area?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TourRequest {
  propertyId: string | number
  propertyAddress: string
  visitorName?: string
  visitorContact?: string
  visitorPhone?: string
  preferredDate: string
  preferredTime: string
  preferredDate2?: string
  preferredTime2?: string
  preferredDate3?: string
  preferredTime3?: string
  message?: string
}

export interface PropertyTour {
  id: string;
  collectionId: string;
  propertyId: string;
  visitorName: string;
  visitorEmail: string;
  visitorPhone: string;
  preferredDate: string;
  preferredTime: string;
  preferredDate2?: string;
  preferredTime2?: string;
  preferredDate3?: string;
  preferredTime3?: string;
  message?: string;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PropertyTourResponse {
  id: string;
  collection_id: string;
  property_id: string;
  visitor_name: string;
  visitor_email: string;
  visitor_phone: string;
  preferred_date: string;
  preferred_time: string;
  preferred_date_2?: string;
  preferred_time_2?: string;
  preferred_date_3?: string;
  preferred_time_3?: string;
  message?: string;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Collection {
  id: string; // Changed to string to match backend UUID
  agentName?: string | null;
  // Full contact info for the visitor-facing "Ask My Agent" tab - public showcase reads only
  // (get_shared_collection), null/absent everywhere else.
  agentFullName?: string | null;
  agentEmail?: string | null;
  agentPhone?: string | null;
  agentPhotoUrl?: string | null;
  customer: Customer;
  propertyId: number;
  // Not every showcase has one (manually-created, no linked open house, no agent-chosen compare
  // property) - the backend returns null in that case, not an empty/fake Property.
  originalProperty: Property | null;
  createdAt: string;
  updatedAt: string;
  status: 'ACTIVE' | 'INACTIVE';
  notifyVisitor: boolean;
  notifyAgent: boolean;
  isBlacklisted?: boolean;
  source?: string | null;
  preferences?: CollectionPreferences | {
    priceRange: string;
    visitingReason?: string;
    hasAgent?: string;
    additionalComments?: string;
  };
  stats: {
    totalProperties: number;
    activeProperties: number;
    newProperties: number;
    viewedProperties: number;
    likedProperties: number;
    lastActivity?: string | null;
    lastAgentDismissedAt?: string;
    activityCounts?: { LIKE?: number; DISLIKE?: number; PROPERTY_COMMENT?: number };
    tourRequestedCount?: number;
    // Newest unread comment's home - the card's comment badge opens that thread.
    commentPropertyId?: string | null;
  };
  shareToken?: string;
  /** Short personal link code - /s/<code> (e.g. "dana-k7q2"). */
  shortCode?: string | null;
  sharedAt?: string;
  isPublic?: boolean;
  matchedProperties?: Property[];
  // Visitor's free-text "ask my agent to refine my search" message, if any is currently pending
  // (see EditShowcaseCriteriaModal's "Ask Your Agent" tab and DetailView's banner).
  refineRequestMessage?: string | null;
  refineRequestAt?: string | null;
}

export interface User {
  id: string;
  email: string;
  is_admin?: boolean;
  first_name?: string;
  last_name?: string;
  state?: string;
  brokerage?: string;
  mls_id?: string | null;  // null = agent outside Bright MLS
  license_number?: string | null;
  photo_url?: string | null;
  professional_title?: string | null;
  market?: string | null;
  created_at: string;
  updated_at?: string;
  // PayPal subscription fields
  subscription_id?: string;
  subscription_status?: string;  // TRIAL, ACTIVE, SUSPENDED, CANCELLED, EXPIRED
  broker_authorized?: boolean;
  restrict_host_requests_to_team?: boolean;
  plan_id?: string;
  plan_tier?: string;  // BASIC or PREMIUM
  trial_ends_at?: string;
  idx_setup_settled_at?: string | null;  // one-time IDX setup fee paid or waived
  next_billing_date?: string;  // Grace period end for cancelled subscriptions
  subscription_started_at?: string;
  last_billing_date?: string;
  idx_domain_migration_agreed_at?: string;  // null = IDX agent hasn't seen/agreed to the domain-migration prompt yet
  billing_group_id?: string | null;  // paid for by a brokerage group (admin)
  last_seen_at?: string | null;
}

/*export interface Agent {
  id: number;
  name: string;
  email: string;
  phone?: string;
  collections: Collection[];
}*/

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  /** HTTP status of a failed request (none = it never got an answer, e.g. offline). */
  status?: number;
}

// Backend notification response (snake_case from API)
export interface NotificationResponse {
  id: string;
  agent_id: string;
  type: string;
  reference_type: string;
  reference_id: string;
  title: string;
  message: string;
  collection_id?: string | null;
  collection_name?: string | null;
  property_id?: string | null;
  property_address?: string | null;
  visitor_name?: string | null;
  link?: string | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

// Per-agent email/push notification opt-outs. The in-app bell is always on and not represented here.
export interface NotificationPrefCategory {
  id: string;
  label: string;
  help: string;
}
export interface NotificationChannelPrefs {
  email: boolean;
  push: boolean;
}
export interface NotificationPreferences {
  categories: NotificationPrefCategory[];
  preferences: Record<string, NotificationChannelPrefs>;
  push_available: boolean;
}

// Frontend notification interface (camelCase for use in components)
export interface Notification {
  id: string;
  type: string;
  referenceId?: string;
  title: string;
  message: string;
  visitorName?: string;
  propertyAddress?: string;
  collectionId: string;
  collectionName?: string;
  propertyId?: string;
  link?: string;
  isRead: boolean;
  readAt?: string;
  timestamp: string; // Maps to created_at
}

// ---- Support Tickets ----

export type SupportTicketCategory = 'support' | 'bug' | 'feature';

/** Quiet context captured when the ticket was sent (all optional, all strings). */
export interface SupportTicketDetails {
  urgency?: 'low' | 'normal' | 'urgent';
  area?: string;
  page_url?: string;
  browser?: string;
  os?: string;
  device?: string;
  screen?: string;
  viewport?: string;
  timezone?: string;
  language?: string;
  user_agent?: string;
}

export interface SupportTicketMessage {
  id: string;
  sender_type: 'agent' | 'admin';
  body: string;
  attachments?: string[] | null;
  created_at: string;
}

export interface SupportTicketDetail {
  id: string;
  subject: string;
  status: 'open' | 'closed';
  category: SupportTicketCategory;
  details?: SupportTicketDetails | null;
  created_at: string;
  updated_at: string;
  messages: SupportTicketMessage[];
}

export interface SupportTicketListItem {
  id: string;
  subject: string;
  status: 'open' | 'closed';
  category: SupportTicketCategory;
  created_at: string;
  updated_at: string;
  unread: boolean;
}

export interface AdminSupportTicketListItem extends SupportTicketListItem {
  agent_id: string;
  agent_name: string;
  agent_email: string;
}

// ---- Agent Hub Forms ----

export type FormQuestionType = 'short_text' | 'long_text' | 'email' | 'phone' | 'number' | 'select' | 'date' | 'time' | 'currency' | 'multi_select' | 'contact_group' | 'statement' | 'address_autocomplete' | 'city_multiselect' | 'school_district_multiselect' | 'county_multiselect';

export interface FormQuestionDependsOn {
  question_id: string;
  values: string[];
}

export interface ContactGroupField {
  id: string;
  type: FormQuestionType;
  label: string;
  required: boolean;
  options?: string[] | null;
  searchable?: boolean | null;
}

export interface FormQuestion {
  id: string;
  type: FormQuestionType;
  label: string;
  placeholder?: string | null;
  required: boolean;
  options?: string[] | null;
  locked: boolean;
  depends_on?: FormQuestionDependsOn | null;
  section_title?: string | null;
  unit?: string | null;
  helper_text?: string | null;
  fields?: ContactGroupField[] | null;
  // 'select' questions with many options (e.g. US states) render as a typeable/filterable
  // combobox instead of a button grid when this is true.
  searchable?: boolean | null;
  // 'statement' questions only - a dead end (e.g. a disqualifying answer): no Continue/Submit
  // button, since showing the form's normal success screen afterward would contradict what this
  // statement just told the visitor.
  terminal?: boolean | null;
}

export type AgentFormType = 'buying' | 'selling' | 'home_value' | 'showing' | 'seller_onboarding' | 'buyer_onboarding' | 'how_can_i_help' | 'showcase_request' | 'make_me_sell' | 'custom';

export interface LinkedProperty {
  listing_key?: string | null;
  address: string;
  city?: string | null;
  state?: string | null;
  zipcode?: string | null;
  price?: number | null;
  original_price?: number | null;
  // The recorded sale price, when the property has closed (from the agent's Recent Sales or the
  // MLS record) - lets Just Sold designs say "Sold for" truthfully instead of showing list price.
  close_price?: number | null;
  close_date?: string | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  acres?: number | null;
  image_url?: string | null;
  photos?: string[] | null;
  status?: string | null;
  description?: string | null;
  year_built?: number | null;
  property_type?: string | null;
  lot_size?: number | null;
}

// A property an agent typed in by hand once (e.g. via the Forms "Enter it manually" picker),
// saved to their own personal library so it can be re-attached elsewhere with a click instead of
// retyped. Purely a convenience cache - saving one here never creates a real Open House Manager
// listing or Agent Hub recent sale; the agent still adds those deliberately on their own pages.
export interface SavedManualProperty {
  id: string;
  address: string;
  city?: string | null;
  state?: string | null;
  zipcode?: string | null;
  price?: number | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  image_url?: string | null;
  created_at: string;
}

// A signed-out homepage visitor's one-off "Ask Us a Question" submission - no account, no reply
// thread (see backend PublicQuestion for why this is separate from SupportTicket).
export interface PublicQuestion {
  id: string;
  email: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

// Authenticated agent-side form config (snake_case from API)
export interface AgentFormConfig {
  id: string;
  form_type: AgentFormType;
  slug: string;
  title: string;
  headline?: string | null;
  subtitle?: string | null;
  description?: string | null;
  questions: FormQuestion[];
  success_heading: string;
  success_message?: string | null;
  accent_color?: string | null;
  show_branding: boolean;
  dark_mode: boolean;
  /** 'hub' = matches the Agent Hub; 'custom' = look_theme + accent_color / luxe_metal + dark_mode. */
  look_mode?: 'hub' | 'custom';
  look_theme?: 'classic' | 'luxe' | null;
  luxe_metal?: 'gold' | 'silver' | 'bronze' | null;
  redirect_to_agent_hub: boolean;
  property_photo_carousel: boolean;
  background_effects: boolean;
  welcome_text_effects: boolean;
  branding_layout: 'top' | 'bottom' | 'split' | 'split_reverse' | 'integrated';
  is_enabled: boolean;
  order_index: number;
  linked_property?: LinkedProperty | null;
  // Count of active (non-deleted) named Campaigns beyond General - NOT a total-including-General
  // count. 0 means General only (card shows no campaign meta-line at all).
  additional_campaign_count: number;
  created_at: string;
  updated_at?: string | null;
}

// A separately-tracked link+QR for the same premade form - never a different form. id/token are
// null only for the synthesized General entry (there is no row for General - its link is the
// form's plain URL with no ?c= param at all).
export interface FormCampaign {
  id: string | null;
  name: string;
  token: string | null;
  is_general: boolean;
  description?: string | null;
  views: number;
  leads: number;
  deleted_at?: string | null;
  created_at?: string | null;
  // After submitting: null = same as the form; 'agent_hub' | 'sales' | 'none' | 'custom' (redirect_url)
  redirect_mode?: string | null;
  redirect_url?: string | null;
}

// Resolves a bare campaign_id (as stored on DesignProject.campaign_id) back to its owning form -
// a design isn't itself scoped to one form, so this is the one lookup that isn't already covered
// by the form-scoped campaign endpoints.
export interface CampaignLookup {
  id: string;
  name: string;
  token: string;
  form_id: string;
  form_slug: string;
  form_title: string;
  redirect_mode?: string | null;
  redirect_url?: string | null;
}

export interface FormStatsCampaignBreakdown {
  campaignId: string | null;
  name: string;
  views: number;
  leads: number;
  isDeleted: boolean;
}

// Public visitor-facing form config (camelCase from API)
export interface PublicFormConfig {
  formId: string;
  formType: AgentFormType;
  slug: string;
  title: string;
  headline?: string | null;
  subtitle?: string | null;
  questions: FormQuestion[];
  successHeading: string;
  successMessage?: string | null;
  accentColor?: string | null;
  showBranding: boolean;
  darkMode: boolean;
  /** Resolved look: the Agent Hub's unless the form has its own (lib/formLook). */
  look?: { theme: 'classic' | 'luxe'; accent: string; metal: 'gold' | 'silver' | 'bronze'; dark: boolean } | null;
  redirectToAgentHub: boolean;
  // Set when the link's campaign overrides where people go after submitting.
  afterSubmitMode?: 'agent_hub' | 'sales' | 'none' | 'custom' | null;
  afterSubmitUrl?: string | null;
  propertyPhotoCarousel: boolean;
  backgroundEffects: boolean;
  welcomeTextEffects: boolean;
  brandingLayout: 'top' | 'bottom' | 'split' | 'split_reverse' | 'integrated';
  agentName: string;
  agentBrokerage: string;
  agentPhotoUrl?: string | null;
  agentTitle?: string | null;
  agentMarket?: string | null;
  linkedProperty?: LinkedProperty | null;
  exampleProperties?: { address: string; city?: string | null; price?: number | null; image?: string | null }[] | null;
}

// Lightweight public listing of an agent's forms (no auth), used to link "Buying"/"Selling"/etc. buttons to real forms
export interface PublicFormSummary {
  formId: string;
  formType: AgentFormType;
  slug: string;
  title: string;
}

export interface FormSubmissionAnswer {
  questionId: string;
  label: string;
  type: FormQuestionType;
  value: unknown;
  sectionTitle?: string | null;
}

export interface FormSubmissionListItem {
  id: string;
  form_id: string;
  form_type: AgentFormType;
  answers: FormSubmissionAnswer[];
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  property_address?: string | null;
  is_reviewed: boolean;
  // Resolved regardless of the campaign's deleted_at, so a deleted campaign's real name still
  // shows here instead of going blank. Omitted/null for General - quiet by default.
  campaign_name?: string | null;
  // Schedule a Showing only - the request's home + times + the agent's confirmed time.
  showing?: {
    listing_key?: string | null;
    preferred?: { date: string; time?: string | null }[];
    note?: string | null;
    confirmed_date?: string | null;
    confirmed_time?: string | null;
  } | null;
  created_at: string;
}

// What a visitor sees when they come back to their Schedule a Showing link.
export interface ShowingStatus {
  id: string;
  home: { address: string; street: string; city?: string; state?: string; zipcode?: string; photo?: string | null; price?: number | null; beds?: number | null; baths?: number | null; sqft?: number | null };
  contact_name?: string | null;
  preferred_date: string; preferred_time: string;
  preferred_date_2?: string | null; preferred_time_2?: string | null;
  preferred_date_3?: string | null; preferred_time_3?: string | null;
  confirmed_date?: string | null; confirmed_time?: string | null;
  message?: string | null;
  created_at?: string;
}

export interface FormStats {
  totalViews: number;
  totalStarts: number;
  totalCompletions: number;
  completionRate: number;
  dailyViews: { date: string; count: number }[];
  dailyCompletions: { date: string; count: number }[];
  questionDropOff: { questionId: string; label: string; reachedCount: number; reachedPercent: number }[];
  // Only present on the "All Campaigns" combined call (campaignId left unset on FormStatsModal) -
  // General plus every named campaign, active and deleted, all included.
  campaignBreakdown?: FormStatsCampaignBreakdown[];
  // ---- Insights (per-form calls only; backend form_insights_service.build_insights) ----
  rangeDays?: number;
  startRate?: number;
  contactCount?: number;
  contactRate?: number;
  dropOffCount?: number;
  inProgressCount?: number;
  medianCompletionSeconds?: number | null;
  funnel?: { key: 'views' | 'started' | 'contact' | 'completed'; label: string; count: number }[];
  daily?: { date: string; views: number; starts: number; completions: number; dropOffs: number }[];
  questions?: FormQuestionInsight[];
  biggestLeak?: FormQuestionInsight | null;
  sources?: FormSplitRow[];
  devices?: FormSplitRow[];
  referrers?: { host: string; count: number }[];
  /** [weekday Mon..Sun][night, morning, afternoon, evening] drop-off counts, Eastern time */
  dropOffHeat?: number[][];
}

export interface FormQuestionInsight {
  questionId: string;
  label: string;
  number: number;
  seenCount: number;
  droppedCount: number;
  dropOffPercent: number;
  medianSeconds: number | null;
}

export interface FormSplitRow {
  key: string;
  label: string;
  views: number;
  completions: number;
  completionRate: number;
}

export interface UnfinishedFormResponse {
  id: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  answers: { questionId: string; label: string; group: string | null; value: unknown }[];
  answeredCount: number;
  lastQuestionId: string | null;
  lastQuestionLabel: string | null;
  lastQuestionNumber: number | null;
  totalQuestions: number;
  startedAt: string | null;
  lastActivityAt: string | null;
  inProgress: boolean;
  finishedLater: boolean;
  /** Set once the agent pressed "Add to Leads" on it. */
  leadId?: string | null;
  source: string | null;
  device: string | null;
  referrer: string | null;
  campaignName: string | null;
}

// ---------------------------------------------------------------------------
// Studio: Brand Kit, Design Studio, Blogs
// ---------------------------------------------------------------------------

export interface BrandKit {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  heading_font: string;
  body_font: string;
  personal_logo_url?: string | null;
  team_logo_url?: string | null;
  brokerage_logo_url?: string | null;
  disclaimer_text?: string | null;
  updated_at?: string | null;
}

// ---- Design Studio ----

export type DesignStatus = 'DRAFT' | 'READY' | 'EXPORTED' | 'PUBLISHED' | 'ARCHIVED';
export type BrandingMode = 'personal' | 'team' | 'brokerage' | 'none';
export type DesignBlockType =
  | 'hero_photo' | 'photo_gallery' | 'address' | 'price' | 'facts' | 'open_house_details'
  | 'description' | 'highlights' | 'agent_info' | 'brokerage_branding' | 'qr_code' | 'cta' | 'headline';

export interface DesignBlockStyle {
  font?: string | null; // curated preset id - matches Brand Kit heading/body font presets
  size?: 'sm' | 'md' | 'lg' | 'xl' | null;
  bold?: boolean | null;
  align?: 'left' | 'center' | 'right' | null;
  color?: string | null; // brand token ('primary'|'secondary'|'accent'|'white'|'black') or a custom hex
  uppercase?: boolean | null;
  line_height?: 'tight' | 'normal' | 'relaxed' | null;
}

export interface DesignBlock {
  id: string;
  type: DesignBlockType;
  hidden: boolean;
  data: Record<string, any>;
  overrides: Record<string, any>;
  style?: DesignBlockStyle | null;
}

// grid = photo collage on top, text body below; poster = full-bleed photo w/ text overlay;
// split = full-height two columns, photo one side and text the other.
export type DesignLayoutKind = 'poster' | 'grid' | 'split';

export interface DesignFormatDef {
  designType: string;
  label: string;
  category: 'Property Marketing' | 'Social Media' | 'Print' | 'Digital';
  description: string;
  aspectRatio: number; // width / height
  orientation: 'portrait' | 'landscape' | 'square';
  defaultStyleId: string;
  layout: DesignLayoutKind; // the format's default - a Template may override this, see DesignTemplateLayoutHints
  isPrint: boolean; // drives PDF vs PNG export, and the QR-availability default below
  qrByDefault: boolean; // whether a QR block belongs on this format's generic/fallback template
}

// One of exactly 4 visual template styles - a real distinct system (typography, badge shape,
// dividers, type transform), not a color swap. See lib/studio/designFormats.ts for the token values.
export type DesignStyleId = 'editorial' | 'modern_luxury' | 'minimal' | 'bold';

export interface DesignStyleTokens {
  addressFont: 'serif' | 'sans'; // the one property-name-level typographic choice per style
  badgeShape: 'pill' | 'sharp' | 'scrim';
  dividerStyle: 'hairline' | 'accent-rule' | 'thick-border';
  labelTransform: 'none' | 'uppercase-tracked';
  priceEmphasis: 'accent' | 'serif-large';
  density: 'compact' | 'generous'; // spacing scale
  solidColorBlock: boolean; // Bold only - a full-bleed flood panel exists structurally; Color supplies the fill
}

export interface DesignStyle {
  id: DesignStyleId;
  label: string;
  description: string;
  tokens: DesignStyleTokens;
}

// Independent, later-applied axis - composes with any Style. See lib/studio/designColors.ts.
// 'dark' is a softened charcoal, not near-black, on purpose - a flat black/navy panel wastes ink
// on anything printed, so it's deliberately not the darkest option available.
export type DesignColorMode = 'light' | 'stone' | 'dark' | 'forest' | 'brand' | 'luxe';

// A Template can override how its format's layout actually renders - e.g. a poster where the
// content sits at the top instead of the bottom, or a grid with a much larger photo band. Purely
// additive: every field is optional and DesignCanvas falls back to the format/layout default when
// absent, so a template that doesn't care about any of this needs to specify nothing.
export interface DesignTemplateLayoutHints {
  layout?: DesignLayoutKind; // overrides DesignFormatDef.layout entirely
  contentAnchor?: 'top' | 'bottom'; // poster only - default 'bottom'
  photoHeightPct?: number; // grid only - default 52
  splitSide?: 'left' | 'right'; // split only - which side the photo sits on, default 'right'
}

export interface DesignProject {
  id: string;
  design_type: string;
  style_id: string;
  template_id?: string | null;
  situation?: string | null;
  color_mode?: DesignColorMode | null;
  name: string;
  status: DesignStatus;
  linked_property?: LinkedProperty | null;
  blocks: DesignBlock[];
  branding_mode: BrandingMode;
  campaign_id?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface DesignProjectCreatePayload {
  design_type: string;
  style_id: string;
  template_id?: string | null;
  situation?: string | null;
  color_mode?: DesignColorMode | null;
  name: string;
  linked_property?: LinkedProperty | null;
  blocks?: DesignBlock[];
  branding_mode?: BrandingMode;
  campaign_id?: string | null;
}

// ---------------------------------------------------------------- Studio AI Property Media

// One photo effect (photo edits can stack several), plus 'stack' / 'animate' request actions.
export type StudioImageEffect = 'twilight' | 'lights_on' | 'virtual_staging' | 'enhance';
export type StudioMediaAction = StudioImageEffect | 'stack' | 'animate';
export type StudioMediaKind = 'image' | 'video' | 'upload';
export type StudioMediaStatus = 'processing' | 'succeeded' | 'failed';
export type StudioMediaSourceKind = 'listing' | 'upload';
export type StudioVideoVariantModelTier = 'fast_pro' | 'pro';
export type StudioVideoVariantMotion = 'push_in' | 'slow_push_in' | 'pan_left' | 'pan_right';

export type StudioRoomType =
  | 'living_room' | 'family_room' | 'primary_bedroom' | 'bedroom' | 'nursery' | 'kitchen'
  | 'dining_room' | 'office' | 'basement' | 'bonus_room' | 'home_gym' | 'sunroom'
  | 'entryway' | 'patio';
export type StudioStagingStyle = 'modern' | 'transitional' | 'luxury' | 'traditional';
export type StudioEnhancement = 'grass' | 'sky' | 'brighten_exterior' | 'lighting' | 'declutter' | 'polish' | 'yard_cleanup' | 'remove_furniture';

export type StudioStagingTagPosition = 'bottom-right' | 'bottom-middle' | 'off';

export type StudioVideoStyle = 'standard' | 'day_to_twilight';

export interface StudioMediaOptions {
  room_type?: StudioRoomType;
  style?: StudioStagingStyle;
  enhancements?: StudioEnhancement[];
  /** "Circle what to remove": shapes of [x, y] points as fractions (0-1) of the photo. */
  remove_areas?: number[][][];
  staging_tag?: StudioStagingTagPosition;
  video_style?: StudioVideoStyle;
  video_variant?: {
    label?: string;
    model_tier?: StudioVideoVariantModelTier;
    motion?: StudioVideoVariantMotion;
    prompt_suffix?: string;
    max_cost_per_clip_usd?: number;
  };
}

export type TitleCardPreset = 'just_listed' | 'open_house' | 'coming_soon' | 'price_improved' | 'under_contract' | 'just_sold' | 'back_on_market' | 'new_construction' | 'custom';
export type TitleCardPosition = 'top' | 'middle' | 'bottom';

export interface TitleCardManualFields {
  address?: string;
  location?: string;
  price?: string;
  beds?: string;
  baths?: string;
  sqft?: string;
}

// The 0-5s intro title card overlay - preset + editable title + which property stats show.
// Burned in server-side only at export/download time; see POST .../assets/{id}/export.
export interface TitleCardOptions {
  enabled: boolean;
  preset: TitleCardPreset;
  title: string;
  show_address: boolean;
  show_location: boolean;
  show_price: boolean;
  show_beds: boolean;
  show_baths: boolean;
  show_sqft: boolean;
  manual: TitleCardManualFields;
  position: TitleCardPosition;
  // Animated designs (lib/studio/videoMotion.ts) - all optional so older saved overlays still load.
  style?: 'default' | 'luxe';
  kicker?: string;
  /** Open House: "Sat Oct 12 · 1–3 PM"; Price Improved: the old price. */
  event_line?: string;
  /** The situation's tag in the top corner for the whole video. */
  corner_tag?: boolean;
  /** A closing agent card over the last few seconds. */
  end_card?: boolean;
  end_cta?: string;
  /** Signature: the agent's own color instead of the situation's. */
  accent?: string | null;
  /** Luxe: which metal - gold, silver or bronze. */
  metal?: 'gold' | 'silver' | 'bronze';
  /** When each layer shows - unset = the defaults (see resolveTiming in lib/studio/videoMotion.ts). */
  timing?: {
    title?: LayerTiming | null;
    tag?: LayerTiming | null;
    brand?: LayerTiming | null;
    outro?: { start: number } | null;
  };
}

/** One layer's time on the video. `end` null = to the end; `exit` = animate away or cut instantly. */
export interface LayerTiming {
  start: number;
  end: number | null;
  exit: 'animate' | 'cut';
}

export type BrandingPosition = 'top-left' | 'bottom-left' | 'top-middle';

// Agent-branding corner badge - shown for the whole clip, independent of the title card. Only a
// toggle + its own placement: logo/name/brokerage are always pulled live from the agent's
// current brand kit + user profile at export time, never snapshotted here. `position` used to be
// silently derived from TitleCardOptions.position (auto-moved to dodge a collision) - fully
// independent field now, see the 2026-09-06 fix.
export interface BrandingOptions {
  enabled: boolean;
  position?: BrandingPosition;
}

export interface StudioMediaGeneratePayload {
  action: StudioMediaAction;
  source_photo_url: string;
  source_kind: StudioMediaSourceKind;
  linked_property?: LinkedProperty | null;
  options?: StudioMediaOptions;
  effects?: StudioImageEffect[];   // photo edit: stack these into one gpt-image-2 call
  photos?: string[];               // AI video: source photos (max 8), one 5s clip each
}

export interface StudioMediaAsset {
  id: string;
  group_id: string;
  parent_asset_id?: string | null;
  kind: StudioMediaKind;
  // A single effect, a "+"-joined stack ("virtual_staging+enhance"), or "animate".
  action: string;
  status: StudioMediaStatus;
  source_photo_url: string;
  source_kind: StudioMediaSourceKind;
  linked_property?: LinkedProperty | null;
  options?: (StudioMediaOptions & {
    custom_name?: string; // agent-given display name, set via PATCH /assets/{id}/name
    effects?: string[];
    clips?: {
      status?: string;           // render status: processing | succeeded | failed
      source?: string;
      video_source_url?: string; // exact image sent to Hailuo (post-crop, post-enhance)
      enhanced?: boolean;        // whether the Magnific still-enhance step actually ran
      output_url?: string;       // raw native Hailuo clip, pre-upscale
      final_url?: string;        // set once this clip's upscale step is fully resolved either way
      upscaled?: boolean;        // true = real ByteDance 2K upscale; false = kept native Hailuo
      upscale_retry_count?: number;
      motion?: string;
    }[];
    photo_count?: number;
    duration_seconds?: number;
    projected_cost_usd?: number;
    projected_cost_per_clip_usd?: number;
    projected_over_variant_cap?: boolean;
    preview_frame_url?: string;
    preview_frame_second?: number;
    upscale_completed?: boolean;
    upscale_requested_resolution?: string;
    upscale_resolution?: string;
    upscale_vendor?: string;
    upscaled_by?: string;
    final_width?: number;
    final_height?: number;
    // TEMPORARY testing fields (studio_media_video_debug_store_intermediates) - a second,
    // pre-2K-upscale comparison video for judging whether the AI upscale is worth it.
    preupscale_result_url?: string;
    preupscale_size_bytes?: number;
    video_variant_effective?: Record<string, unknown> | null;
    title_card?: TitleCardOptions | null;
    branding?: BrandingOptions | null;
  }) | null;
  provider?: string | null;
  provider_model?: string | null;
  result_url?: string | null;
  error_message?: string | null;
  cost_usd?: number | null;
  created_at: string;
  updated_at?: string | null;
}

export interface StudioVideoTestGridPayload {
  source_photo_url: string;
  source_kind?: StudioMediaSourceKind;
  linked_property?: LinkedProperty | null;
  model_tiers?: StudioVideoVariantModelTier[];
  motions?: StudioVideoVariantMotion[];
  prompt_suffixes?: string[];
  max_cost_per_clip_usd?: number;
  include_over_budget?: boolean;
}

export interface StudioVideoTestGridVariant {
  label: string;
  model_tier: StudioVideoVariantModelTier;
  motion: StudioVideoVariantMotion;
  prompt_suffix: string;
  projected_cost_usd: number;
  projected_over_budget: boolean;
  skipped: boolean;
  asset?: StudioMediaAsset | null;
}

export interface StudioVideoTestGridResponse {
  group_id: string;
  max_cost_per_clip_usd: number;
  variants: StudioVideoTestGridVariant[];
}

// GET /ai/usage/monthly - the "Monthly AI Usage" meter. One number per agent, spanning every
// AI tool combined. `percent` is null for a tier with no configured monthly budget (render no
// meter). `used_usd` is only for the temporary exact-dollar readout during testing.
export interface MonthlyAiUsage {
  /** This month's spend by feature (share of the allowance). */
  breakdown?: { label: string; usd: number; percent: number | null }[]
  tier: string;
  used_usd: number;
  limit_usd: number | null;
  percent: number | null;
  recent_used_usd?: number;     // spent in the last hour (part of used_usd)
  recent_percent?: number | null; // that hour's share - drawn as its own red slice
  near_limit: boolean;
  exhausted: boolean;
  studio_media_used_usd: number;
  studio_media_cap_usd: number | null;
}

// ---- Website Builder ----
// A separate, standalone system from Agent Hub - no shared types, no migration path.

export type SiteStatus = 'DRAFT' | 'PUBLISHED';
export type SiteDomainStatus = 'PENDING' | 'VERIFIED' | 'ACTIVE' | 'FAILED';

// Open string in the backend (Site.draft_data). Phase 2 adds OHP-data-backed blocks (see
// backend/app/services/website/content_adapters.py) - each one's `data` carries source_mode
// ('automatic' | 'selected' | 'hidden'), an optional `limit`/`selected_ids`, and (once hydrated
// by the public resolve endpoint) a `resolved` payload with the actual data to render. 'form'
// uses `form_id`; 'showcase' uses `collection_id`; 'about_agent' additionally supports an
// `overrides` dict layered onto the resolved profile.
export type SiteBlockType =
  | 'hero' | 'heading_text' | 'rich_text' | 'image' | 'about_agent' | 'contact_cta' | 'divider'
  | 'featured_listings' | 'recent_sales' | 'open_houses' | 'blog_posts' | 'form' | 'showcase' | 'communities'
  | 'newly_listed' | 'testimonials' | 'spotlights';

export type AreaEnrichmentStatus = 'PENDING' | 'RESEARCHING' | 'ENRICHED' | 'PARTIAL' | 'FAILED';

export interface MarketArea {
  id: string;
  name: string;
  state: string;
  slug: string;
  county?: string | null;
  municipality_type?: string | null;
  area_type: 'city' | 'neighborhood';
  parent_area_name?: string | null;
  zip_codes: string[];
  geography?: Record<string, any>;
  facts: Record<string, any>;
  narrative?: { summary: string; source: string; generated_at: string } | null;
  enrichment_status: AreaEnrichmentStatus;
  last_enriched_at?: string | null;
  last_verified_at?: string | null;
  research_version?: number | null;
}

export interface AgentMarketArea {
  id: string;
  area: MarketArea;
  created_at: string;
}

export interface SiteBlock {
  id: string;
  type: SiteBlockType;
  hidden?: boolean;
  data: Record<string, any>;
}

export interface SitePage {
  id: string;
  slug: string;
  title: string;
  is_home?: boolean;
  blocks: SiteBlock[];
}

export interface SiteTheme {
  primary_color: string;
  // The accent - the "one click" color the Design tab's swatches set (see lib/accentSwatches.ts).
  secondary_color: string;
  heading_font: string;
  body_font: string;
  logo_url?: string | null;
  follow_brand_kit?: boolean;
  // 'luxe' = the original cinematic charcoal-and-metal look (sites from before this field
  // existed stay on it); 'default' = the cleaner, lighter look new sites start on.
  template?: 'default' | 'luxe';
  // What visitors see first - they can flip light/dark in the header unless the toggle is off.
  mode?: 'light' | 'dark';
  allow_mode_toggle?: boolean;
  // The agent's Email Signature card in the site footer (every page) - on by default when the
  // plan has signatures and one is saved.
  footer_signature?: boolean;
  // Luxe only: the metal finish (the same gold / silver / bronze as the Email Signature + Agent Hub).
  luxe_metal?: 'gold' | 'silver' | 'bronze';
  // The site's loading mark (SiteLoader): the agent's own logo, else their initials.
  loader_logo_url?: string | null;
}

export interface FeaturedSettings {
  // 'served_areas' = every home for sale in the towns from the Areas tab, the agent's own first.
  mode: 'my_listings' | 'served_areas' | 'filtered';
  min_price?: number | null;
  max_price?: number | null;
  towns: string[];
  school_districts: string[];
  sort: 'newest' | 'price_desc' | 'price_asc';
  prioritize_my_listings: boolean;
}

export interface MediaSettings {
  show_videos: boolean;
  show_tours: boolean;
}

// How the site shows in Google + the browser tab (IDX editor -> Google tab). `pages` is keyed by
// page slug plus the built-in sections (search, properties, neighborhoods, blog, about, contact).
export interface SiteSeo {
  site_name: string;
  home_title: string;
  description: string;
  favicon_url?: string | null;
  share_image_url?: string | null;
  allow_indexing: boolean;
  /** Hand Google the star rating - only ever sent when 3+ reviews average 4.0+ and none are filtered out. */
  share_rating?: boolean;
  pages: Record<string, { title?: string | null; description?: string | null }>;
}

export interface SiteContent {
  pages: SitePage[];
  theme: SiteTheme;
  featured_settings: FeaturedSettings;
  media_settings: MediaSettings;
  seo?: SiteSeo;
}

export interface Site {
  id: string;
  subdomain_slug: string;
  status: SiteStatus;
  is_enabled?: boolean;
  draft_data: SiteContent;
  published_snapshot: SiteContent;
  published_at?: string | null;
  created_at: string;
  updated_at?: string | null;
  // From GET /studio/sites/me only: the editor preview's footer signature card source.
  signature_hub_slug?: string | null;
}

export interface DnsInstruction {
  type: string; // 'CNAME' | 'FORWARD'
  name: string;
  value: string;
  note?: string | null;
}

export interface SiteDomain {
  id: string;
  site_id: string;
  hostname: string;
  status: SiteDomainStatus;
  verification_token?: string | null;
  is_primary: boolean;
  verified_at?: string | null;
  last_checked_at?: string | null;
  last_error?: string | null;
  redirect_target_domain_id?: string | null;
  created_at: string;
  instructions: DnsInstruction[];
}

// ---- Single Property Websites ----

export type PropertyWebsiteStatus = 'DRAFT' | 'PUBLISHED';
export type PropertyWebsiteTemplateId = 'cinematic_luxury' | 'editorial_estate';

export interface PropertyWebsiteFeatures {
  interior: string[];
  exterior: string[];
  lifestyle: string[];
  community: string[];
  other: string[];
}

export interface PropertyWebsiteSnapshot {
  listing_key?: string | null;
  mls_number?: string | null;
  address: string;
  city?: string | null;
  state?: string | null;
  zipcode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  price?: number | null;
  original_list_price?: number | null;
  status?: string | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  above_grade_finished_area?: number | null;
  below_grade_finished_area?: number | null;
  lot_size?: number | null;
  lot_size_acres?: number | null;
  year_built?: number | null;
  home_type?: string | null;
  property_type?: string | null;
  architectural_style?: string[];
  description?: string | null;
  photos: string[];
  county?: string | null;
  township?: string | null;
  subdivision_name?: string | null;
  school_district_name?: string | null;
  elementary_school?: string | null;
  middle_or_junior_school?: string | null;
  high_school?: string | null;
  features: PropertyWebsiteFeatures;
  garage_spaces?: number | null;
  has_garage?: boolean | null;
  stories?: number | null;
  has_association?: boolean | null;
  association_fee?: number | null;
  association_fee_frequency?: string | null;
  list_agent_full_name?: string | null;
  list_agent_email?: string | null;
  list_agent_phone?: string | null;
  list_office_name?: string | null;
  list_office_phone?: string | null;
}

export interface PropertyWebsiteFloorPlan {
  label: string;
  image_url: string;
}

export interface PropertyWebsiteDocument {
  label: string;
  url: string;
}

export interface PropertyWebsiteAgent {
  name: string;
  title?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  license_number?: string | null;
  brokerage?: string | null;
  brokerage_logo_url?: string | null;
  photo_url?: string | null;
  bio?: string | null;
}

export interface PropertyWebsiteOpenHouse {
  id?: string;
  date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  // true = typed into the Spotlight editor; Open House Manager / MLS dates are read live instead.
  manual?: boolean;
}

export interface PropertyWebsiteViewStats {
  unique_visitors: number;
  total_views: number;
  // Totals only: distinct people who asked for a tour / sent a question from a Spotlight page.
  leads?: number;
}

export interface PropertyWebsiteAnalytics {
  totals: PropertyWebsiteViewStats;
  // Keyed by site id; a site with no visits yet is absent.
  sites: Record<string, PropertyWebsiteViewStats>;
}

export interface PropertyWebsiteChapter {
  id: string;
  type: string;
  label: string;
  enabled: boolean;
  photos: string[];
  copy: string;
}

export interface PropertyWebsiteDraft {
  // Applied to the live page on publish (switch between the two Spotlight templates).
  template_id?: PropertyWebsiteTemplateId;
  hero_image?: string | null;
  photo_order?: number[];
  description_override?: string | null;
  featured_amenities?: string[];
  notable_facts?: string[];
  highlights?: string[];
  chapters?: PropertyWebsiteChapter[];
  video_asset_id?: string | null;
  virtual_tour_url?: string | null;
  floor_plans?: PropertyWebsiteFloorPlan[];
  documents?: PropertyWebsiteDocument[];
  agents?: PropertyWebsiteAgent[];
  open_houses?: PropertyWebsiteOpenHouse[];
  colors?: { primary?: string; secondary?: string } | null;
  section_visibility?: Record<string, boolean>;
  story_mode?: 'short' | 'original' | null;
  story_short?: string | null;
  town_story?: { name?: string; body?: string; hidden?: boolean; facts?: import('@/components/property-sites/spotlight/TownSection').TownFacts | null; photo?: import('@/components/property-sites/spotlight/model').TownPhoto | null } | null;
  auto_setup_done?: boolean | null;
  header?: import('@/components/property-sites/spotlight/model').SpotlightHeader | null;
}

export interface PropertyWebsite {
  id: string;
  owner_id: string;
  listing_key?: string | null;
  template_id: PropertyWebsiteTemplateId;
  slug: string;
  status: PropertyWebsiteStatus;
  property_snapshot: PropertyWebsiteSnapshot;
  draft_data: PropertyWebsiteDraft;
  published_snapshot: PropertyWebsiteDraft;
  published_at?: string | null;
  created_at: string;
  updated_at?: string | null;
  public_url?: string | null;
}

// ---- Blogs ----

export type BlogStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'UNPUBLISHED' | 'ARCHIVED';
export type BlogBlockType =
  | 'heading' | 'subheading' | 'paragraph' | 'quote' | 'bulleted_list' | 'numbered_list'
  | 'divider' | 'callout' | 'button' | 'image' | 'gallery' | 'video' | 'youtube' | 'map'
  | 'property_card' | 'agent_profile' | 'contact_form' | 'qr_code' | 'cta' | 'related_articles' | 'disclaimer' | 'lead_form' | 'area_spotlight' | 'property_showcase' | 'video_showcase';

export interface BlogBlock {
  id: string;
  type: BlogBlockType;
  data: Record<string, any>;
}

export type BlogThemeId = 'luxe' | 'editorial' | 'modern' | 'midnight' | 'luxe_plus';

export interface Blog {
  id: string;
  slug: string;
  status: BlogStatus;
  title: string;
  subtitle?: string | null;
  cover_image_url?: string | null;
  theme?: BlogThemeId | null;
  category?: string | null;
  tags: string[];
  blocks: BlogBlock[];
  linked_properties: LinkedProperty[];
  seo_title?: string | null;
  meta_description?: string | null;
  focus_keyword?: string | null;
  social_title?: string | null;
  social_description?: string | null;
  social_image_url?: string | null;
  is_indexed: boolean;
  agent_hub_visible: boolean;
  agent_hub_featured: boolean;
  idx_visible?: boolean;
  use_signature_card?: boolean;
  linked_areas?: string[];
  luxe_metal?: 'gold' | 'silver' | 'bronze' | null;
  accent_color?: string | null;
  ai_review?: BlogAiReview | null;
  scheduled_at?: string | null;
  published_at?: string | null;
  created_at: string;
  updated_at?: string | null;
}

// The AI pipeline's Verified report (backend ai_blog_pipeline_service) - private to the agent.
export interface BlogAiReview {
  /** 'interview' = the writer's answers are autosaved but it hasn't been written yet. */
  status?: 'interview' | 'running' | 'done' | 'failed'
  stage?: string
  /** A brand-new article the AI is (or was) writing - not a rewrite of an existing one. */
  new?: boolean
  /** The writer's saved answers + the step the agent was on (unfinished drafts). */
  brief?: any
  step?: number
  error?: string
  /** The agent went through (or skipped) the writer's Finish step. */
  finished?: boolean
  engine?: 'max' | 'lean'
  checked?: boolean
  claims_checked?: number
  claims_supported?: number
  claims_partly?: number
  claims_unsupported?: number
  issues_found?: number
  issues_fixed?: number
  open_issues?: { kind?: string; severity?: string; quote?: string; problem?: string }[]
  fixed_issues?: { kind?: string; severity?: string; quote?: string; problem?: string; replace?: string }[]
  sources?: { name?: string; url?: string | null; as_of?: string | null; topic?: string }[]
  source_count?: number
  evidence_count?: number
  data_as_of?: string
  scores?: Partial<Record<'accuracy' | 'local_specificity' | 'usefulness' | 'voice' | 'readability' | 'seo' | 'compliance', number>>
  summary?: string
  improvements?: string[]
  seo?: { search_intent?: string; primary_keyword?: string; secondary_keywords?: string[] }
  numbers_to_verify?: string[]
}

export interface BlogListItem {
  id: string;
  slug: string;
  status: BlogStatus;
  title: string;
  subtitle?: string | null;
  cover_image_url?: string | null;
  preview_image_url?: string | null;
  theme?: BlogThemeId | null;
  category?: string | null;
  agent_hub_visible: boolean;
  agent_hub_featured: boolean;
  idx_visible?: boolean;
  scheduled_at?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
  created_at: string;
  view_count: number;
  ai_state?: 'interview' | 'running' | 'failed' | null;
}

export interface BlogAnalytics {
  views: number;
  link_clicks: number;
  property_clicks: number;
  contact_clicks: number;
  video_plays: number;
  qr_scans: number;
  lead_submissions: number;
}

export interface PublicBlogSummary {
  slug: string;
  title: string;
  subtitle?: string | null;
  coverImageUrl?: string | null;
  category?: string | null;
  publishedAt?: string | null;
  readingTimeMinutes: number;
  viewCount: number;
  agentHubVisible: boolean;
  agentHubFeatured: boolean;
}

export interface PublicBlogDetail {
  slug: string;
  title: string;
  subtitle?: string | null;
  coverImageUrl?: string | null;
  previewImageUrl?: string | null;
  theme?: BlogThemeId | null;
  related?: PublicBlogSummary[];
  signatureCard?: boolean;
  areaTowns?: string[];
  /** Linked IDX neighborhood pages (open in a new tab). */
  neighborhoodLinks?: { slug: string; name: string; url: string; photo?: string | null; median_price?: number | null; active_count?: number | null }[];
  luxeMetal?: 'gold' | 'silver' | 'bronze' | null;
  accentColor?: string | null;
  // The agent's forms - the closing section's buttons open them over the article.
  forms?: { formType: string; slug: string; title?: string }[];
  category?: string | null;
  tags: string[];
  blocks: BlogBlock[];
  linkedProperties: LinkedProperty[];
  seoTitle?: string | null;
  metaDescription?: string | null;
  socialTitle?: string | null;
  socialDescription?: string | null;
  socialImageUrl?: string | null;
  isIndexed: boolean;
  publishedAt?: string | null;
  readingTimeMinutes: number;
  agentName: string;
  agentBrokerage: string;
  agentPhotoUrl?: string | null;
  agentId?: string | null;
  agentTitle?: string | null;
  agentMarket?: string | null;
}

export type LeadStatus = 'new' | 'contacted' | 'in_talks' | 'signed' | 'hidden' | 'qualified' | 'converted' | 'archived';
export type LeadRepresented = 'yes' | 'no' | 'unknown';
export type LeadSourceType = 'open_house_visitor' | 'form_submission' | 'property_tour' | 'property_comment' | 'collection_visitor' | 'open_house_second_visit' | 'open_house_disclosure' | 'property_website_inquiry' | 'property_website_tour_request' | 'portal_lead' | 'form_partial' | 'property_page_inquiry' | 'property_page_tour_request' | 'blog_inquiry' | 'website_google_signin'
  // Done inside their Showcase / elsewhere (backend leads_service.log_activity) - keep in sync with schemas/leads.py.
  | 'showcase_like' | 'showcase_dislike' | 'showcase_view' | 'showcase_refine' | 'showcase_search_changed'
  | 'showcase_emails_off' | 'showcase_emails_on' | 'email_unsubscribed' | 'review_left'
  // Email tracking + engagement rules (backend client_email_service).
  | 'email_opened' | 'email_clicked' | 'email_weekly' | 'email_paused' | 'email_resumed';
export type LeadSourceFilter = 'all' | 'open_house' | 'form' | 'showcase' | 'website' | 'tour';
/** 'activity' = needs-you first, then most recent activity (the Leads page default). */
export type LeadSort = 'activity' | 'unrepresented_first' | 'newest' | 'oldest' | 'name';
/** Where the person first came in - the Leads page's "Came in from" filter. */
export type LeadOriginGroup = 'open_house' | 'showcase' | 'forms' | 'listings' | 'website' | 'portal' | 'review' | 'other';

/** How a lead came in / the latest thing they did. */
export interface LeadMoment {
  type: LeadSourceType;
  label: string;
  at: string;
  group?: LeadOriginGroup | null;
  /** Where they were before reaching out ("Scanned the QR under 22 Birch Ln at your open house..."). */
  came_from?: string | null;
}

/** Something waiting on the agent: an open follow-up, or a request they haven't handled. */
export interface LeadTodo {
  kind: 'followup' | 'disclosure' | 'second_visit' | 'showing' | 'comment' | 'refine' | 'likes';
  label: string;
  href?: string | null;
  due_at?: string | null;
  all_day?: boolean;
  bucket?: 'overdue' | 'today' | 'upcoming' | 'someday' | null;
  task_id?: string | null;
  /** false = worth a look, not a must-do. */
  urgent: boolean;
}

export interface LeadShowcase {
  id: string;
  name?: string | null;
  share_token?: string | null;
  short_code?: string | null;
  home_count: number;
  liked: number;
  disliked: number;
  new_matches: number;
  last_active_at?: string | null;
  emails_on: boolean;
  refine_message?: string | null;
}

export interface LeadEvent {
  id: string;
  source_type: LeadSourceType;
  summary: string;
  property_address?: string | null;
  open_house_event_id?: string | null;
  collection_id?: string | null;
  form_id?: string | null;
  raw_snapshot?: Record<string, any> | null;
  occurred_at: string;
  /** The record it came from (form request / submission / visitor / tour / comment id). */
  source_id?: string | null;
  /** Where this touch point is handled - straight to that exact item (backend lead_routes._event_link). */
  link?: { href: string; label: string; external?: boolean } | null;
  /** Where they came from before reaching out (a Similar Homes QR at an open house, the Agent Hub...). */
  came_from?: string | null;
  /** The agent already dealt with it (opened / marked done). */
  handled?: boolean;
}

export interface LeadProperty {
  image?: string | null;
  city?: string | null;
  price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
}

export interface LeadOpenHouse {
  id: string;
  address?: string | null;
  image?: string | null;
  city?: string | null;
  visitor_count?: number;
  visitorCount?: number;
  is_deleted: boolean;
  created_at: string;
}

export interface Lead {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  represented: LeadRepresented;
  status: LeadStatus;
  tags: string[];
  notes?: string | null;
  primary_source: LeadSourceFilter;
  source_count: number;
  last_event_summary?: string | null;
  last_event_source_type?: LeadSourceType | null;
  // Engagement-only timestamp (excludes capture-time events) - intentionally absent for a lead
  // with no real engagement yet. Pairs with the Leads tab's "Active: ..." badge, not with
  // last_event_summary/last_event_source_type above - use last_event_occurred_at for that.
  last_event_at?: string | null;
  last_event_occurred_at?: string | null;
  property_address?: string | null;
  property?: LeadProperty | null;
  // The form's title (e.g. "What's My Home Worth?") when the most recent event is a form
  // submission - lets a card with no property photo show what form this lead came from instead.
  form_title?: string | null;
  open_houses?: LeadOpenHouse[];
  showcase_deleted?: boolean;
  showcase_new_matches?: number;
  has_second_visit_request?: boolean;
  has_disclosure_request?: boolean;
  /** The newest still-open disclosure / second-visit request (deep link: /open-houses?request=<id>). */
  pending_request_id?: string | null;
  has_tour_request?: boolean;
  has_commented?: boolean;
  has_liked_property?: boolean;
  has_disliked_property?: boolean;
  needs_attention?: boolean;
  /** The agent left a note on them (has_note / when the newest one was written). */
  has_note?: boolean;
  note_at?: string | null;
  // The showcase this lead's pending attention item lives in, if any - see getLeadAttentionLink.
  attention_collection_id?: string | null;
  created_at: string;
  last_contacted_at?: string | null;
  hidden_at?: string | null;
  /** How they first came in, and the latest thing they did (any kind). */
  origin?: LeadMoment | null;
  origin_group?: LeadOriginGroup;
  latest?: LeadMoment | null;
  /** What's waiting on the agent - open follow-ups first, then unhandled requests. */
  todos?: LeadTodo[];
  needs_you?: boolean;
  /** Unsubscribed from all emails - Showcase updates no longer reach them. */
  unsubscribed?: boolean;
  /** Emails we sent them + whether automatic ones go daily / weekly / not at all, and why. */
  email_engagement?: EmailPerson | null;
  /** How active they are right now, 0-100 (recent activity counts most). */
  warmth?: number;
  warmth_level?: 'hot' | 'warm' | 'cool' | 'cold';
  /** Quiet for weeks, suddenly active again this week. */
  heating_up?: boolean;
  /** "5 Showcase views this week" */
  warmth_reason?: string | null;
}

/** How automatic emails go to one client: daily (normal), weekly (stopped opening them) or off. */
export type EmailMode = 'daily' | 'weekly' | 'off';
export interface EmailPerson {
  email: string;
  mode: EmailMode;
  reason?: string | null;
  /** ok | unopened_days | weekly_unopened | manual_off | unsubscribed */
  code?: string;
  manual?: string | null;
  since?: string | null;
  sent: number;
  opened: number;
  clicked: number;
  /** % of the last 90 days' emails they opened - null when none were sent. */
  rate?: number | null;
  unopened_in_a_row?: number;
  last_sent_at?: string | null;
  last_subject?: string | null;
  last_template?: string | null;
  last_opened_at?: string | null;
  last_clicked_at?: string | null;
  lead_id?: string | null;
  name?: string | null;
}
export interface ClientEmailRow {
  id: string;
  to: string;
  name?: string | null;
  lead_id?: string | null;
  subject: string;
  template: string;
  /** "daily Showcase update", "tour confirmation"... */
  label: string;
  kind: 'auto' | 'personal';
  via?: 'mailbox' | 'openhousepal' | null;
  status: 'sent' | 'failed';
  /** Why it didn't go through, in plain words (failed only). */
  error?: string | null;
  created_at?: string | null;
  sent_at?: string | null;
  opened_at?: string | null;
  open_count: number;
  clicked_at?: string | null;
  click_count: number;
}

export interface LeadDetail extends Lead {
  events: LeadEvent[];
  showcases?: LeadShowcase[];
}

export type TaskKind = 'call' | 'text' | 'email' | 'showing' | 'general';
export type TaskPriority = 'low' | 'normal' | 'high';
export type TaskBucket = 'overdue' | 'today' | 'upcoming' | 'someday' | 'done';

export interface AgentTask {
  id: string;
  title: string;
  notes?: string | null;
  kind: TaskKind;
  priority: TaskPriority;
  due_at?: string | null;
  all_day: boolean;
  remind_at?: string | null;
  completed_at?: string | null;
  auto_source?: string | null;
  suggested_message?: string | null;
  /** One line on why this follow-up exists, e.g. "Signed in at your open house - 12 Oak St". */
  context?: string | null;
  lead_id?: string | null;
  lead?: { id: string; name?: string | null; email?: string | null; phone?: string | null } | null;
  bucket: TaskBucket;
  /** True once it has an event on the agent's connected Google/Outlook calendar. */
  on_calendar?: boolean;
  /** Public link to the lead's Showcase (unrepresented lead with a live Showcase). */
  showcase_url?: string | null;
  /** Showcase comments this person left: what they said, which home, agent-side link to it. */
  comments?: { text: string; home: string; path: string; url: string }[];
  /** The day(s) / time(s) they picked - showing, second visit, disclosure tour. */
  requested_times?: string[] | null;
  /** What they told you (form answers, their message) - minus the picked times. */
  details?: string[] | null;
  /** The home this follow-up is about - linked to it in their Showcase, else the property details page. */
  property?: { address: string; short: string; url?: string | null; where?: 'showcase' | 'listing' | null; mls?: string | null; photo?: string | null; came_from?: string | null;
    list_agent?: { name?: string | null; phone?: string | null; email?: string | null; office?: string | null } | null } | null;
  created_at: string;
}

export type FollowupWhen = 'same_day' | 'next_day';
export type FollowupStyle = 'timed' | 'all_day';

export interface AutoFollowupRule {
  key: string;
  label: string;
  description: string;
  /** Which heading it sits under (FollowupSettings.groups). */
  group?: string;
  enabled: boolean;
  when: FollowupWhen;
  style: FollowupStyle;
  default_when: FollowupWhen;
  /** The suggested-message template ({tokens} fill in per lead) and whether it's the agent's own. */
  template: string;
  custom_template: boolean;
  default_template: string;
  tokens: MessageToken[];
  /** Situations that build the guest a Showcase also have an editable pitch (part 2); null/absent
   *  everywhere else, and on plans without Showcases. */
  pitch_style?: 'reminder' | 'intro' | null;
  pitch?: string;
  custom_pitch?: boolean;
  /** A fixed, background-only alert this situation also sends (read-only preview). */
  background_alert?: { label: string; description: string; sample: string };
  default_pitch?: string;
  pitch_tokens?: MessageToken[];
  /** An alert for the agent instead of a message (disclosure request, Showcase comment) - read-only. */
  alert_only?: { sample: string };
  /** How Can We Help: sellers get their own message (buyers use `template`). */
  seller?: { default_template: string; tokens: MessageToken[] };
  seller_template?: string;
  custom_seller_template?: boolean;
}

export interface MessageToken {
  key: string;
  label: string;
  /** person | property | link | you - drives the pill colour */
  kind: string;
  sample: string;
}

export interface FollowupSettings {
  /** Master switch - false when the agent turned Follow-ups off entirely. */
  enabled?: boolean;
  rules: AutoFollowupRule[];
  /** Google colorId for follow-up events */
  color: string;
  colors: { id: string; name: string; hex: string }[];
  work_hours: { start: number; end: number };
  /** Phone alerts on every timed follow-up: a heads-up N minutes before (0 = none) and/or at start. */
  alerts: FollowupAlerts;
  alert_before_choices: number[];
  /** Headings the situations are listed under, in order. */
  groups: { key: string; label: string; description: string }[];
  /** "Thanks,
Name | Brokerage" - signed under every suggested message. */
  footer: string;
}

export interface FollowupAlerts { before: number; at_start: boolean }

export interface PublicFollowupOther {
  code: string;
  title: string;
  context?: string | null;
  overdue: boolean;
  due_at?: string | null;
  all_day: boolean;
}

export interface PublicFollowup {
  title: string;
  context?: string | null;
  lead_name?: string | null;
  /** The person this follow-up is about - shown (with Save to contacts) even once it's done. */
  contact?: { name?: string | null; phone?: string | null; email?: string | null } | null;
  done: boolean;
  completed_at?: string | null;
  /** The agent's other follow-ups due today / overdue - "Did you also do these?" */
  others?: PublicFollowupOther[];
}

/** The tap-to-text page (/d/<code>/text): the guest's number + the ready-to-send message. */
export interface PublicFollowupText extends PublicFollowup {
  first_name?: string | null;
  phone: string;
  sms_to: string;
  message: string;
  /** Placeholders still in the message ("[ADD DATE & TIME]") the agent should replace before sending. */
  fill_ins: string[];
}

export interface TaskCounts {
  overdue: number;
  today: number;
  upcoming: number;
  someday: number;
  open_total: number;
}

export interface TaskCreateInput {
  title: string;
  notes?: string | null;
  kind?: TaskKind;
  priority?: TaskPriority;
  due_at?: string | null;
  all_day?: boolean;
  remind_at?: string | null;
  lead_id?: string | null;
  suggested_message?: string | null;
}

export interface TaskUpdateInput {
  title?: string;
  notes?: string | null;
  kind?: TaskKind;
  priority?: TaskPriority;
  due_at?: string | null;
  all_day?: boolean;
  remind_at?: string | null;
  suggested_message?: string | null;
  completed?: boolean;
}

export interface CalendarFeedInfo {
  url: string;
  webcal_url: string;
}

export interface PortalInstruction {
  portal: string;
  label: string;
  steps: string;
}

export interface GoogleCalendarStatus {
  connected: boolean;
  provider: string;
  account_email: string | null;
  calendar_name: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  needs_reconnect?: boolean;
}

export interface MicrosoftCalendarStatus {
  connected: boolean;
  provider: string;
  account_email: string | null;
  calendar_name: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  needs_reconnect?: boolean;
}

export interface IntegrationsInfo {
  crm_push_enabled: boolean;
  crm_webhook_url: string | null;
  crm_parse_email: string | null;
  crm_fub_connected: boolean;
  crm_fub_note: string | null;
  crm_last_push_at: string | null;
  crm_last_push_status: string | null;
  inbound_address: string | null;
  portal_instructions: PortalInstruction[];
  google_calendar_available: boolean;
  google_calendar: GoogleCalendarStatus | null;
  microsoft_calendar_available: boolean;
  microsoft_calendar: MicrosoftCalendarStatus | null;
}

export interface CrmTestResult {
  webhook: string | null;
  email: string | null;
  fub: string | null;
  detail: string;
}

export interface LeadNote {
  id: string;
  lead_id: string;
  author_id?: string | null;
  author_name?: string | null;
  text: string;
  open_house_event_id?: string | null;
  open_house_address?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export type StatMetric = 'agent_hub_visits' | 'agent_hub_interactions' | 'qr_scans' | 'form_views' | 'form_fills' | 'form_completion' | 'blog_reads' | 'open_house_signins' | 'new_leads' | 'open_house_signin_views' | 'open_house_unrepresented' | 'open_house_signin_completion';

export interface StatSummaryEntry {
  current: number;
  previous: number;
  percent: number;
}

export type StatSummary = Record<StatMetric, StatSummaryEntry>;

export interface StatDailyPoint {
  date: string;
  count: number;
}

export interface StatHistory {
  metric: string;
  joined_at: string;
  daily: StatDailyPoint[];
}

// ---- CMA (Comparative Market Analysis) ----

export type CmaMode = 'listing' | 'buyer';
export type CmaStatus = 'DRAFT' | 'READY' | 'SHARED';
export type CmaCompSource = 'mls' | 'manual';
export type CmaCompStatus = 'sold' | 'pending' | 'active_under_contract' | 'active';
// Valuation classification, strongest -> weakest. 'weak' kept for older saved reports.
// Only 'strong' | 'supporting' | 'weak' are shown. 'primary'/'context'/'excluded' are legacy
// values still in old saved reports - fold them in with normalizeStrength() from @/lib/cma.
export type CmaCompStrength = 'strong' | 'supporting' | 'weak' | 'primary' | 'context' | 'excluded';
export type CmaSimpleRating = 'below' | 'similar' | 'above';
export type CmaAreaRating = 'different_from_subject' | 'similar_to_subject' | 'same_as_subject';

export interface CmaSimilarityDensityContext {
  version?: string;
  band?: string;
  distance_half_life_miles: number;
  local_market_half_life_miles?: number;
  reference_count?: number;
  density_neighbor_ranks?: number[];
  density_distances_used_miles?: number[];
  fallback_used?: boolean;
  fallback_half_life_miles?: number | null;
  basis?: string;
  // Canonical hard facts used for this search. Keeping this beside the frozen density context
  // prevents an older/thinner report subject from producing different card percentages.
  subject_snapshot?: Partial<CmaSubjectProperty>;
  subject_snapshot_sha256?: string;
}

export interface CmaSimilarityDetails {
  version?: string;
  display_calibration_version?: string;
  density_context?: CmaSimilarityDensityContext;
  candidate_distance_miles?: number | null;
  component_scores?: Record<string, number>;
  component_points?: Record<string, number>;
  available_component_weight?: number;
  proximity_score_points?: number | null;
  proximity_max_points?: number;
  product_modifier?: number;
  product_mismatch_reasons?: string[];
  base_relevance_score?: number;
  raw_relevance_score?: number;
  display_match_score?: number;
  final_similarity_score?: number;
  subject_snapshot_sha256?: string;
  scoring_authority?: 'backend_continuous_relevance' | string;
  // Eligibility only - never affects match_score/display_match_score above. True for a
  // structurally incompatible property type (condo vs single-family, townhouse vs detached
  // single-family, etc.); such a comp cannot be auto-picked as a primary/Strong comp.
  property_type_incompatible?: boolean;
  // False when this record can't carry any valuation weight at all (a sold comp with no verified
  // closing price, or no finished square footage on record). Still shown in the grid; never
  // auto-picked, since it would only take a slot from a usable sale.
  valuation_eligible?: boolean;
  proposed_role?: 'strong' | 'supporting' | 'weak' | string;
}

export interface CmaSubjectProperty {
  listing_key?: string | null;
  source: CmaCompSource;
  photo_url?: string | null;
  photos?: string[];
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  zipcode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  list_price?: number | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  above_grade_finished_area?: number | null;
  below_grade_finished_area?: number | null;
  lot_size?: number | null;
  year_built?: number | null;
  architectural_style?: string[] | string | null;
  levels?: string[] | string | null;
  township?: string | null;
  subdivision_name?: string | null;
  property_type?: string | null;
  garage?: string | null;
  basement?: string | null;
  days_on_market?: number | null;
  mls_status?: string | null;
  last_sale_date?: string | null;
  last_sale_price?: number | null;
  school_district?: string | null;
  annual_taxes?: number | null;
  water_source?: string[] | string | null;
  sewer?: string[] | string | null;
  public_remarks?: string | null;
  agent_notes?: string | null;
  // Typed in on the manual-entry path (a home not on the MLS yet). `baths` stays the total the
  // engine reads: full + 0.5 per half bath, the way Bright counts BathroomsTotal.
  full_baths?: number | null;
  half_baths?: number | null;
  garage_spaces?: number | null;
  stories?: number | null;
  county?: string | null;
  heating?: string | null;
  cooling?: string | null;
  condition?: string | null;
  recent_updates?: string | null;
  photo_source?: 'upload' | 'street_view' | 'aerial' | null;
}

// GET /api/cma/subject-area - location facts most nearby MLS homes share, in the MLS's spelling.
export interface CmaSubjectArea {
  nearby_count: number;
  school_district: string | null;
  township: string | null;
  county: string | null;
  city: string | null;
  zipcode: string | null;
  subdivision_name: string | null;
  water_source: string | null;
  sewer: string | null;
  school_district_options: string[];
  township_options: string[];
  subdivision_options: string[];
}

export interface CmaLocatedAddress {
  street_address: string | null;
  city: string | null;
  state: string | null;
  zipcode: string | null;
  county: string | null;
  township: string | null;
  latitude: number;
  longitude: number;
  precise: boolean;
  formatted_address: string | null;
}

export interface CmaQualityAssessment {
  finish_quality?: CmaSimpleRating | null;
  interior?: CmaSimpleRating | null;
  exterior?: CmaSimpleRating | null;
  lot?: CmaSimpleRating | null;
  amenities?: CmaSimpleRating | null;
  layout?: CmaSimpleRating | null;
  area?: CmaAreaRating | null;
  // This comp's street/positional character vs. the subject (cul-de-sac/quiet street vs. a major
  // road/highway) - a rating like area, not free text, so it's always one of the three values.
  street_context?: CmaAreaRating | null;
}

export interface CmaComparable {
  id: string;
  listing_key?: string | null;
  source: CmaCompSource;
  is_included: boolean;
  // Set when an agent marks an included-but-shown comp irrelevant via the editor (distinct from
  // fully removing it in the earlier search step) - a short required reason, shown wherever
  // is_included=false is rendered (e.g. CompOrderRail's dimmed state).
  override_reason?: string | null;
  order_index: number;
  status: CmaCompStatus;

  photo_url?: string | null;
  photos?: string[];
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  zipcode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distance_miles?: number | null;

  sale_price?: number | null;        // ONLY a verified closed price
  list_price?: number | null;
  original_list_price?: number | null;
  close_price?: number | null;
  close_date?: string | null;
  sale_date?: string | null;
  price_verified?: boolean;          // false => must not feed valuation math
  days_on_market?: number | null;
  cdom?: number | null;

  sqft?: number | null;
  above_grade_finished_area?: number | null;
  below_grade_finished_area?: number | null;
  lot_size?: number | null;
  beds?: number | null;
  baths?: number | null;
  year_built?: number | null;
  architectural_style?: string[] | string | null;
  levels?: string[] | string | null;
  material_issues?: string[] | null;  // deal-breakers on record (cesspool, "listing says: sold as-is"...)
  township?: string | null;
  subdivision_name?: string | null;
  garage?: string | null;
  basement?: string | null;
  price_per_sqft?: number | null;
  annual_taxes?: number | null;
  school_district?: string | null;
  water_source?: string[] | string | null;
  sewer?: string[] | string | null;
  public_remarks?: string | null;
  property_type?: string | null;
  home_type?: string | null;
  match_score?: number | null;
  similarity_details?: CmaSimilarityDetails | null;
  // OpenStreetMap road/street classification for this comp's location (backend
  // road_context_service). `road_context_note` is the same thing pre-formatted for display.
  road_context?: CmaRoadContext | null;
  road_context_note?: string | null;

  quality: CmaQualityAssessment;
  strength?: CmaCompStrength | null;
  ai_strength?: CmaCompStrength | null;
  valuation_weight?: number | null;
  valuation_role?: 'valuation_comp' | 'context_only' | null;
  // round 9 Fix 2 - the AI's machine-checkable "keep this Strong despite a different market"
  // override; validated against structured evidence in the backend (a thin one is ignored).
  strong_location_override?: boolean | null;
  strong_location_override_reason?: string | null;
  market_equivalence_evidence?: string[] | null;
  commentary?: string | null;
  // AI-drafted note for this comp - separate from `commentary` above, never auto-applied. The
  // frontend offers a "Use this" button to copy it in, still editable after.
  ai_commentary?: string | null;
}

export interface CmaRoadContext {
  verdict: 'quiet' | 'neutral' | 'through' | 'unknown';
  road_types?: string[];
  max_speed_mph?: number | null;
  nearby_road_names?: string[];
  dead_end?: boolean;
  summary?: string | null;
  source?: string;
}

export interface CmaAiEstimate {
  value: number;
  range_min: number;
  range_max: number;
  confidence: 'low' | 'medium' | 'high';
  // round 11 - the ONE authoritative final valuation object. Every client-facing number + status
  // phrase in the PDF / public report is sourced from this, never from independent generation.
  final_valuation?: CmaFinalValuation | null;
  // round 11 - the authoritative listing-status object (from the final timeline). All rendered
  // status language must come from here when present, not report.subject.mls_status.
  status?: CmaFinalStatus | null;
  methodology_summary: string;
  // Buyer-mode only - tactical inspection/negotiation guidance, also written into
  // pricing.offer_suggestion_notes (non-destructively). Kept here too so the UI can show an "AI
  // Generated" marker on that field for as long as it still matches this verbatim.
  offer_strategy_considerations?: string | null;
  // One deterministic contract for every buyer-offer number rendered by Studio, the share page,
  // and the PDF. Valuation range endpoints are deliberately separate from opening-offer fields.
  offer_strategy_fields?: CmaOfferStrategyFields | null;
  inspection_concerns?: string | null;
  // Seller/listing-mode mirror of the two buyer narratives above (null on a buyer report).
  listing_strategy_considerations?: string | null;
  listing_prep_concerns?: string | null;
  // The 2-3 comps that most influenced the value estimate - deterministically ranked and fact-
  // checked (direction vs. real $/sqft), with the AI's own qualitative note kept as written.
  // Client-facing ("Why this number") - unlike qa_flags/qa_blocking below.
  value_drivers?: { comp_key: string; comp_label: string; direction: 'up' | 'down' | 'neutral'; note?: string | null }[] | null;
  // Deterministic QA notes from the generation pass (classification corrections, unverified-price
  // downgrades, DOM caveats, insufficient-comp warnings).
  qa_flags?: string[] | null;
  // Residual hard contradictions the final consistency gate couldn't safely auto-correct (a
  // self-contradicting directional sentence, an un-localizable FMV mismatch, an inverted pricing
  // range). Agent-only, same as qa_flags - never shown on the client PDF or public report - but
  // also gates PDF export until the agent explicitly confirms they've reviewed it.
  qa_blocking?: string[] | null;
  // v10 hardening - structured result of the final pre-export deterministic QA consolidator
  // (directional math, statistical labels, cross-section status/DOM/ask/FMV/range, comp
  // class/rating vs commentary, value-driver vs trace, displayed stats vs backend, prose
  // hygiene). Agent-only; never on the client PDF or public report. Mirrored in
  // valuation_trace.qa for the "How this value was calculated" disclosure.
  qa_result?: CmaValuationQaResult | null;
  // The ONE authoritative source for every descriptive comp statistic shown in Studio, the PDF,
  // and the public report. Computed on the backend (mirrors the old computeMarketMetrics rules
  // exactly - valuation comps only, weighted 1.0/0.5 by classification). The frontend formats
  // these; it must not recompute them. Absent on pre-this-version reports -> frontend falls back.
  comp_stats?: {
    count: number;
    total_shown: number;
    enough_for_stats: boolean;
    sale_min: number | null;
    sale_max: number | null;
    sale_weighted_avg: number | null;
    sale_median: number | null;
    psf_min: number | null;
    psf_max: number | null;
    psf_weighted_avg: number | null;
    psf_median: number | null;
    method: string;
  } | null;
  verified_strong_comp_count?: number;
  weighted_comp_count?: number;
  // v10 - the full deterministic audit trail behind `value`. Agent-only ("How this value was
  // calculated" disclosure in Studio); never rendered on the client PDF or public report.
  valuation_trace?: CmaValuationTrace | null;
  exposure_state?: string | null;
  // True when there weren't enough verified comps for a deterministic anchor - the value is a
  // provisional wide range and qa_blocking carries a "review before export" gate.
  insufficient_evidence?: boolean | null;
  // OpenStreetMap road/street classification for the SUBJECT (each comp carries its own on
  // comp.road_context).
  subject_road_context?: CmaRoadContext | null;
  model?: string;
  generated_at?: string;
}

export interface CmaOfferStrategyFields {
  contract_version: 'deterministic-offer-v1' | string;
  opening_offer_low: number;
  opening_offer_high: number;
  strong_offer: number;
  fmv: number;
  valuation_range_low: number | null;
  valuation_range_high: number | null;
  list_price: number | null;
  opening_pct_low_vs_list: number | null;
  opening_pct_high_vs_list: number | null;
  opening_pct_phrase: string | null;
  aggression?: 'low' | 'moderate' | 'high';
  underpriced?: boolean;
}

export interface CmaFinalStatus {
  current: string;
  label: string;                 // "Active" | "Under Contract" | "Sold" | "Off Market"
  group: 'on_market' | 'under_contract' | 'closed' | 'off_market';
  is_active: boolean;
  is_under_contract: boolean;
  is_closed: boolean;
  active_market_days?: number | null;
  as_of?: string | null;
}

export interface CmaFinalValuation {
  value: number | null;
  range_pct: number | null;
  range_min: number | null;
  range_max: number | null;
  confidence: 'low' | 'medium' | 'high' | null;
  authority?: 'reasoning_model' | 'deterministic_v10' | string;
  reasoning_model?: string | null;
  v10_formula_fmv?: number | null;
  anchor_value?: number | null;
  anchor_low?: number | null;
  anchor_high?: number | null;
  // round 12 issue #3 - the methodology-of-record is reconciled to the FINAL comp set, not just FMV/range
  anchor_weighted_comp_count?: number | null;
  anchor_closed_comp_count?: number | null;
  anchor_comps?: Array<{ label: string | null; strength: string | null; normalized_weight?: number | null; dollar_contribution?: number | null }>;
  list_price?: number | null;
  exposure_state?: string | null;
  gate_action?: string | null;
  fmv_pre_exposure?: number | null;
  ai_value_cross_check?: number | null;
  insufficient_evidence?: boolean;
  stat_method_label: string;     // "Weighted Average" | "Average" - derived from stat_method
  stat_method?: string | null;
  status: CmaFinalStatus;
}

export interface CmaValuationQaResult {
  version: string;
  checked_at?: string;
  checks_run: string[];
  passed: boolean;
  warnings: string[];
  blocking_errors: string[];
  // round 11 - blocking that originated OUTSIDE _v10_pre_export_qa (valuation reconciliation, the
  // exposure gate, the range check) and was merged into blocking_errors so export_allowed is
  // authoritative.
  external_blocking?: string[];
  corrections: string[];
  export_allowed: boolean;
}

export interface CmaValuationTraceAdjustment {
  factor: string;
  direction: 'up' | 'down';
  basis_type: 'paired_market_evidence' | 'comp_inferred' | 'model_judgment';
  original_basis_type?: string;   // what the AI claimed, before the validator downgraded it
  family?: string;                // adjustment-family for the dedup pass
  basis: string;
  confidence: 'low' | 'medium' | 'high';
  validation_note?: string | null;
  amount_low: number;
  amount_high: number;
  applied: number;          // signed dollars actually applied after caps/sub-caps
  capped?: boolean;
  subcap_scaled?: string;
  family_deduped?: boolean;
  qual_recon_scaled?: boolean;   // round 9 Fix 3 - scaled by the weighted-signal reconciliation
}

export interface CmaWeightedQualSignal {
  signal: number;   // -1..+1 ; positive = weighted comp set is SUPERIOR (subject inferior)
  direction: 'subject_inferior' | 'subject_superior' | 'similar_or_mixed';
  weight_covered: number;   // fraction of anchor weight that carried a rating on this bucket
  metric_label?: string;
  basis?: string;
  explicit_comp_accessory_evidence?: { comp?: string | null; features?: string[] }[];
}

export interface CmaValuationTraceComp {
  label: string;
  strength: string | null;
  price_basis?: 'closed_verified' | 'list_context';
  status?: string;
  distance_miles?: number | null;
  raw_sale_price: number;
  raw_psf: number;
  size_adjusted_price: number;
  sqft?: number;
  below_grade_frac?: number;
  quality?: Record<string, string | null>;
  explicit_accessory_features?: string[];
  // round 9 Fix 1 - $/sqft-leg sqft-composition normalization (finished basement / aux space)
  total_finished_sqft?: number | null;
  above_grade_sqft?: number | null;
  below_grade_sqft?: number;
  // round 11 - never call an above-grade rate a "total-area" rate
  raw_total_finished_psf?: number | null;   // price / TOTAL finished area
  adjusted_above_grade_psf?: number;         // the above-grade figure actually used in the leg
  psf_used_in_leg?: number;
  adjusted_above_grade_psf_used?: boolean;
  below_grade_contributory_value_applied?: number | null;
  below_grade_basis?: string | null;
  below_grade_rate_source?: 'explicit' | 'paired_comps' | 'fallback_heuristic' | null;
  psf_leg_heuristic_used?: boolean;
  psf_leg_eligibility?: 'full' | 'adjusted_downweighted' | 'blended_downweighted' | 'excluded_from_psf_leg';
  psf_leg_weight_mult?: number;
  psf_leg_exclusion_reason?: string | null;
  // round 9 Fix 2 - market-location consistency (AI class vs. evidence vs. final weight)
  ai_class?: string | null;
  validated_class?: string | null;
  location_score?: number | null;
  street_context_score?: number | null;
  distance_score?: number | null;
  area_compatibility?: string | null;
  school_township_compatibility?: string | null;
  location_negatives?: string[];
  location_override?: boolean;
  location_weight_penalty?: number;
  // round 12 issue #1 - a pure condition/renovation gap was re-classified as an adjustment, not a demotion
  condition_class_promoted?: boolean;
  condition_class_change?: string | null;   // e.g. "weak → supporting"
  condition_gap_direction?: string | null;
  ev_score_full?: number | null;
  ev_score_ex_recency?: number | null;
  ev_components?: Record<string, number>;
  recency_weight?: number | null;
  outlier?: boolean;
  outlier_penalty?: number;
  redundancy_penalty?: number;
  weight_raw?: number;
  normalized_weight: number;
  dollar_contribution_to_anchor?: number;
  sale_to_list?: number | null;
  // 10/20 adjustment grid: sale price -> size -> lower level / baths / garage / cesspool -> adjusted
  listing_key?: string | null;
  size_adjustment?: number;
  feature_adjustments?: {
    below_grade: number; baths: number; garage: number; sewer?: number; total: number;
    notes?: string[]; below_grade_rate_psf?: number;
  };
}

export interface CmaValuationTrace {
  mode: 'frontier_reasoning_authority' | 'hybrid_v10' | 'ai_only' | 'insufficient_evidence';
  authority?: 'reasoning_model' | 'v10' | string;
  deterministic_anchor?: number | null;
  v10_formula_fmv?: number | null;
  v10_formula_range_pct?: number | null;
  reasoning_model_fmv?: number | null;
  reasoning_model_range_low?: number | null;
  reasoning_model_range_high?: number | null;
  reasoning_model_confidence?: 'low' | 'medium' | 'high' | null;
  reasoning_delta_vs_anchor?: number | null;
  reasoning_delta_vs_v10?: number | null;
  reasoning_delta_vs_anchor_pct?: number | null;
  reasoning_delta_vs_v10_pct?: number | null;
  reasoning_model_name?: string | null;
  reasoning_effort?: string | null;
  reasoning_model?: Record<string, unknown> | null;
  relevance_weighting?: {
    version?: string;
    density_context?: CmaSimilarityDensityContext;
    component_weights?: Record<string, number>;
    comps?: Array<{
      label: string;
      candidate_distance_miles?: number | null;
      local_market_half_life_miles?: number | null;
      components?: Record<string, number>;
      component_points?: Record<string, number>;
      proximity_score_points?: number | null;
      proximity_max_points?: number;
      product_modifier?: number;
      product_mismatch_reasons?: string[];
      adjusted_relevance_score?: number;
      proposed_role?: string;
      normalized_weight?: number;
    }>;
  } | null;
  prompt_version?: string;
  insufficient_evidence?: boolean;
  requires_agent_review?: boolean;
  closed_comp_count?: number;
  // v10 hardening item 8 - anchor-validity escape hatch. 'weak'/'invalid' means the comp set was
  // objectively too thin/incoherent to bound a value against (not the AI disagreeing with a valid
  // anchor); 'invalid' routes to the provisional-range + agent-review path.
  anchor_validity?: 'ok' | 'weak' | 'invalid' | null;
  anchor_validity_reason?: string | null;
  provisional_range?: (number | null)[];
  provisional_centre?: number | null;
  provisional_centre_source?: string | null;
  // Mirror of ai_estimate.qa_result, attached to the trace for the Studio disclosure panel.
  qa?: CmaValuationQaResult | null;
  anchor?: {
    mode?: 'closed_only' | 'mixed' | 'insufficient';
    anchor_validity?: 'ok' | 'weak' | 'invalid' | null;
    anchor_validity_reason?: string | null;
    main_uncertainties?: string[];   // 10/20: what the comp set cannot pin down, in client words
    // authoritative descriptive stats over the weighted comp set - one source any "average /
    // median" figure shown anywhere is cross-checked against.
    comp_stats?: {
      n: number; weighted_mean_sale: number; weighted_mean_psf: number;
      simple_mean_sale: number; simple_mean_psf: number; median_sale: number; median_psf: number;
      min_sale: number; max_sale: number; method: string;
    } | null;
    anchor_value: number;
    anchor_low: number;
    anchor_high: number;
    sale_price_indication: number;
    psf_indication: number;
    psf_indication_per_sqft: number;
    // round 9 Fix 1 - the $/sqft leg is sqft-composition-normalized; the raw figure is kept for audit
    psf_indication_basis?: string;
    psf_indication_unnormalized?: number;
    psf_leg_comp_count?: number;
    psf_leg_normalized_comp_count?: number;
    psf_leg_heuristic_comp_count?: number;
    below_grade_rate_sources?: string[] | null;
    paired_below_grade_psf?: number | null;
    weighted_raw_sale_mean?: number;
    subject_sqft_used: number;
    subject_below_grade_frac?: number;
    closed_comp_count?: number;
    weighted_comp_count?: number;
    context_comps?: { label: string; price: number; psf: number; status: string; basis: string }[] | null;
    size_model: string;
    regression_slope_psf_per_sqft?: number | null;
    size_elasticity_beta?: number | null;
    sale_psf_divergence_pct: number;
    spread_pct: number;
    comp_list_to_sale_median?: number | null;
    // absent on an "insufficient" fallback anchor (rough value only, no weighted comp set)
    comps?: CmaValuationTraceComp[];
    anchor_value_is_rough?: boolean;
  } | null;
  provisional_anchor_value?: number | null;
  anchor_shift_from_provisional_pct?: number | null;
  exposure?: {
    state: string;
    demand_signal?: string | null;
    active_market_days?: number | null;
    comp_median_dom?: number | null;
    dom_thresholds?: { short: number; normal: number; extended: number };
    dom_basis?: string;
    current_list_price?: number | null;
    original_list_price?: number | null;
    previous_list_price?: number | null;
    price_cut_pct?: number;
    price_reduced?: boolean;
    price_increase?: boolean;
    price_history?: { event: string; price: number }[];
    // v10 hardening item 11 - first-class structured listing history from Bright / RESO fields
    // (price moves, back-on-market, withdrawal, relist, prior fallen-through contract). `source`
    // is 'mls' for an explicit field or 'inferred' for the cumulative-vs-active-DOM fallback.
    history_events?: {
      event: string; source: 'mls' | 'inferred'; date?: string;
      price?: number; from_price?: number; to_price?: number; detail?: string;
    }[] | null;
    prior_failed_contract?: boolean | null;
    back_on_market?: boolean | null;
    verified_contract_price?: number | null;
    cumulative_dom?: number | null;
    current_status?: string | null;
    under_contract_date?: string | null;
    comp_list_to_sale_median?: number | null;
    exposure_ceiling?: number | null;
    hard_upper?: number | null;
    pull_target?: number | null;
    relisted_note?: string | null;
    meaning?: string;
  } | null;
  adjustments?: CmaValuationTraceAdjustment[];
  adjustment_total?: number;
  adjustment_bound_pct?: number;
  // round 9 Fix 3 - weighted qualitative signals + their reconciliation against the itemised adjustments
  weighted_condition_signal?: CmaWeightedQualSignal | null;
  weighted_location_signal?: CmaWeightedQualSignal | null;
  weighted_amenity_signal?: CmaWeightedQualSignal | null;
  weighted_accessory_space_signal?: CmaWeightedQualSignal | null;
  qualitative_reconciliation?: {
    signals?: Record<string, CmaWeightedQualSignal>;
    conflicts?: string[];
    omissions?: string[];
    offsets_accepted?: string[];
    adjustments_scaled?: string[];
    diagnostic_notes?: string[];
  } | null;
  anchor_dispute?: boolean;
  anchor_dispute_reason?: string | null;
  fmv_pre_exposure?: number;
  above_ask_gate?: {
    applied: boolean;
    action?: 'pulled_down' | 'allowed_above_ceiling' | 'extended_pull' | 'capped_by_exposure' | 'clamped_to_contract_price';
    from?: number; to?: number; fmv?: number;
    ceiling?: number; max_defensible?: number; hard_upper?: number; contract_price?: number;
    paired_evidence_premium?: number; justified_by?: string[]; extended_pull_to?: number;
  };
  subject_asking?: number | null;
  ai_value_cross_check?: number | null;
  final_fmv?: number;
  asking_price_check?: { asking_price?: number; ratio_used?: number; expected_sale_price?: number; allowed_low_price?: number; allowed_high_price?: number; passed_over?: boolean } | null;
  range_pct?: number;
  range_floor_pct?: number;
  confidence_seed?: 'low' | 'medium' | 'high';
}

export interface CmaPricing {
  comparable_suggested_min?: number | null;
  comparable_suggested_max?: number | null;
  recommended_min?: number | null;
  recommended_max?: number | null;
  most_likely_value?: number | null;
  recommended_list_price?: number | null;
  pricing_commentary?: string | null;
  // Listing mode - AI-filled once (non-destructively), shown as Pricing Strategy / Listing Prep.
  listing_strategy_notes?: string | null;
  listing_prep_notes?: string | null;
  estimated_fair_value?: number | null;
  suggested_offer_min?: number | null;
  suggested_offer_max?: number | null;
  strong_offer?: number | null;
  max_recommended_price?: number | null;
  // AI-auto-filled (once, non-destructively) with its valuation reasoning in buyer mode - shown
  // in the UI as "Buyer Valuation - Agent Notes".
  offer_strategy_commentary?: string | null;
  inspection_concerns?: string | null;
  // Agent-only, never touched by AI - how the agent would actually structure an offer on this home.
  offer_suggestion_notes?: string | null;
  // AI-proposed value + range for the subject - same non-destructive pattern as
  // CmaComparable.ai_commentary, applied into the fields above via an explicit "Apply" action.
  ai_estimate?: CmaAiEstimate | null;
}

export interface CmaAiAnalysisMeta {
  generated_at?: string | null;
  model?: string | null;
  cost_usd?: number | null;
  input_fingerprint?: string | null;
  images_sent?: Record<string, string[]> | null;
  warnings?: string[];
}

export interface CmaMarketContext {
  recent_sales_count?: number | null;
  median_sale_price?: number | null;
  median_price_per_sqft?: number | null;
  highest_recent_sale?: number | null;
  highest_price_per_sqft_sale?: number | null;
  avg_days_on_market?: number | null;
  highlight_statements: string[];
  hidden: boolean;
}

export interface CmaImprovement {
  id: string;
  type?: string | null;
  description?: string | null;
  approx_size?: string | null;
  estimated_value_context?: string | null;
  agent_notes?: string | null;
  ai_generated?: boolean;
}

export interface CmaPresentationSettings {
  hidden_sections: string[];
  hidden_comp_ids: string[];
  cover_photo_url?: string | null;
  // Which theme the public share link opens in for a visitor by default - null/undefined means
  // dark (the site's current default). The IDX-embedded view always ignores this and stays light.
  default_theme?: 'light' | 'dark' | null;
}

export interface CmaReport {
  id: string;
  client_name?: string | null;
  mode: CmaMode;
  status: CmaStatus;
  subject: CmaSubjectProperty;
  comparables: CmaComparable[];
  pricing: CmaPricing;
  market_context: CmaMarketContext;
  improvements: CmaImprovement[];
  presentation: CmaPresentationSettings;
  ai_analysis?: CmaAiAnalysisMeta | null;
  share_slug?: string | null;
  // Web version of the shared report ends with the Email Signature card (plans with signatures). On by default.
  use_signature_card?: boolean;
  // In-flight "Create AI Analysis" / recompute marker - lets a client that navigated away mid-run
  // and came back (or the list page) tell it's still running server-side. See
  // app/studio/cma/[id]/page.tsx's resumed-generation effect.
  generation_status?: 'generating' | 'complete' | 'failed' | null;
  generation_started_at?: string | null;
  /** Why the last AI run did not finish (a usage limit, an error). */
  generation_error?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface CmaReportListItem {
  id: string;
  client_name?: string | null;
  mode: CmaMode;
  status: CmaStatus;
  share_slug?: string | null;
  subject_address?: string | null;
  subject_photo_url?: string | null;
  comparable_count: number;
  fair_value?: number | null;
  value_range_min?: number | null;
  value_range_max?: number | null;
  default_theme?: 'light' | 'dark' | null;
  export_allowed?: boolean;
  qa_blocking_count?: number;
  generation_status?: 'generating' | 'complete' | 'failed' | null;
  updated_at?: string | null;
  created_at: string;
}

export interface CmaCompSearchParams {
  listing_key?: string | null;
  subject?: Partial<CmaSubjectProperty> | null;
  latitude?: number | null;
  longitude?: number | null;
  subject_sqft?: number | null;
  property_type?: string | null;
  radius_miles?: number;
  statuses?: CmaCompStatus[];
  sale_date_from?: string | null;
  sale_date_to?: string | null;
  min_price?: number | null;
  max_price?: number | null;
  min_sqft?: number | null;
  max_sqft?: number | null;
  min_lot_size?: number | null;
  max_lot_size?: number | null;
  min_beds?: number | null;
  min_baths?: number | null;
  min_year_built?: number | null;
  max_year_built?: number | null;
  school_district?: string | null;
  city?: string | null;
  exclude_listing_keys?: string[];
}

export interface CmaCompCandidate {
  listing_key: string;
  source: 'mls';
  status: CmaCompStatus;
  photo_url?: string | null;
  photos?: string[] | null;
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  zipcode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distance_miles?: number | null;
  sale_price?: number | null;        // ONLY a verified closed price
  list_price?: number | null;
  original_list_price?: number | null;
  close_price?: number | null;
  close_date?: string | null;
  sale_date?: string | null;
  price_verified?: boolean;
  days_on_market?: number | null;
  cdom?: number | null;
  sqft?: number | null;
  above_grade_finished_area?: number | null;
  below_grade_finished_area?: number | null;
  lot_size?: number | null;
  beds?: number | null;
  baths?: number | null;
  year_built?: number | null;
  architectural_style?: string[] | string | null;
  levels?: string[] | string | null;
  township?: string | null;
  subdivision_name?: string | null;
  garage?: string | null;
  basement?: string | null;
  price_per_sqft?: number | null;
  school_district?: string | null;
  water_source?: string[] | string | null;
  sewer?: string[] | string | null;
  public_remarks?: string | null;
  annual_taxes?: number | null;
  property_type?: string | null;
  similarity_context?: CmaSimilarityDensityContext | null;
  match_score: number;
  similarity_details: CmaSimilarityDetails;
}

export interface CmaShareResponse {
  share_slug: string;
  status: CmaStatus;
  public_path: string;
}

export interface CmaPublicAgent {
  name: string;
  headshot_url?: string | null;
  brokerage?: string | null;
  phone?: string | null;
  email?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  agent_hub_slug?: string | null;
  idx_site_url?: string | null;
}

export interface CmaPublicResponse {
  client_name?: string | null;
  mode: CmaMode;
  subject: CmaSubjectProperty;
  comparables: CmaComparable[];
  pricing: CmaPricing;
  market_context: CmaMarketContext;
  improvements: CmaImprovement[];
  presentation: CmaPresentationSettings;
  agent: CmaPublicAgent;
  // Set when the web view should end with the agent's Email Signature card (never the PDF).
  signature_hub_slug?: string | null;
  updated_at?: string | null;
}

// ============================================================================
// Financial Tools: Seller Net Sheet
// ============================================================================

export type FinancialToolStatus = 'DRAFT' | 'READY' | 'SHARED';

export interface SnsProperty {
  listing_key?: string | null;
  source: 'mls' | 'manual';
  photo_url?: string | null;
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  zipcode?: string | null;
  list_price?: number | null;
  previous_sale_price?: number | null;
  annual_taxes?: number | null;
  property_type?: string | null;
  closing_date?: string | null;
}

export interface SnsScenario {
  id: string;
  label?: string | null;
  sale_price?: number | null;
}

export interface SnsLineItem {
  id: string;
  label: string;
  amount?: number | null;
}

export interface SnsCompensationSide {
  percent?: number | null;
  flat_amount?: number | null;
}

export interface SnsCompensation {
  listing_side: SnsCompensationSide;
  buyer_side: SnsCompensationSide;
}

export interface SnsTaxProration {
  amount?: number | null;
}

export interface SellerNetSheet {
  id: string;
  client_name?: string | null;
  status: FinancialToolStatus;
  property: SnsProperty;
  scenarios: SnsScenario[];
  mortgage_payoffs: SnsLineItem[];
  compensation: SnsCompensation;
  closing_costs: SnsLineItem[];
  tax_proration: SnsTaxProration;
  repairs: SnsLineItem[];
  notes?: string | null;
  disclaimer?: string | null;
  share_slug?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface SellerNetSheetListItem {
  id: string;
  client_name?: string | null;
  status: FinancialToolStatus;
  property_address?: string | null;
  property_photo_url?: string | null;
  scenario_count: number;
  top_sale_price?: number | null;
  share_slug?: string | null;
  updated_at?: string | null;
  created_at: string;
}

export interface SnsPublicAgent {
  name: string;
  headshot_url?: string | null;
  brokerage?: string | null;
  phone?: string | null;
  email?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  agent_hub_slug?: string | null;
}

export interface SellerNetSheetPublicResponse {
  client_name?: string | null;
  property: SnsProperty;
  scenarios: SnsScenario[];
  mortgage_payoffs: SnsLineItem[];
  compensation: SnsCompensation;
  closing_costs: SnsLineItem[];
  tax_proration: SnsTaxProration;
  repairs: SnsLineItem[];
  notes?: string | null;
  disclaimer?: string | null;
  agent: SnsPublicAgent;
  updated_at?: string | null;
}

// ============================================================================
// Financial Tools: Buyer Cash Needed
// ============================================================================

export type BcnLoanType = 'conventional' | 'jumbo' | 'fha' | 'va' | 'cash' | 'other';

export interface BcnProperty {
  listing_key?: string | null;
  source: 'mls' | 'manual';
  photo_url?: string | null;
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  zipcode?: string | null;
  list_price?: number | null;
  annual_taxes?: number | null;
  hoa_fee?: number | null;
  property_type?: string | null;
  closing_date?: string | null;
}

export interface BcnAmount {
  amount?: number | null;
}

export interface BcnDownPaymentScenario {
  id: string;
  label?: string | null;
  percent?: number | null;
}

export interface BcnLineItem {
  id: string;
  label: string;
  amount?: number | null;
  enabled: boolean;
}

export interface BcnCredits {
  seller_credit?: number | null;
  lender_credit?: number | null;
}

export interface BcnMonthlyContext {
  include: boolean;
  interest_rate?: number | null;
  loan_term_years: number;
  homeowners_insurance_monthly?: number | null;
}

export interface BuyerCashNeeded {
  id: string;
  client_name?: string | null;
  status: FinancialToolStatus;
  property: BcnProperty;
  purchase_price: BcnAmount;
  down_payment_scenarios: BcnDownPaymentScenario[];
  loan_type: BcnLoanType;
  closing_costs: BcnLineItem[];
  prepaid_expenses: BcnLineItem[];
  inspections: BcnLineItem[];
  earnest_money: BcnAmount;
  credits: BcnCredits;
  monthly_context: BcnMonthlyContext;
  notes?: string | null;
  disclaimer?: string | null;
  share_slug?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface BuyerCashNeededListItem {
  id: string;
  client_name?: string | null;
  status: FinancialToolStatus;
  property_address?: string | null;
  property_photo_url?: string | null;
  purchase_price?: number | null;
  share_slug?: string | null;
  updated_at?: string | null;
  created_at: string;
}

export interface BcnPublicAgent {
  name: string;
  headshot_url?: string | null;
  brokerage?: string | null;
  phone?: string | null;
  email?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  agent_hub_slug?: string | null;
}

export interface BuyerCashNeededPublicResponse {
  client_name?: string | null;
  property: BcnProperty;
  purchase_price: BcnAmount;
  down_payment_scenarios: BcnDownPaymentScenario[];
  loan_type: BcnLoanType;
  closing_costs: BcnLineItem[];
  prepaid_expenses: BcnLineItem[];
  inspections: BcnLineItem[];
  earnest_money: BcnAmount;
  credits: BcnCredits;
  monthly_context: BcnMonthlyContext;
  notes?: string | null;
  disclaimer?: string | null;
  agent: BcnPublicAgent;
  updated_at?: string | null;
}

// AI Assistant

export interface AIConversationListItem {
  id: string;
  title?: string | null;
  created_at: string;
  last_message_at?: string | null;
}

export interface AIToolCallRef {
  tool: string;
  record_type: 'lead' | 'property' | 'open_house' | 'cma' | 'showcase' | string;
  record_id: string;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tool_calls?: AIToolCallRef[] | null;
  created_at: string;
}

export interface AIConversation extends AIConversationListItem {
  messages: AIMessage[];
}

export interface AISendMessageResponse {
  conversation_id: string;
  user_message: AIMessage;
  assistant_message: AIMessage;
}

export interface AIInsight {
  id: string;
  title: string;
  detail: string;
  severity: 'info' | 'attention' | 'urgent';
  link?: string | null;
}

export interface AIInsightsResponse {
  insights: AIInsight[];
  generated_at: string;
}

export interface DigestItem {
  id: string;
  kind: string;
  title: string;
  detail: string;
  severity: 'info' | 'attention' | 'urgent';
  link?: string | null;
  lead_name?: string | null;
  occurred_at?: string | null;
}

export interface DailyDigest {
  needs_attention: DigestItem[];
  today: DigestItem[];
  generated_at: string;
}

// Admin AI-usage analytics - metadata only (cost, tokens, tool names, timing), never
// conversation content. See backend/app/api/admin_ai_routes.py.
export interface AIAdminDailyPoint {
  date: string;
  cost_usd: number;
  messages: number;
}

export interface AIAdminBudgetStatus {
  bucket: string;
  label: string;
  day_spent_usd: number;
  day_limit_usd?: number | null;
  month_spent_usd: number;
  month_limit_usd?: number | null;
  day_count?: number | null;
  day_count_limit?: number | null;
  month_count?: number | null;
  month_count_limit?: number | null;
  free_tier_note?: string | null;
  est_remaining_calls_month?: number | null;
}

export interface AIAdminTopConsumer {
  kind: 'ip' | 'device';
  identifier: string;
  spent_today_usd: number;
  limit_usd: number;
}

export interface AIAdminOverview {
  total_cost_month_usd: number;
  total_cost_today_usd?: number;
  total_cost_all_time_usd: number;
  messages_month: number;
  active_agents_30d: number;
  blocked_count_month: number;
  top_block_reasons: { reason: string; count: number }[];
  daily_trend_30d: AIAdminDailyPoint[];
  cost_by_type_month: Record<string, number>;
  cost_by_provider_month: Record<string, number>;
  global_budget_status: AIAdminBudgetStatus[];
  top_google_places_consumers: AIAdminTopConsumer[];
  recent_provider_failures: { event_type: string; reason: string; count: number; last_seen: string | null }[];
}

export interface AIAdminAgentSummary {
  owner_id: string;
  name: string;
  email: string;
  cost_usd: number;
  messages: number;
  tool_calls: number;
  blocked_count: number;
  last_active?: string | null;
  site_spend_today_usd: number;
  site_spend_month_usd: number;
  site_daily_limit_usd?: number | null;
  total_spend_today_usd: number;
  total_spend_month_usd: number;
  total_daily_limit_usd?: number | null;
}

export interface AIAdminMonthlyPoint {
  month: string; // YYYY-MM
  cost_usd: number;
  messages: number;
}

export interface AIAdminAgentDetail extends AIAdminAgentSummary {
  daily_trend: AIAdminDailyPoint[];
  monthly_trend: AIAdminMonthlyPoint[];
  tool_usage: Record<string, number>;
  cost_by_type: Record<string, number>;
}

// Admin agent storage analytics - see backend/app/api/admin_storage_routes.py.
export interface AdminStorageCategoryStat {
  category: string;
  bytes: number;
  count: number;
}

export interface AdminStorageMonthlyPoint {
  month: string; // YYYY-MM
  bytes_added: number;
}

export interface AdminStorageAgentSummary {
  owner_id: string;
  name: string;
  email: string;
  plan_tier?: string | null;
  used_bytes: number;
  cap_bytes: number;
  item_count: number;
}

export interface AdminStorageAgentDetail extends AdminStorageAgentSummary {
  by_category: AdminStorageCategoryStat[];
  monthly_trend: AdminStorageMonthlyPoint[];
}


// Talk to OHP (OpenAI Realtime). See backend/app/services/ai/ai_realtime_service.py.
export interface AIRealtimeSessionOut {
  session_id: string;
  client_secret: string | null;
  expires_at: number | string | null;
  model: string;
  voice: string;
  max_session_seconds: number;
  max_idle_seconds: number;
}

export interface AIRealtimeToolCallResult {
  result: unknown;
  refs: AIToolCallRef[];
}

// ---- AI Blog Writer (backend services/ai/ai_blog_writer_service.py) ----
export interface BlogAiPropertyRef {
  id: string
  address: string
  city?: string | null
  state?: string | null
  price?: number | null
  beds?: number | null
  baths?: number | null
  sqft?: number | null
  status?: string | null
  sold_date?: string | null
  image_url?: string | null
}

export interface BlogAiContext {
  agent: { name: string; title: string; brokerage: string; market: string; about: string }
  served_areas: string[]
  recent_sales: BlogAiPropertyRef[]
  listings: BlogAiPropertyRef[]
  /** Verified Town Spotlight snapshots for every town the agent serves. */
  area_cards?: any[]
  /** The agent's Agent Hub videos + house tours (YouTube links). */
  videos?: { id: string; title: string; url: string; image?: string | null; kind: 'video' | 'tour' }[]
  usage_percent: number | null
  ai_available: boolean
  blocked_message: string | null
}

export type BlogAiTone = 'warm' | 'professional' | 'luxury' | 'energetic' | 'straight'
export type BlogAiLength = 'short' | 'standard' | 'long'
export type BlogAiRefineAction = 'rewrite' | 'expand' | 'shorten' | 'more_local' | 'more_personal' | 'simplify' | 'custom'

export interface BlogAiBrief {
  topic: string
  goal?: string
  audiences: string[]
  areas: string[]
  key_points?: string
  personal_take?: string
  facts?: string
  include_recent_sales: boolean
  sale_ids: string[]
  /** Towns (Areas slugs) to add a Town Spotlight section for. */
  area_slugs?: string[]
  listings: LinkedProperty[]
  /** One of the agent's videos to tie in - the AI writes a section for it and it's embedded there. */
  video?: { url: string; title?: string }
  tone: BlogAiTone
  length: BlogAiLength
  cta?: string
  category_hint?: string
  blog_id?: string
  /** 'max' (Premium) / 'lean' = the researched, fact-checked pipeline; omitted = the quick single-step writer. */
  engine?: 'max' | 'lean'
}

export interface BlogAiGenerateResult {
  blog: Blog
  facts_used: { fact: string; source: string }[]
  numbers_to_verify: string[]
  cover_image_idea: string | null
  verification?: BlogAiReview | null
}

// Settings -> IDX Website (backend site_routes._link_domain_state). default_base_url is the free
// <slug>.openhousepal.com; custom_domain/own_base_url exist only once the agent's OWN domain is connected.
export interface LinkDomainState {
  site_enabled: boolean
  has_custom_domain: boolean
  custom_domain: string | null
  use_own_domain: boolean
  own_base_url: string | null
  default_base_url: string
  platform_base_url: string
  current_base_url: string
}

// GET /agent-hub/me/marketing-moments - see agent_hub_routes.get_marketing_moments.
export interface MarketingListing {
  id: string; listing_key: string; address: string; city: string; state: string; zipcode?: string | null
  price?: number | null; status?: string | null; image?: string | null; photos?: string[] | null
  beds?: number | null; baths?: number | null; sqft?: number | null; acres?: number | null
  listed_at?: string | null; days_on_market?: number | null; is_new: boolean; has_spotlight: boolean
}
export interface MarketingSale {
  id: string; address: string; city: string; state: string; price?: number | null; image?: string | null
  sold_date?: string | null; beds?: number | null; baths?: number | null; sqft?: number | null
}
export interface StudioPick {
  kind: 'listing' | 'sale'; key: string; id: string; address: string; city: string; state: string
  price?: number | null; image?: string | null; status?: string | null; listing_key?: string
  sold_date?: string | null; beds?: number | null; baths?: number | null; sqft?: number | null
}
export interface MarketingMoments {
  needs_spotlight: MarketingListing[]
  newest_listing: MarketingListing | null
  latest_sale: MarketingSale | null
  // Studio: recent listings + sales without a design yet (dismissed/made ones never return).
  studio_picks?: StudioPick[]
}


// ── Admin: agent activity tracker (backend admin_activity_service). Agents' own activity only.
export type AdminFeatureStatus = 'never' | 'regular' | 'once' | 'recent' | 'stopped'
export type AdminAgentHealth = 'power' | 'active' | 'slipping' | 'inactive' | 'never'
export interface AdminActivityOpenHouses { total: number; held: number; held_with_signins: number; signins: number }
export interface AdminActivityAgentRow {
  id: string; name: string; email: string; brokerage?: string | null
  plan_tier?: string | null; subscription_status?: string | null; joined_at?: string | null
  last_seen_at?: string | null; last_action_at?: string | null; active_days_30: number; health: AdminAgentHealth
  billing_group_id?: string | null; has_paypal_subscription?: boolean
  features_used_30: number; top_features: string[]; tried_once: string[]
  leads_30: number; leads_total: number; open_houses: AdminActivityOpenHouses; setup: string[]
}
export interface AdminActivityAdoption {
  key: string; label: string; group: string; kind: 'action' | 'result'
  agents_ever: number; agents_30: number; regular: number; once: number; stopped: number; uses_30: number
}
export interface AdminActivityOverview {
  generated_at: string
  totals: { agents: number; active_today: number; active_7: number; active_30: number; paying: number
    open_houses_held: number; open_houses_with_signins: number; signins: number; leads_30: number }
  groups: { key: string; label: string }[]
  adoption: AdminActivityAdoption[]
  agents: AdminActivityAgentRow[]
  setup_labels: Record<string, string>
}
export interface AdminActivityFeature {
  key: string; label: string; group: string; kind: 'action' | 'result'
  total: number; last_30: number; first_at?: string | null; last_at?: string | null; weeks_8: number; status: AdminFeatureStatus
}
export interface AdminActivityAgentDetail {
  agent: { id: string; name: string; email: string; brokerage?: string | null; plan_tier?: string | null; subscription_status?: string | null
    joined_at?: string | null; last_seen_at?: string | null; active_days_30: number; health: AdminAgentHealth }
  groups: { key: string; label: string }[]
  features: AdminActivityFeature[]
  open_houses: { id: string; address: string; city?: string | null; date?: string | null; held: boolean; signins: number; removed: boolean }[]
  weeks: { week_of: string; days_active: number; actions: number; results: number }[]
  timeline: { at: string; feature: string; group: string; kind: 'action' | 'result'; label: string }[]
  setup: string[]
  setup_labels: Record<string, string>
}

// ── Admin: brokerage groups (agents their brokerage pays for on a custom PayPal-invoiced deal).
export interface BillingGroupMember {
  id: string; name: string; email: string; brokerage?: string | null; plan_tier?: string | null; subscription_status?: string | null
  /** Still has their own PayPal subscription - may be paying twice. */
  has_paypal_subscription: boolean; last_seen_at?: string | null; joined_at?: string | null; broker_authorized: boolean
}
export interface BillingGroup {
  id: string; name: string; brokerage?: string | null; contact_name?: string | null; contact_email?: string | null; contact_phone?: string | null
  paypal_reference?: string | null; amount?: number | null; billing_cycle: 'monthly' | 'quarterly' | 'yearly'; seats?: number | null
  plan_tier?: string | null; status: 'active' | 'paused' | 'ended'; started_on?: string | null; next_invoice_on?: string | null
  notes?: string | null; created_at: string; per_agent?: number | null; members: BillingGroupMember[]
  /** Only after adding agents: who still had their own PayPal subscription (cancel it in PayPal). */
  had_paypal?: { id: string; name: string; subscription_id: string }[]
}
export type BillingGroupInput = Partial<Omit<BillingGroup, 'id' | 'created_at' | 'per_agent' | 'members'>>

// The Showcases page header's two inboxes (GET /collections/inbox).
export interface ShowcaseActivityItem {
  id: string;
  type: string;
  title: string;
  message: string;
  collection_id: string;
  showcase_name?: string | null;
  property_id?: string | null;
  property_address?: string | null;
  photo?: string | null;
  link?: string | null;
  is_read: boolean;
  created_at: string;
}

export interface ShowcaseInbox {
  tours: PropertyTour[];
  activity: ShowcaseActivityItem[];
  unread_activity: number;
}

/** Admin "Codes" - a reusable sign-up code (special PayPal plan, or billed by us). */
export interface PromoCode {
  id: string
  code: string
  label: string | null
  kind: 'paypal_plan' | 'billed_by_us'
  plan_tier: string
  plan_name: string
  paypal_plan_id: string | null
  trial_days: number
  custom_price: number | null
  billing_cycle: 'monthly' | 'quarterly' | 'yearly' | null
  billing_group_id: string | null
  billing_group_name: string | null
  max_uses: number | null
  uses: number
  expires_at: string | null
  is_active: boolean
  state: 'active' | 'off' | 'expired' | 'used_up'
  notes: string | null
  created_at: string
  agents: { id: string; name: string; email: string; plan_tier: string | null; subscription_status: string | null; joined_at: string; has_paypal_subscription: boolean }[]
}
export type PromoCodeInput = Partial<Pick<PromoCode, 'code' | 'label' | 'kind' | 'plan_tier' | 'paypal_plan_id' | 'custom_price' | 'billing_cycle' | 'billing_group_id' | 'max_uses' | 'expires_at' | 'is_active' | 'notes'>>
export interface PayPalPlanTerms { trial_days: number; price: number | null; interval: string | null; setup_fee: number; status: string | null; name: string | null }
/** What checkout gets back for a valid code. */
export interface CheckoutCode {
  valid: boolean
  code: string
  kind: 'paypal_plan' | 'billed_by_us' | 'bundle'
  plan_tier: string
  plan_name: string
  label?: string | null
  plan_id: string | null
  custom_price?: number | null
  billing_cycle?: string | null
  message?: string
}

// GET /admin/ai/failures - every feature failure we already record, newest first.
export interface AdminFailure {
  at: string | null;
  source: 'ai' | 'cma' | 'media' | 'email' | 'connection';
  feature: string;
  owner_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  code: string | null;
  message: string | null;
  kind: 'error' | 'limit';
  ref: string | null;
}

export interface AdminFailuresResponse {
  days: number;
  count: number;
  errors: number;
  by_feature: Record<string, number>;
  failures: AdminFailure[];
}
