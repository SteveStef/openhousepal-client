export interface Comment {
  id: number | string;
  author: string;
  content: string;
  createdAt: string;
  avatar?: string;
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
  agentPhotoUrl?: string | null;
  
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
  AddedToCollectionAt?: string | null;
  liked?: boolean;
  disliked?: boolean;
  viewed?: boolean;
  viewCount?: number;
  lastViewedAt?: string;
  comments?: Comment[];
  unreadCommentCount?: number;
  visitorInteractions?: PropertyInteraction[];
  tourCount?: number;
  hasTourScheduled?: boolean;
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
  bedrooms?: number;
  bathrooms?: number;
  livingArea?: number;
  price?: number;
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

export interface MyListingSummary {
  open_scheduled: number;
  needs_host: number;
  avg_guests_per_open: number;
  high_priority: number;
}

export interface MyListingItem {
  listing_key: string;
  image?: string | null;
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
  open_house_status: OpenHouseStatus;
  avg_guests_per_open: number;
  opens_hosted_count: number;
  scheduled_opens_count: number;
  scheduled_opens: ScheduledOpen[];
  confirmed_pending_kit: ScheduledOpen[];
  is_high_priority: boolean;
  pending_request_count: number;
  is_manual: boolean;
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
  counter_date_2?: string | null;
  counter_start_time_2?: string | null;
  counter_end_time_2?: string | null;
  broadcast_id?: string | null;
  listing_host_notes?: string | null;
}

export interface CreateHostRequestPayload {
  listing_key: string;
  requested_date: string;
  requested_start_time: string;
  requested_end_time: string;
  message?: string;
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
  counter_date_2?: string;
  counter_start_time_2?: string;
  counter_end_time_2?: string;
}

export interface AgentSearchResult {
  id: string;
  name: string;
  brokerage?: string | null;
  mls_id?: string | null;
  email: string;
}

export interface TeamMember {
  id: string;
  agent_id: string;
  name: string;
  brokerage?: string | null;
  mls_id?: string | null;
  added_at: string;
}

export interface Broadcast {
  id: string;
  listing_key: string;
  property_address?: string | null;
  property_image?: string | null;
  requested_date: string;
  requested_start_time: string;
  requested_end_time: string;
  message?: string | null;
  status: BroadcastStatus;
  created_at: string;
  interested_requests: HostRequest[];
}

export interface IncomingBroadcast {
  id: string;
  listing_key: string;
  property_address?: string | null;
  property_image?: string | null;
  owner_agent_name: string;
  owner_agent_brokerage?: string | null;
  requested_date: string;
  requested_start_time: string;
  requested_end_time: string;
  message?: string | null;
  status: BroadcastStatus;
  created_at: string;
  my_response_status?: HostRequestStatus | null;
}

export interface CreateBroadcastPayload {
  listing_key: string;
  requested_date: string;
  requested_start_time: string;
  requested_end_time: string;
  message?: string;
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
  created_at?: string;
  updated_at?: string;
}

export interface TourRequest {
  propertyId: string | number
  propertyAddress: string
  visitorName?: string
  visitorContact?: string
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
  };
  shareToken?: string;
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
  mls_id?: string;
  photo_url?: string | null;
  professional_title?: string | null;
  market?: string | null;
  created_at: string;
  updated_at?: string;
  // PayPal subscription fields
  subscription_id?: string;
  subscription_status?: string;  // TRIAL, ACTIVE, SUSPENDED, CANCELLED, EXPIRED
  broker_authorized?: boolean;
  plan_id?: string;
  plan_tier?: string;  // BASIC or PREMIUM
  trial_ends_at?: string;
  next_billing_date?: string;  // Grace period end for cancelled subscriptions
  subscription_started_at?: string;
  last_billing_date?: string;
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

// Frontend notification interface (camelCase for use in components)
export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  visitorName: string;
  propertyAddress: string;
  collectionId: string;
  collectionName?: string;
  propertyId?: string;
  link?: string;
  isRead: boolean;
  readAt?: string;
  timestamp: string; // Maps to created_at
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
  redirect_to_agent_hub: boolean;
  property_photo_carousel: boolean;
  background_effects: boolean;
  welcome_text_effects: boolean;
  branding_layout: 'top' | 'bottom' | 'split' | 'split_reverse' | 'integrated';
  is_enabled: boolean;
  order_index: number;
  linked_property?: LinkedProperty | null;
  created_at: string;
  updated_at?: string | null;
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
  redirectToAgentHub: boolean;
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
  created_at: string;
}

