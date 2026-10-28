import {
  LayoutDashboard,
  Wrench,
  Inbox,
  MessageSquare,
  CalendarClock,
  Star,
  ShieldCheck,
  Settings,
  Users,
  Network,
  BarChart3,
  MapPin,
  CreditCard,
  UserCog,
  History,
  type LucideIcon,
} from 'lucide-react';
import type { WorkspaceMemberRole, WorkspaceType } from './api';

export interface WorkspaceNavItem {
  label: string;
  href: (workspaceId: string) => string;
  icon: LucideIcon;
  roles?: WorkspaceMemberRole[];
}

// Shared building blocks (spec §6: "reusable dashboard components", "Do
// not create four copies of the entire application"). Most of these point
// at pages that already existed before the workspace project — this nav
// is what makes them reachable per type, not a rebuild of them.
const overview: WorkspaceNavItem = {
  label: 'Overview',
  href: (id) => `/dashboard/${id}`,
  icon: LayoutDashboard,
  roles: ['OWNER', 'MANAGER', 'MEMBER'],
};
const requests: WorkspaceNavItem = {
  label: 'Client Requests',
  href: () => '/provider/requests',
  icon: Inbox,
  roles: ['OWNER', 'MANAGER', 'MEMBER'],
};
const messages: WorkspaceNavItem = {
  label: 'Messages',
  href: () => '/messages',
  icon: MessageSquare,
  roles: ['OWNER', 'MANAGER', 'MEMBER'],
};
const bookings: WorkspaceNavItem = {
  label: 'Bookings',
  href: () => '/bookings',
  icon: CalendarClock,
  roles: ['OWNER', 'MANAGER', 'MEMBER'],
};
const availability: WorkspaceNavItem = {
  label: 'Availability',
  href: () => '/provider/availability',
  icon: CalendarClock,
  roles: ['OWNER', 'MANAGER'],
};
const reviews: WorkspaceNavItem = {
  label: 'Reviews',
  href: () => '/provider/reviews',
  icon: Star,
  roles: ['OWNER', 'MANAGER'],
};
// Previously this item was labelled "Profile & Verification" but pointed only
// at the verification page, which handles documents and badges — there was no
// profile editor anywhere for a provider past onboarding. Profile is now its
// own page; this item is just "Verification".
const profile: WorkspaceNavItem = {
  label: 'Profile',
  href: () => '/provider/profile',
  icon: UserCog,
  roles: ['OWNER', 'MANAGER'],
};
const verification: WorkspaceNavItem = {
  label: 'Verification',
  href: () => '/provider/verification',
  icon: ShieldCheck,
  roles: ['OWNER', 'MANAGER'],
};
const serviceAreas: WorkspaceNavItem = {
  label: 'Locations & Branches',
  href: () => '/provider/service-areas',
  icon: MapPin,
  roles: ['OWNER', 'MANAGER'],
};
const analytics: WorkspaceNavItem = {
  label: 'Analytics',
  href: () => '/provider/analytics',
  icon: BarChart3,
  roles: ['OWNER', 'MANAGER'],
};
const billing: WorkspaceNavItem = {
  label: 'Billing',
  href: (id) => `/dashboard/${id}/billing`,
  icon: CreditCard,
  roles: ['OWNER'],
};
const settings: WorkspaceNavItem = {
  label: 'Settings',
  href: () => '/settings/notifications',
  icon: Settings,
  roles: ['OWNER', 'MANAGER', 'MEMBER'],
};
const services = (label: string): WorkspaceNavItem => ({
  label,
  href: () => '/provider/offerings',
  icon: Wrench,
  roles: ['OWNER', 'MANAGER'],
});
// Login-access roster — who can open this workspace's dashboard, with a
// role (spec §3/§4: Team members / Business staff). Distinct from
// AGENCY's "Managed Providers" below, which is a marketplace-roster of
// OTHER provider businesses, not dashboard access — see managed-providers
// nav item's comment.
const members = (label: string): WorkspaceNavItem => ({
  label,
  href: (id) => `/dashboard/${id}/members`,
  icon: Users,
  roles: ['OWNER', 'MANAGER', 'MEMBER'],
});
// Reuses the pre-existing ProviderTeamMember roster (spec's "manage or
// invite multiple providers later"), already built for AGENCY on the
// backend — a roster of represented provider businesses, not people who
// can log into this dashboard.
const managedProviders: WorkspaceNavItem = {
  label: 'Managed Providers',
  href: (id) => `/dashboard/${id}/managed-providers`,
  icon: Network,
  roles: ['OWNER', 'MANAGER'],
};
const audit: WorkspaceNavItem = {
  label: 'Audit log',
  href: (id) => `/dashboard/${id}/audit`,
  icon: History,
  roles: ['OWNER', 'MANAGER'],
};

export const WORKSPACE_NAV: Record<WorkspaceType, WorkspaceNavItem[]> = {
  INDIVIDUAL: [
    overview,
    profile,
    services('My Services'),
    requests,
    messages,
    bookings,
    availability,
    reviews,
    verification,
    billing,
    audit,
    settings,
  ],
  TEAM: [
    overview,
    profile,
    services('Team Services'),
    requests,
    bookings,
    availability,
    members('Members'),
    messages,
    reviews,
    verification,
    billing,
    audit,
    settings,
  ],
  BUSINESS: [
    overview,
    profile,
    verification,
    services('Services & Catalog'),
    requests,
    bookings,
    members('Staff & Permissions'),
    messages,
    serviceAreas,
    analytics,
    billing,
    audit,
    settings,
  ],
  AGENCY: [
    overview,
    profile,
    managedProviders,
    members('Members'),
    requests,
    bookings,
    messages,
    availability,
    analytics,
    billing,
    audit,
    settings,
  ],
};

export const WORKSPACE_TYPE_LABEL: Record<WorkspaceType, string> = {
  INDIVIDUAL: 'Individual',
  TEAM: 'Team',
  BUSINESS: 'Business',
  AGENCY: 'Agency',
};
