// Pure scoring primitives for the public-request → provider fan-out.
//
// The goal is not "who offers the exact service id" but "who could
// plausibly do this job": a client asking for "emergency pipe repair" should
// reach the plumber who offers "Plumbing Repairs", the nearby handyman whose
// category sits next to plumbing, and the provider whose listing text is
// semantically close — while a completely unrelated provider is never
// notified just because they happen to be online.
//
// Everything here is deliberately deterministic and side-effect free so the
// ranking can be unit-tested without a database, an embeddings vendor, or a
// queue. ProviderMatchingService is the impure half: it loads candidates,
// embeds the request, then calls scoreProviderMatch() for each pair.

export type ProviderMatchType =
  | 'EXACT_SERVICE'
  | 'SAME_CATEGORY'
  | 'RELATED_CATEGORY'
  | 'SEMANTIC'
  | 'KEYWORD';

export interface MatchableProvider {
  id: string;
  userId: string;
  businessName: string;
  rating: number;
  reviewCount: number;
  verificationStatus: string;
  businessVerified: boolean;
  availabilityStatus: string;
  subscriptionStatus: string;
  yearsOfExperience: number;
  responseRate: number;
  responseTimeMinutes: number | null;
  serviceRadiusKm: number;
  location: { latitude: number; longitude: number } | null;
  serviceAreas: Array<{ latitude: number; longitude: number; radiusKm: number }>;
}

export interface MatchableOffering {
  id: string;
  serviceId: string;
  title: string | null;
  description: string | null;
  basePrice: number | null;
  serviceName: string;
  serviceDescription: string | null;
  categoryId: string;
  categoryName: string;
}

export interface MatchRequestContext {
  serviceId: string;
  text: string;
  tokens: Set<string>;
  // Category id -> graph distance from the requested service's category.
  // 0 = same category, 1 = parent/child, 2 = sibling/grandchild, ...
  categoryDistances: Map<string, number>;
  semanticSimilarity: number | null;
  location: { latitude: number; longitude: number } | null;
  budgetMin: number | null;
  budgetMax: number | null;
}

export interface MatchScoreComponents {
  relevance: number;
  semantic: number;
  keyword: number;
  location: number;
  quality: number;
  budget: number;
  responsiveness: number;
}

export interface MatchScoreResult {
  score: number;
  matchType: ProviderMatchType;
  reasons: string[];
  components: MatchScoreComponents;
  distanceKm: number | null;
  servesArea: boolean | null;
}

// Weighted to 100 points. Relevance is the dominant signal, but a perfect
// category match in another city shouldn't outrank a nearby provider with a
// semantically equivalent offering, hence the semantic/geo weights.
const WEIGHTS = {
  relevance: 35,
  semantic: 20,
  keyword: 10,
  location: 15,
  quality: 10,
  budget: 5,
  responsiveness: 5,
} as const;

const SAME_CATEGORY_FACTOR = 0.9;
const CATEGORY_DISTANCE_DECAY = 0.5;
const MAX_RELATED_CATEGORY_DISTANCE = 2;

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'these', 'those',
  'are', 'was', 'were', 'will', 'would', 'can', 'could', 'should', 'may',
  'you', 'your', 'our', 'their', 'his', 'her', 'its', 'them', 'they',
  'have', 'has', 'had', 'not', 'but', 'all', 'any', 'some', 'out', 'get',
  'need', 'needs', 'needed', 'want', 'wants', 'looking', 'searching',
  'service', 'services', 'provider', 'providers', 'work', 'job', 'help',
  'please', 'near', 'around', 'within', 'day', 'days', 'time', 'also',
  'very', 'just', 'like', 'into', 'about', 'over', 'under', 'more', 'most',
]);

export function tokenize(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
  return new Set(tokens);
}

// Cosine-like overlap, normalised by the geometric mean of the two token
// counts so a very long listing description cannot win just by containing
// many words. Returns the matched tokens too, because "why was I notified?"
// is much more useful than a bare number.
export function keywordSimilarity(
  requestTokens: Set<string>,
  offeringText: string,
): { score: number; matched: string[] } {
  if (requestTokens.size === 0) return { score: 0, matched: [] };
  const offeringTokens = tokenize(offeringText);
  if (offeringTokens.size === 0) return { score: 0, matched: [] };

  const matched: string[] = [];
  for (const token of requestTokens) {
    if (offeringTokens.has(token)) matched.push(token);
  }
  const score = matched.length / Math.sqrt(requestTokens.size * offeringTokens.size);
  return { score: Math.min(1, score), matched: matched.slice(0, 5) };
}