export interface FormStats {
  totalViews: number;
  totalStarts: number;
  totalCompletions: number;
  completionRate: number;
  dailyViews: { date: string; count: number }[];
  dailyCompletions: { date: string; count: number }[];
  questionDropOff: { questionId: string; label: string; reachedCount: number; reachedPercent: number }[];
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

export interface DesignFormatDef {
  designType: string;
  label: string;
  category: 'Property Marketing' | 'Social Media' | 'Print';
  description: string;
  aspectRatio: number; // width / height
  orientation: 'portrait' | 'landscape' | 'square';
  defaultTemplateId: string;
  layout: 'poster' | 'grid'; // poster = full-bleed photo w/ text overlay; grid = photo collage + text body below
}

// One of exactly 4 visual template styles - a real distinct system (body treatment, badge shape,
// dividers, type transform), not a color swap. See lib/studio/designFormats.ts for the token values.
export type DesignTemplateStyleId = 'editorial' | 'modern_luxury' | 'minimal' | 'bold';

export interface DesignTemplateStyleTokens {
  bodyTreatment: 'light' | 'dark' | 'colorblock';
  badgeShape: 'pill' | 'sharp' | 'scrim';
  dividerStyle: 'hairline' | 'accent-rule' | 'thick-border';
  labelTransform: 'none' | 'uppercase-tracked';
  priceEmphasis: 'accent' | 'serif-large';
}

export interface DesignTemplateStyle {
  id: DesignTemplateStyleId;
  label: string;
  description: string;
  tokens: DesignTemplateStyleTokens;
}

export interface DesignProject {
  id: string;
  design_type: string;
  template_id: string;
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
  template_id: string;
  name: string;
  linked_property?: LinkedProperty | null;
  blocks?: DesignBlock[];
  branding_mode?: BrandingMode;
  campaign_id?: string | null;
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
  | 'newly_listed';

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
  secondary_color: string;
  heading_font: string;
  body_font: string;
  logo_url?: string | null;
  follow_brand_kit?: boolean;
}

export interface FeaturedSettings {
  mode: 'my_listings' | 'filtered';
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

export interface SiteContent {
  pages: SitePage[];
  theme: SiteTheme;
  featured_settings: FeaturedSettings;
  media_settings: MediaSettings;
}

export interface Site {
  id: string;
  subdomain_slug: string;
  status: SiteStatus;
  draft_data: SiteContent;
  published_snapshot: SiteContent;
  published_at?: string | null;
  created_at: string;
  updated_at?: string | null;
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

// ---- Blogs ----

export type BlogStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'UNPUBLISHED' | 'ARCHIVED';
export type BlogBlockType =
  | 'heading' | 'subheading' | 'paragraph' | 'quote' | 'bulleted_list' | 'numbered_list'
  | 'divider' | 'callout' | 'button' | 'image' | 'gallery' | 'video' | 'youtube' | 'map'
  | 'property_card' | 'agent_profile' | 'contact_form' | 'qr_code' | 'cta' | 'related_articles' | 'disclaimer';

export interface BlogBlock {
  id: string;
  type: BlogBlockType;
  data: Record<string, any>;
}

export interface Blog {
  id: string;
  slug: string;
  status: BlogStatus;
  title: string;
  subtitle?: string | null;
  cover_image_url?: string | null;
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
  scheduled_at?: string | null;
  published_at?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface BlogListItem {
  id: string;
  slug: string;
  status: BlogStatus;
  title: string;
  subtitle?: string | null;
  cover_image_url?: string | null;
  category?: string | null;
  agent_hub_visible: boolean;
  agent_hub_featured: boolean;
  scheduled_at?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
  created_at: string;
  view_count: number;
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
  agentTitle?: string | null;
  agentMarket?: string | null;
}

export type LeadStatus = 'new' | 'contacted' | 'in_talks' | 'signed' | 'hidden' | 'qualified' | 'converted' | 'archived';
export type LeadRepresented = 'yes' | 'no' | 'unknown';
export type LeadSourceType = 'open_house_visitor' | 'form_submission' | 'property_tour' | 'property_comment' | 'collection_visitor' | 'open_house_second_visit' | 'open_house_disclosure';
export type LeadSourceFilter = 'all' | 'open_house' | 'form' | 'showcase' | 'website' | 'tour';
export type LeadSort = 'unrepresented_first' | 'newest' | 'oldest' | 'name';

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
  has_tour_request?: boolean;
  has_commented?: boolean;
  has_liked_property?: boolean;
  has_disliked_property?: boolean;
  needs_attention?: boolean;
  // The showcase this lead's pending attention item lives in, if any - see getLeadAttentionLink.
  attention_collection_id?: string | null;
  created_at: string;
  last_contacted_at?: string | null;
  hidden_at?: string | null;
}

export interface LeadDetail extends Lead {
  events: LeadEvent[];
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
export type CmaCompStrength = 'primary' | 'strong' | 'supporting' | 'weak';
export type CmaQualityRating = 'significantly_below' | 'below' | 'similar' | 'above' | 'significantly_above';
export type CmaSimpleRating = 'below' | 'similar' | 'above';
export type CmaLocationRating = 'inferior' | 'similar' | 'superior';

export interface CmaSubjectProperty {
  listing_key?: string | null;
  source: CmaCompSource;
  photo_url?: string | null;
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
  lot_size?: number | null;
  year_built?: number | null;
  property_type?: string | null;
  garage?: string | null;
  basement?: string | null;
  days_on_market?: number | null;
  mls_status?: string | null;
  last_sale_date?: string | null;
  last_sale_price?: number | null;
  school_district?: string | null;
  annual_taxes?: number | null;
  agent_notes?: string | null;
}

export interface CmaQualityAssessment {
  finish_quality?: CmaQualityRating | null;
  interior?: CmaSimpleRating | null;
  exterior?: CmaSimpleRating | null;
  lot?: CmaSimpleRating | null;
  amenities?: CmaSimpleRating | null;
  layout?: CmaSimpleRating | null;
  location?: CmaLocationRating | null;
}

export interface CmaComparable {
  id: string;
  listing_key?: string | null;
  source: CmaCompSource;
  is_included: boolean;
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

