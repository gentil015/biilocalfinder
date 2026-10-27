import { SearchProvidersDto } from './dto/search-providers.dto';

export interface ProviderSearchResultItem {
  id: string;
  businessName: string;
  avatarUrl: string | null;
  description?: string | null;
  bio?: string | null;
  rating: number;
  reviewCount: number;
  verifiedReviewCount: number;
  verificationStatus: string;
  businessVerified: boolean;
  availabilityStatus: string;
  yearsOfExperience: number;
  responseTimeMinutes: number | null;
  distanceKm: number | null;
  // Only meaningful when the search included lat/lng: true when the query
  // point falls inside one of this provider's drawn coverage circles
  // (spec §12 "Serves your area"), not just "somewhat nearby". Null when
  // the search wasn't geo-scoped at all.
  servesArea: boolean | null;
  startingPrice: number | null;
  currency: string;
  latitude: number | null;
  longitude: number | null;
  score: number;
}

export interface ProviderSearchResult {
  items: ProviderSearchResultItem[];
  total: number;
  page: number;
  limit: number;
}

// The controller depends on this interface only. `PostgresProviderSearchService`
// is the MVP implementation (Postgres full-text + PostGIS radius search);
// `OpenSearchProviderSearchService` can implement the same interface later
// (spec §51) without the controller or frontend changing at all.
export interface ProviderSearchService {
  search(params: SearchProvidersDto): Promise<ProviderSearchResult>;
}

export const PROVIDER_SEARCH_SERVICE = 'PROVIDER_SEARCH_SERVICE';