// Great-circle distance in km. Providers whose exact coordinates are missing
// simply score neutrally rather than being excluded — a missing location is
// incomplete data, not evidence of a bad match.
export function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Undirected BFS over the category tree. Parents, children and siblings all
// become reachable, so "Electrician" is related to "Plumber" when both sit
// under "Home Repair" — exactly the kind of adjacent trade a client's
// wording often drifts into.
export function buildCategoryDistances(
  targetCategoryId: string,
  categories: Array<{ id: string; parentId: string | null }>,
): Map<string, number> {
  const adjacency = new Map<string, Set<string>>();
  for (const category of categories) {
    if (!adjacency.has(category.id)) adjacency.set(category.id, new Set());
    if (category.parentId) {
      if (!adjacency.has(category.parentId)) adjacency.set(category.parentId, new Set());
      adjacency.get(category.id)!.add(category.parentId);
      adjacency.get(category.parentId)!.add(category.id);
    }
  }

  const distances = new Map<string, number>();
  const queue: Array<{ id: string; distance: number }> = [];
  if (adjacency.has(targetCategoryId)) {
    distances.set(targetCategoryId, 0);
    queue.push({ id: targetCategoryId, distance: 0 });
  }

  for (let i = 0; i < queue.length; i++) {
    const { id, distance } = queue[i];
    for (const neighbour of adjacency.get(id) ?? []) {
      if (distances.has(neighbour)) continue;
      distances.set(neighbour, distance + 1);
      queue.push({ id: neighbour, distance: distance + 1 });
    }
  }
  return distances;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function locationScore(
  provider: MatchableProvider,
  requestLocation: MatchRequestContext['location'],
): { points: number; distanceKm: number | null; servesArea: boolean | null } {
  if (!requestLocation) {
    return { points: WEIGHTS.location / 2, distanceKm: null, servesArea: null };
  }

  const homeDistanceKm = provider.location ? haversineKm(requestLocation, provider.location) : null;
  const servesArea = provider.serviceAreas.some(
    (area) => haversineKm(requestLocation, area) <= area.radiusKm,
  );

  if (servesArea) {
    return { points: WEIGHTS.location, distanceKm: homeDistanceKm, servesArea: true };
  }

  if (homeDistanceKm != null) {
    const effectiveRadiusKm = Math.max(provider.serviceRadiusKm || 0, 10);
    const proximity = clamp(1 - homeDistanceKm / (effectiveRadiusKm * 2), 0, 1);
    return { points: WEIGHTS.location * proximity, distanceKm: homeDistanceKm, servesArea: false };
  }

  return { points: 0, distanceKm: null, servesArea: false };
}

function budgetScore(offeringPrice: number | null, request: MatchRequestContext): number {
  if (request.budgetMin == null && request.budgetMax == null) return WEIGHTS.budget / 2;
  if (offeringPrice == null) return WEIGHTS.budget / 2;

  const min = request.budgetMin ?? 0;
  const max = request.budgetMax ?? Infinity;

  if (offeringPrice >= min && offeringPrice <= max) return WEIGHTS.budget;
  if (offeringPrice < min) return WEIGHTS.budget * 0.8;
  if (request.budgetMax != null && offeringPrice <= request.budgetMax * 1.2) {
    return WEIGHTS.budget * 0.4;
  }
  return 0;
}

function responsivenessScore(provider: MatchableProvider): number {
  const rate = clamp(provider.responseRate ?? 0, 0, 100);
  let points = (rate / 100) * 3;

  const minutes = provider.responseTimeMinutes;
  if (minutes == null) points += 1;
  else if (minutes <= 60) points += 2;
  else if (minutes <= 240) points += 1.5;
  else if (minutes <= 1440) points += 1;
  else points += 0.25;

  return clamp(points, 0, WEIGHTS.responsiveness);
}

export function scoreProviderMatch(
  provider: MatchableProvider,
  offering: MatchableOffering,
  request: MatchRequestContext,
): MatchScoreResult {
  const categoryDistance = request.categoryDistances.get(offering.categoryId);
  const serviceExact = offering.serviceId === request.serviceId;
  const sameCategory = !serviceExact && categoryDistance === 0;
  const relatedCategory =
    !serviceExact &&
    !sameCategory &&
    categoryDistance != null &&
    categoryDistance <= MAX_RELATED_CATEGORY_DISTANCE;

  // Same service = full relevance. Anything else decays smoothly with
  // category-tree distance (same category is still a very strong signal).
  let relevance = 0;
  if (serviceExact) {
    relevance = WEIGHTS.relevance;
  } else if (categoryDistance != null && categoryDistance <= MAX_RELATED_CATEGORY_DISTANCE) {
    relevance =
      WEIGHTS.relevance *
      SAME_CATEGORY_FACTOR *
      (1 / (1 + categoryDistance * CATEGORY_DISTANCE_DECAY));
  }

  const semantic = request.semanticSimilarity != null
    ? WEIGHTS.semantic * clamp(request.semanticSimilarity, 0, 1)
    : 0;

  const keyword = keywordSimilarity(
    request.tokens,
    [
      offering.categoryName,
      offering.serviceName,
      offering.serviceDescription,
      offering.title,
      offering.description,
    ]
      .filter((part): part is string => !!part && part.trim().length > 0)
      .join(' '),
  );

  const geo = locationScore(provider, request.location);

  const ratingPoints = (clamp(provider.rating, 0, 5) / 5) * 5;
  const verificationPoints = provider.verificationStatus === 'VERIFIED' ? 2 : 0;
  const businessPoints = provider.businessVerified ? 1 : 0;
  const availabilityPoints =
    provider.availabilityStatus === 'AVAILABLE' ? 1.5 : provider.availabilityStatus === 'BUSY' ? 0.5 : 0;
  const subscriptionPoints =
    provider.subscriptionStatus === 'ACTIVE' || provider.subscriptionStatus === 'TRIALING' ? 0.5 : 0;
  const quality = clamp(
    ratingPoints + verificationPoints + businessPoints + availabilityPoints + subscriptionPoints,
    0,
    WEIGHTS.quality,
  );

  const budget = budgetScore(offering.basePrice, request);
  const responsiveness = responsivenessScore(provider);

  const components: MatchScoreComponents = {
    relevance,
    semantic,
    keyword: WEIGHTS.keyword * keyword.score,
    location: geo.points,
    quality,
    budget,
    responsiveness,
  };
  const score = Object.values(components).reduce((sum, value) => sum + value, 0);

  const reasons: string[] = [];
  if (serviceExact) {
    reasons.push(`Offers ${offering.serviceName}`);
  } else if (sameCategory) {
    reasons.push(`Offers ${offering.serviceName} in ${offering.categoryName}`);
  } else if (relatedCategory) {
    reasons.push(`Related service: ${offering.serviceName} (${offering.categoryName})`);
  }
  if (request.semanticSimilarity != null && request.semanticSimilarity >= 0.55) {
    reasons.push('Description closely matches the request');
  }
  if (keyword.matched.length > 0) {
    reasons.push(`Keywords: ${keyword.matched.slice(0, 3).join(', ')}`);
  }
  if (geo.servesArea) reasons.push('Covers the requested area');
  else if (geo.distanceKm != null && geo.distanceKm <= Math.max(provider.serviceRadiusKm, 10)) {
    reasons.push(`${geo.distanceKm.toFixed(1)} km away`);
  }
  if (budget >= WEIGHTS.budget * 0.8) reasons.push('Fits the budget');
  if (provider.verificationStatus === 'VERIFIED') reasons.push('Verified provider');
  if (provider.availabilityStatus === 'AVAILABLE') reasons.push('Available now');
  if (provider.rating >= 4 && provider.reviewCount > 0) {
    reasons.push(`Rated ${provider.rating.toFixed(1)}/5`);
  }

  let matchType: ProviderMatchType;
  if (serviceExact) matchType = 'EXACT_SERVICE';
  else if (sameCategory) matchType = 'SAME_CATEGORY';
  else if (relatedCategory) matchType = 'RELATED_CATEGORY';
  else if (request.semanticSimilarity != null && request.semanticSimilarity >= 0.5) {
    matchType = 'SEMANTIC';
  } else matchType = 'KEYWORD';

  return {
    score: Math.round(score * 100) / 100,
    matchType,
    reasons,
    components,
    distanceKm: geo.distanceKm != null ? Math.round(geo.distanceKm * 10) / 10 : null,
    servesArea: geo.servesArea,
  };
}
