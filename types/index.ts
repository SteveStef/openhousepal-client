export interface Comment {
  id: number;
  author: string;
  content: string;
  createdAt: string;
  avatar?: string;
}

export interface Property {
  id?: number;
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
  images?: string[];
  liked?: boolean;
  disliked?: boolean;
  favorited?: boolean;
  viewed?: boolean;
  comments?: Comment[];
  // Additional MLS fields
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
  visitingReason: string;
  timeframe: string;
  priceRange: string;
  interestedInSimilar: boolean;
  additionalComments: string;
  fullName: string;
  hasAgent: string;
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
  diameter?: number;
  special_features?: string;
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
  matchedProperties: Property[];
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