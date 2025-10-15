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
  favorited: boolean;
  created_at: string;
  updated_at: string;
}

export interface Property {
  id?: number | string;
  mlsId?: string;
  address: string;
  city?: string;
  state?: string;
  zipCode?: string;
  price?: number;
  beds?: number;
  baths?: number;
  squareFeet?: number;
  lotSize?: number;
  propertyType?: string;
  description?: string;
  imageUrl?: string;
  imageSrc?: string; // Added for open house event metadata
  images?: string[];
  liked?: boolean;
  disliked?: boolean;
  favorited?: boolean;
  viewed?: boolean;
  comments?: Comment[];
  tourCount?: number;
  hasTourScheduled?: boolean;
  details?: JSON;
  visitorInteractions?: PropertyInteraction[];
  listingUpdated?: string;
  status?: string;
  mlsNumber?: string;
  daysOnMarket?: number;
  taxes?: number;
  hoaFees?: number | null;
  condoCoopFees?: number | null;
  compassType?: string;
  mlsType?: string;
  yearBuilt?: number;
  lotSizeAcres?: number;
  lotSizeSquareFeet?: number;
  county?: string;
}

// New Open House Event interface matching backend schema
export interface OpenHouseEvent {
  id: string;
  open_house_event_id: string;
  address: string;
  cover_image_url: string;
  qr_code_url: string;
  form_url: string;
  bedrooms?: number;
  bathrooms?: number;
  living_area?: number;
  price?: number;
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
  timeframe?: string;
  priceRange?: string;
  additionalComments?: string;
}

export interface SignInFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  preferredContact: 'EMAIL' | 'PHONE' | 'TEXT';
  timeframe: string;
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
  lat?: number | null;
  long?: number | null;
  address?: string | null;
  city?: string | null; // Keep for backward compatibility
  cities?: string[]; // New field for multiple cities
  township?: string | null; // Keep for backward compatibility
  townships?: string[]; // New field for multiple townships
  diameter?: number | null;
  special_features?: string;
  is_town_house?: boolean | null;
  is_lot_land?: boolean | null;
  is_condo?: boolean | null;
  is_multi_family?: boolean | null;
  is_single_family?: boolean | null;
  is_apartment?: boolean | null;
  timeframe?: string | null;
  visiting_reason?: string | null;
  has_agent?: string | null;
  created_at?: string;
  updated_at?: string;
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
    timeframe: string;
    visitingReason?: string;
    hasAgent?: string;
    additionalComments?: string;
  };
  stats: {
    totalProperties: number;
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
