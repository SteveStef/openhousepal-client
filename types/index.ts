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

  // Collection metadata
  added_at?: string;
  is_new?: boolean;
  liked?: boolean;
  disliked?: boolean;
  viewed?: boolean;
  viewCount?: number;
  lastViewedAt?: string;
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
  ModificationTimestamp?: string;
}

// New Open House Event interface matching backend schema
export interface OpenHouseEvent {
  id: string;
  open_house_event_id: string;
  FullStreetAddress: string;
  cover_image_url: string;
  qr_code_url: string;
  form_url: string;
  BedroomsTotal?: number;
  BathroomsTotal?: number;
  LivingArea?: number;
  ListPrice?: number;
  created_at: string;
}

// Legacy interface for backwards compatibility
export interface OpenHouse {
  id: number;
  property: Property;
  agentId: number;
  agentName: string;
  agentPhone?: string;
  agentEmail?: string;
  qrCode: string;
  dateTime: string;
  status: 'SCHEDULED' | 'ACTIVE' | 'COMPLETED';
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

export interface Collection {
  id: string; // Changed to string to match backend UUID
  customer: Customer;
  propertyId: number;
  originalProperty: Property;
  createdAt: string;
  updatedAt: string;
  status: 'ACTIVE' | 'INACTIVE';
  preferences?: CollectionPreferences | {
    priceRange: string;
    visitingReason?: string;
    hasAgent?: string;
    additionalComments?: string;
  };
  stats: {
    totalProperties: number;
    activeProperties: number;
    viewedProperties: number;
    likedProperties: number;
    lastActivity?: string;
  };
  shareToken?: string;
  sharedAt?: string;
  isPublic?: boolean;
}

export interface Agent {
  id: number;
  name: string;
  email: string;
  phone?: string;
  collections: Collection[];
}

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
  type: 'OPEN_HOUSE_SIGN_IN' | 'TOUR_REQUEST' | 'PROPERTY_INTERACTION';
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
  type: 'OPEN_HOUSE_SIGN_IN' | 'TOUR_REQUEST' | 'PROPERTY_INTERACTION';
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
