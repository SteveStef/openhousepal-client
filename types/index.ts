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
  Latitude?: number;
  Longitude?: number;
  
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
  liked?: boolean;
  disliked?: boolean;
  viewed?: boolean;
  viewCount?: number;
  lastViewedAt?: string;
  comments?: Comment[];
  visitorInteractions?: PropertyInteraction[];
  tourCount?: number;
  hasTourScheduled?: boolean;
  updated_at?: string;
  LotSizeAcres?: number;
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
}

export interface SearchPreferences {
  minPrice: number;
  maxPrice: number;
  minBeds: number;
  minBaths: number;
  radius: number;
}

export type OpenHouseWizardStep = 'ADDRESS' | 'FEATURES' | 'PREFERENCES' | 'SIMILAR_PROPS' | 'COVER_IMAGE' | 'CHEAT_SHEET_PHOTOS' | 'REVIEW';

export interface OpenHouse {
  id: string;
  openHouseEventId: string;
  agentId?: string;
  address: string;
  property_data?: any; // New field for full MLS data object
  createdAt: string;
  qrCodeUrl: string;
  coverImageUrl: string;
  formUrl: string;
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
  cheatSheetPhotos?: string[];
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
  broadcast_id?: string | null;
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
  lat?: number | null;
  long?: number | null;
  address?: string | null;
  city?: string | null; // Keep for backward compatibility
  cities?: string[]; // New field for multiple cities
  township?: string | null; // Keep for backward compatibility
  townships?: string[]; // New field for multiple townships
  school_districts?: string[]; // New field for school districts
  diameter?: number | null;
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
  customer: Customer;
  propertyId: number;
  originalProperty: Property;
  createdAt: string;
  updatedAt: string;
  status: 'ACTIVE' | 'INACTIVE';
  notifyVisitor: boolean;
  notifyAgent: boolean;
  isBlacklisted?: boolean;
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
    lastActivity?: string;
    lastAgentDismissedAt?: string;
  };
  shareToken?: string;
  sharedAt?: string;
  isPublic?: boolean;
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
  type: 'OPEN_HOUSE_SIGN_IN' | 'TOUR_REQUEST' | 'PROPERTY_INTERACTION' | 'FORM_SUBMISSION' | 'HOST_REQUEST_RECEIVED' | 'HOST_REQUEST_APPROVED' | 'HOST_REQUEST_DECLINED';
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
  type: 'OPEN_HOUSE_SIGN_IN' | 'TOUR_REQUEST' | 'PROPERTY_INTERACTION' | 'FORM_SUBMISSION' | 'HOST_REQUEST_RECEIVED' | 'HOST_REQUEST_APPROVED' | 'HOST_REQUEST_DECLINED';
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

export type FormQuestionType = 'short_text' | 'long_text' | 'email' | 'phone' | 'number' | 'select' | 'date' | 'time' | 'currency' | 'multi_select' | 'contact_group' | 'statement';

export interface FormQuestionDependsOn {
  question_id: string;
  values: string[];
}

export interface ContactGroupField {
  id: string;
  type: FormQuestionType;
  label: string;
  required: boolean;
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
}

export type AgentFormType = 'buying' | 'selling' | 'home_value' | 'showing' | 'seller_onboarding' | 'buyer_onboarding' | 'how_can_i_help' | 'showcase_request' | 'custom';

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
  brandingLayout: 'top' | 'bottom' | 'split' | 'split_reverse' | 'integrated';
  agentName: string;
  agentBrokerage: string;
  agentPhotoUrl?: string | null;
  agentTitle?: string | null;
  agentMarket?: string | null;
  linkedProperty?: LinkedProperty | null;
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
