import { apiRequest } from '@/src/services/api/client';

export type ParityProviderType = 'INDIVIDUAL' | 'TEAM' | 'BUSINESS' | 'AGENCY';

export interface ProviderInsightAction {
  action: string;
  label: string;
}

export interface ProviderOpportunity {
  serviceId: string;
  serviceName: string;
  categoryName: string;
  approximateInterestedUsers: number;
}

export interface ProviderChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

export interface ProviderInsights {
  recommendedActions: ProviderInsightAction[];
  opportunities: ProviderOpportunity[];
  profileStrength: {
    percent: number;
    checklist: ProviderChecklistItem[];
  };
}

export interface ServiceArea {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
}

export interface AddServiceAreaDto {
  label: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
}

export interface PortfolioImage {
  id: string;
  url: string;
  storageKey: string;
  mediaType: 'IMAGE' | 'VIDEO';
  beforeAfterRole: 'BEFORE' | 'AFTER' | null;
  beforeAfterGroup: string | null;
  position: number;
}

export interface PortfolioItem {
  id: string;
  title: string;
  description: string | null;
  projectDate: string | null;
  service: { id: string; name: string } | null;
  images: PortfolioImage[];
}

export interface CreatePortfolioDto {
  title: string;
  description?: string;
  serviceId?: string;
  projectDate?: string;
}

export interface AddPortfolioImageDto {
  url: string;
  storageKey: string;
  mediaType?: 'IMAGE' | 'VIDEO';
  beforeAfterRole?: 'BEFORE' | 'AFTER';
  beforeAfterGroup?: string;
}

export interface ExperienceItem {
  id: string;
  providerId: string;
  title: string;
  organization: string;
  location: string | null;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  description: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExperienceInput {
  title: string;
  organization: string;
  location?: string;
  startDate: string;
  endDate?: string | null;
  isCurrent?: boolean;
  description?: string;
  position?: number;
}

export interface EducationItem {
  id: string;
  providerId: string;
  school: string;
  degree: string | null;
  fieldOfStudy: string | null;
  skills: string[];
  startDate: string | null;
  endDate: string | null;
  description: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface EducationInput {
  school: string;
  degree?: string;
  fieldOfStudy?: string;
  skills?: string[];
  startDate?: string | null;
  endDate?: string | null;
  description?: string;
  position?: number;
}

export type ProviderApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ProviderApplication {
  id: string;
  userId: string;
  providerType: ParityProviderType;
  businessName: string;
  description: string | null;
  phone: string | null;
  yearsOfExperience: number | null;
  registrationNumber: string | null;
  idNumber: string | null;
  websiteUrl: string | null;
  status: ProviderApplicationStatus;
  decisionNote: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  categories?: Array<{ id: string; name: string; slug: string }>;
}

export interface SubmitProviderApplicationDto {
  providerType: ParityProviderType;
  businessName: string;
  description?: string;
  phone?: string;
  yearsOfExperience?: number;
  registrationNumber?: string;
  idNumber?: string;
  websiteUrl?: string;
  categories?: string[];
}

function segment(id: string): string {
  return encodeURIComponent(id);
}

export const parityProviderApi = {
  insights: () => apiRequest<ProviderInsights>('/personalization/provider-insights'),

  addServiceArea: (dto: AddServiceAreaDto) =>
    apiRequest<ServiceArea>('/providers/me/service-areas', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),
  deleteServiceArea: (id: string) =>
    apiRequest<{ success: boolean }>(`/providers/me/service-areas/${segment(id)}`, { method: 'DELETE' }),

  portfolios: () => apiRequest<PortfolioItem[]>('/providers/me/portfolios'),
  createPortfolio: (dto: CreatePortfolioDto) =>
    apiRequest<PortfolioItem>('/providers/me/portfolios', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),
  deletePortfolio: (id: string) =>
    apiRequest<{ success: boolean }>(`/providers/me/portfolios/${segment(id)}`, { method: 'DELETE' }),
  addPortfolioImage: (portfolioId: string, dto: AddPortfolioImageDto) =>
    apiRequest<PortfolioImage>(`/providers/me/portfolios/${segment(portfolioId)}/images`, {
      method: 'POST',
      body: JSON.stringify(dto),
    }),
  deletePortfolioImage: (imageId: string) =>
    apiRequest<{ success: boolean }>(`/providers/me/portfolios/images/${segment(imageId)}`, { method: 'DELETE' }),

  experiences: () => apiRequest<ExperienceItem[]>('/providers/me/experience'),
  createExperience: (dto: ExperienceInput) =>
    apiRequest<ExperienceItem>('/providers/me/experience', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),
  updateExperience: (id: string, dto: Partial<ExperienceInput>) =>
    apiRequest<ExperienceItem>(`/providers/me/experience/${segment(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),
  deleteExperience: (id: string) =>
    apiRequest<{ success: boolean }>(`/providers/me/experience/${segment(id)}`, { method: 'DELETE' }),

  educations: () => apiRequest<EducationItem[]>('/providers/me/education'),
  createEducation: (dto: EducationInput) =>
    apiRequest<EducationItem>('/providers/me/education', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),
  updateEducation: (id: string, dto: Partial<EducationInput>) =>
    apiRequest<EducationItem>(`/providers/me/education/${segment(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),
  deleteEducation: (id: string) =>
    apiRequest<{ success: boolean }>(`/providers/me/education/${segment(id)}`, { method: 'DELETE' }),

  myApplications: () => apiRequest<ProviderApplication[]>('/provider-applications/mine'),
  submitApplication: (dto: SubmitProviderApplicationDto) =>
    apiRequest<ProviderApplication>('/provider-applications', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),
};