  sale_price?: number | null;
  list_price?: number | null;
  sale_date?: string | null;
  days_on_market?: number | null;

  sqft?: number | null;
  lot_size?: number | null;
  beds?: number | null;
  baths?: number | null;
  year_built?: number | null;
  garage?: string | null;
  basement?: string | null;
  price_per_sqft?: number | null;
  annual_taxes?: number | null;
  match_score?: number | null;

  quality: CmaQualityAssessment;
  strength?: CmaCompStrength | null;
  commentary?: string | null;
  // AI-drafted note for this comp - separate from `commentary` above, never auto-applied. The
  // frontend offers a "Use this" button to copy it in, still editable after.
  ai_commentary?: string | null;
}

export interface CmaAiEstimate {
  value: number;
  range_min: number;
  range_max: number;
  confidence: 'low' | 'medium' | 'high';
  methodology_summary: string;
  model?: string;
  generated_at?: string;
}

export interface CmaPricing {
  comparable_suggested_min?: number | null;
  comparable_suggested_max?: number | null;
  recommended_min?: number | null;
  recommended_max?: number | null;
  most_likely_value?: number | null;
  recommended_list_price?: number | null;
  pricing_commentary?: string | null;
  estimated_fair_value?: number | null;
  suggested_offer_min?: number | null;
  suggested_offer_max?: number | null;
  strong_offer?: number | null;
  max_recommended_price?: number | null;
  offer_strategy_commentary?: string | null;
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
}

export interface CmaPresentationSettings {
  hidden_sections: string[];
  hidden_comp_ids: string[];
  cover_photo_url?: string | null;
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
  created_at: string;
  updated_at?: string | null;
}

export interface CmaReportListItem {
  id: string;
  client_name?: string | null;
  mode: CmaMode;
  status: CmaStatus;
  subject_address?: string | null;
  subject_photo_url?: string | null;
  comparable_count: number;
  value_range_min?: number | null;
  value_range_max?: number | null;
  updated_at?: string | null;
  created_at: string;
}

export interface CmaCompSearchParams {
  listing_key?: string | null;
  latitude?: number | null;
  longitude?: number | null;
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
  sale_price?: number | null;
  list_price?: number | null;
  sale_date?: string | null;
  days_on_market?: number | null;
  sqft?: number | null;
  lot_size?: number | null;
  beds?: number | null;
  baths?: number | null;
  year_built?: number | null;
  garage?: string | null;
  basement?: string | null;
  price_per_sqft?: number | null;
  school_district?: string | null;
  public_remarks?: string | null;
  annual_taxes?: number | null;
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

export interface AIAdminOverview {
  total_cost_month_usd: number;
  total_cost_all_time_usd: number;
  messages_month: number;
  active_agents_30d: number;
  blocked_count_month: number;
  top_block_reasons: { reason: string; count: number }[];
  daily_trend_30d: AIAdminDailyPoint[];
  cost_by_type_month: Record<string, number>;
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
}

export interface AIAdminAgentDetail extends AIAdminAgentSummary {
  daily_trend: AIAdminDailyPoint[];
  tool_usage: Record<string, number>;
  cost_by_type: Record<string, number>;
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
