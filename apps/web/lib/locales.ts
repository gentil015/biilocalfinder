/**
 * The languages the product offers, and the translation catalog behind them.
 *
 * Scope note: this is deliberately the smallest thing that actually does
 * something. Only the settings surfaces are translated (see `MESSAGES`); the
 * rest of the app still renders its hardcoded English copy. The catalog and
 * the `useI18n` hook in components/locale-provider.tsx are shaped so that
 * adding the next screen is a matter of adding keys — but do not read the
 * untranslated pages as a bug.
 *
 * The API keeps its own copy of the tag list in apps/api/src/common/locales.ts.
 * The repo has no workspace wiring, so `packages/types` cannot be imported from
 * either app; the two lists are kept in sync by hand.
 */

export const LOCALES = [
  {
    code: 'en',
    // The label a reader sees in the selector. Both entries show an endonym —
    // the language's name in itself — which is what language pickers
    // conventionally do, rather than guessing a country flag.
    nativeName: 'English',
    englishName: 'English',
    // Kinyarwanda is written in the Latin alphabet, so nothing here needs
    // right-to-left handling or a special font stack. `dir` is carried anyway
    // so adding a right-to-left language later doesn't mean re-plumbing the
    // root layout.
    dir: 'ltr',
  },
  {
    code: 'rw',
    nativeName: 'Ikinyarwanda',
    englishName: 'Kinyarwanda',
    dir: 'ltr',
  },
] as const;

export type LocaleCode = (typeof LOCALES)[number]['code'];

export const DEFAULT_LOCALE: LocaleCode = 'en';

export function isLocaleCode(value: unknown): value is LocaleCode {
  return typeof value === 'string' && LOCALES.some((l) => l.code === value);
}

/**
 * Coerces anything — a stale localStorage value, a locale the API has since
 * dropped, `undefined` for a signed-out visitor — to a tag we can actually
 * render. Always returns a supported locale rather than trusting the input.
 */
export function resolveLocale(value: unknown): LocaleCode {
  return isLocaleCode(value) ? value : DEFAULT_LOCALE;
}

export function localeMeta(code: string) {
  return LOCALES.find((l) => l.code === code) ?? LOCALES[0];
}

/**
 * English is the reference catalog. Every other locale is type-checked against
 * it, so a missing or misspelled key is a build error rather than an English
 * string leaking into a Kinyarwanda screen at runtime.
 */
const EN = {
  'common.settings': 'Settings',
  'common.loading': 'Loading…',
  'common.saving': 'Saving…',
  'common.save': 'Save',
  'common.saved': 'Saved',
  'common.cancel': 'Cancel',

  'languages.eyebrow': 'Settings',
  'languages.title': 'Language',
  'languages.description':
    'Choose the language the app uses for you. Your choice saves to your account and follows you to other devices.',
  'languages.panelTitle': 'App language',
  'languages.panelDescription': 'One language at a time. Changes apply immediately.',
  'languages.current': 'Current',
  'languages.formatsIn': 'Dates and numbers will be formatted for',
  'languages.regionNote':
    'This changes the interface language only. Content providers write — service descriptions, reviews, quotes — stays in the language it was written in.',
  'languages.save': 'Save language',
  'languages.saving': 'Saving…',
  'languages.saved': 'Language saved.',
  'languages.error': 'Could not save your language. Try again.',
  'languages.useLanguage': 'Use {name}',
  'languages.selectedLabel': 'Selected language',

  'notifications.loading': 'Loading your preferences…',
  'notifications.title': 'Notifications',
  'notifications.description':
    'Choose how you want to hear about each kind of update. Every switch saves on its own — there’s no form to submit.',
  'notifications.thisDevice': 'This device',
  'notifications.thisDeviceDescription':
    'Push needs a one-time permission on each browser or phone you sign in on.',
  'notifications.smsUnavailable': 'SMS notifications aren’t available yet.',
  'notifications.deliveryChannels': 'Delivery channels',
  'notifications.deliveryChannelsDescription':
    'Pick a channel per update type. Turning everything off for a category is allowed — nothing is forced on.',
  'notifications.updateType': 'Update type',
  'notifications.error': 'Could not save that change',

  'personalization.loading': 'Loading your settings…',
  'personalization.title': 'Personalization',
  'personalization.description':
    'Control how Bii Localfinder tailors your experience. Each switch saves as soon as you flip it.',
  'personalization.recommendations': 'Recommendations',
  'personalization.activeCount': '{on} of {total} active.',
  'personalization.autoSave': 'Changes save automatically',
  'personalization.interests': 'Your interests',
  'personalization.interestsDescription':
    'What we’ve learned from what you’ve been looking at. The more you browse, the sharper this gets.',
  'personalization.recommendationsEnabled': 'Personalized recommendations',
  'personalization.recommendationsEnabledDescription':
    'Use your activity to tailor what you see. Turning this off shows popular, nearby, and highly-rated providers instead.',
  'personalization.locationEnabled': 'Location-based recommendations',
  'personalization.locationEnabledDescription':
    'Factor in your location to show nearby providers first.',
  'personalization.recentlyViewed': 'Recently viewed',
  'personalization.recentlyViewedDescription':
    'Show providers you’ve recently looked at on your homepage.',

  'auth.email': 'Email address',
  'auth.emailPlaceholder': 'you@company.com',
  'auth.password': 'Password',
  'auth.forgotPassword': 'Forgot password?',
  'auth.pointVerifiedTitle': 'Every provider is identity-checked',
  'auth.pointVerifiedBody':
    'You see the verification state before you ever send a message.',
  'auth.pointCompareTitle': 'Quotes you can actually compare',
  'auth.pointCompareBody':
    'Scope, price and terms land in the same structured thread.',
  'auth.pointPayTitle': 'No escrow, no middleman',
  'auth.pointPayBody': 'Pay the provider directly once the work is done.',
  'auth.pointNearbyTitle': 'Get found by people nearby',
  'auth.pointNearbyBody':
    'A verified profile puts you in front of local buyers actively searching.',
  'auth.pointPipelineTitle': 'A pipeline, not a phone book',
  'auth.pointPipelineBody':
    'Requests, quotes, messages and bookings all live in one workspace.',
  'auth.pointPriceTitle': 'You set the price',
  'auth.pointPriceBody':
    'Structured quotes keep the conversation about scope, not haggling.',

  'login.eyebrow': 'Welcome back',
  'login.heading': 'Work with people you can actually verify.',
  'login.title': 'Log in',
  'login.description': 'Sign in to your Bii Localfinder account.',
  'login.passwordUpdated': 'Password updated. Log in with your new password.',
  'login.submit': 'Log in',
  'login.submitting': 'Logging in…',
  'login.failed': 'Login failed',
  'login.footer': 'Don’t have an account?',
  'login.footerAction': 'Create one free',
  'login.asideCities': 'Kigali · Rubavu · Musanze · Huye',

  'register.forClients': 'For clients',
  'register.forProviders': 'For providers',
  'register.headingClient': 'Hire local talent without the guesswork.',
  'register.headingProvider': 'Turn your trade into a pipeline of local work.',
  'register.title': 'Create your account',
  'register.subtitle': 'Free to join. No card required.',
  'register.accountType': 'Account type',
  'register.roleClient': 'I’m hiring',
  'register.roleProvider': 'I’m offering',
  'register.firstName': 'First name',
  'register.firstNamePlaceholder': 'Jean',
  'register.lastName': 'Last name',
  'register.lastNamePlaceholder': 'Uwase',
  'register.passwordHint': 'At least 8 characters',
  'register.submitClient': 'Create client account',
  'register.submitProvider': 'Create provider account',
  'register.creating': 'Creating account…',
  'register.failed': 'Registration failed',
  'register.footer': 'Already have an account?',
  'register.footerAction': 'Log in',
  'register.asideFooter': 'Join as a client or a provider in under a minute.',

  'forgot.eyebrow': 'Account recovery',
  'forgot.heading': 'Let’s get you back in.',
  'forgot.title': 'Forgot your password?',
  'forgot.description':
    'Enter the email you signed up with and we’ll send you a link to choose a new password.',
  'forgot.sent':
    'If that email exists, a reset link is on its way. The link expires in 60 minutes and can only be used once.',
  'forgot.nothing': 'Nothing after a few minutes? Check your spam folder, or',
  'forgot.tryDifferent': 'try a different email',
  'forgot.submit': 'Send reset link',
  'forgot.sending': 'Sending…',
  'forgot.failed': 'Could not send the reset email. Please try again.',
  'forgot.footer': 'Remembered it?',
  'forgot.footerAction': 'Back to log in',

  'reset.eyebrow': 'Account recovery',
  'reset.headingIncomplete': 'That link is incomplete.',
  'reset.heading': 'Choose a new password.',
  'reset.noTokenTitle': 'Missing reset token',
  'reset.noTokenBody':
    'This page needs to be opened from the link in your reset email. Request a fresh one and try again.',
  'reset.requestNew': 'Request a new link',
  'reset.title': 'Set a new password',
  'reset.description':
    'You’ll be signed out everywhere and asked to log in again afterwards.',
  'reset.done': 'Password updated. Taking you to the login page…',
  'reset.newPassword': 'New password',
  'reset.confirmPassword': 'Confirm new password',
  'reset.minChars': 'At least {min} characters.',
  'reset.submit': 'Update password',
  'reset.updating': 'Updating…',
  'reset.mismatch': 'The two passwords do not match.',
  'reset.failed': 'Could not reset your password. Please try again.',
  'reset.footer': 'Changed your mind?',
  'reset.footerAction': 'Back to log in',

  'home.eyebrow': 'Welcome back',
  'home.greeting': 'Good to see you, {name}.',
  'home.subtitleClient':
    'Pick up where you left off — post a request, compare quotes, or jump back into an open thread.',
  'home.subtitleProvider':
    'Your workspace: keep services current, respond to requests and watch demand.',
  'home.subtitleAdmin':
    'The platform, in one place — moderation queues, users and the pulse of the marketplace.',
  'home.activeRequests': '{count} active requests',
  'home.readyWhenYouAre': 'Ready when you are',
  'home.noFeesEver': 'No fees, ever',
  'home.workspaceSummary': 'Your provider workspace',
  'home.replyFast': 'Reply fast to win jobs',
  'home.adminSummary': 'Everything from one console',
  'home.adminModerate': 'Search, moderate, resolve',
  'home.statSavedProviders': 'Saved providers',
  'home.statSavedProvidersSub': 'When you mention someone you like',
  'home.statSavedSearches': 'Saved searches',
  'home.statSavedSearchesSub': 'Notified when new providers match',
  'home.statQuickAction': 'Quick action',
  'home.statClientCta': 'Draft a request with AI',
  'home.statProviderCta': 'Add a service offering',
  'home.statAdminCta': 'Open the admin console',
  'home.go': 'Go',
  'home.actionPostRequest': 'Post a request',
  'home.actionPostRequestBody': 'Describe the job — the AI assistant can draft it.',
  'home.actionFindProviders': 'Find providers',
  'home.actionFindProvidersBody': 'Search by service, price, rating or area.',
  'home.actionMyBookings': 'My bookings',
  'home.actionMyBookingsBody': 'Confirmed jobs and their status, in one list.',
  'home.actionMessages': 'Messages',
  'home.actionMessagesBody': 'Threads with the providers you hired.',
  'home.actionProviderMessagesBody': 'Threads with clients about quotes and jobs.',
  'home.actionDashboard': 'Open your dashboard',
  'home.actionDashboardBody': 'Analytics, actions and demand in one place.',
  'home.actionManageServices': 'Manage your services',
  'home.actionManageServicesBody': 'Keep offers, pricing and availability current.',
  'home.actionAdminConsole': 'Admin console',
  'home.actionAdminConsoleBody': 'Moderation queues, users and platform stats.',
  'home.actionSavedSearches': 'Saved searches',
  'home.actionSavedSearchesBody': 'Searches you follow for new matches.',
  'home.recentRequests': 'Your requests',
  'home.allRequests': 'All requests',
  'home.serviceRequest': 'Service request',
  'home.quotes': '{count} quotes',
  'home.upcomingBookings': 'Upcoming bookings',
  'home.allBookings': 'All bookings',
  'home.recForYou': 'Recommended for you',
  'home.recForYouSub': 'Ranked from what you actually do on the platform',
  'home.becauseYouView': 'Because you’re into {category}',
  'home.popularServices': 'Popular services',
  'home.nearbyProviders': 'Nearby providers',
  'home.highlyRated': 'Highly rated providers',
  'home.continueExploring': 'Continue exploring',
  'home.recentlyViewed': 'Recently viewed',
  'home.interestsTitle': 'Things you’re into',
  'home.interestsBody':
    'Tap one to find providers for it. These come from your activity — searches, views and bookings.',
  'home.savedSearchesEmpty':
    'Save a search and we’ll tell you when a new provider matches. Manage them from',
  'home.savedSearchesLink': 'your saved searches',
  'home.manageSavedSearches': 'Manage saved searches',

  'homeSearch.serviceLabel': 'Service you need',
  'homeSearch.servicePlaceholder': 'What needs doing?',
  'homeSearch.locationLabel': 'City or neighborhood',
  'homeSearch.locationPlaceholder': 'Kigali, neighborhood…',
  'homeSearch.submit': 'Search',
  'homeSearch.popular': 'Popular',

  'providerCard.verified': '{count} verified',
  'providerCard.distance': '{distance} km away',
  'providerCard.servesArea': 'Serves your area',
  'providerCard.repliesIn': 'Replies in ~{minutes} min',
  'providerCard.repliesInHours': 'Replies in ~{hours} h',
  'providerCard.yearsExperience': '{count} yrs experience',
  'providerCard.from': 'From',
  'providerCard.contactForPricing': 'Contact for pricing',
  'providerCard.removeFromCompare': 'Remove from comparison',
  'providerCard.addToCompare': 'Add to comparison',
  'providerCard.removeAria': 'Remove {name} from comparison',
  'providerCard.addAria': 'Add {name} to comparison',

  'verification.verifiedProvider': 'Verified provider',
  'verification.businessVerified': 'Business verified',
  'verification.suspended': 'Verification suspended',

  'availability.notAvailable': 'Not currently available',
  'availability.today': 'Available today',
  'availability.tomorrow': 'Available tomorrow',
  'availability.next': 'Next available {label}',

  'status.open': 'Open',
  'status.quoted': 'Quoted',
  'status.negotiating': 'Negotiating',
  'status.pending': 'Pending',
  'status.accepted': 'Accepted',
  'status.booked': 'Booked',
  'status.confirmed': 'Confirmed',
  'status.inProgress': 'In progress',
  'status.completed': 'Completed',
  'status.cancelled': 'Cancelled',
  'status.rejected': 'Rejected',
  'status.disputed': 'Disputed',
  'status.expired': 'Expired',
  'status.superseded': 'Superseded',
  'status.draft': 'Draft',
  'status.archived': 'Archived',
  'status.approved': 'Approved',
  'status.flagged': 'Flagged',
  'status.unverified': 'Unverified',
  'status.verified': 'Verified',
  'status.suspended': 'Suspended',
  'status.responded': 'Responded',
  'status.underReview': 'Under review',
  'status.dismissed': 'Dismissed',
  'status.active': 'Active',
  'status.invited': 'Invited',
  'status.removed': 'Removed',
  'status.pastDue': 'Past due',
  'status.trialing': 'Trialing',

  'account.loading': 'Loading your account…',
  'account.signedOut': 'You’re signed out',
  'account.signedOutBody': 'Your session has ended. Log in again to continue.',
  'account.logIn': 'Log in',
  'account.eyebrow': 'My account',
  'account.activeSession': 'Active session',
  'account.goodStanding': 'Good standing',
  'account.signedInOn': 'Signed in on this browser',
  'account.roleClient': 'Client',
  'account.roleProvider': 'Provider',
  'account.roleAdmin': 'Admin',
  'account.activity': 'Activity',
  'account.activityMeta': 'Your work on Bii',
  'account.preferences': 'Preferences & visibility',
  'account.preferencesMeta': 'Manage your app',
  'account.linkProfile': 'My profile',
  'account.linkProfileBody': 'Your name, photo and short bio.',
  'account.linkRequests': 'My requests',
  'account.linkRequestsBody': 'Post work and compare incoming quotes.',
  'account.linkBookings': 'Bookings',
  'account.linkBookingsBody': 'Scheduled, active and completed work.',
  'account.linkMessages': 'Messages',
  'account.linkMessagesBody': 'Conversations with providers and clients.',
  'account.linkSaved': 'Saved providers',
  'account.linkSavedBody': 'Providers you have saved for later.',
  'account.linkNotifications': 'Notification settings',
  'account.linkNotificationsBody': 'Email and push preferences.',
  'account.linkPersonalization': 'Personalization',
  'account.linkPersonalizationBody': 'What we recommend, and why.',
  'account.linkLanguage': 'Language',
  'account.linkLanguageBody': 'Display language for the app.',
  'account.adminConsole': 'Admin console',
  'account.providerWorkspace': 'Provider workspace',
  'account.activeWorkspace': 'Active workspace',
  'account.providerDesc':
    'Your sessions, services, bookings and earnings live in the provider side of Bii.',
  'account.adminDesc':
    'Moderation, not selling — the admin console handles verifications, reports, disputes and categories.',
  'account.clientDesc': 'Only available if you sell services on the platform.',
  'account.openDashboard': 'Open dashboard',
  'account.openAdmin': 'Open admin console',
  'account.becomeProvider': 'Become a provider',
  'account.becomeProviderHint':
    'Keeps your existing login and your request history — you are not creating a new account.',
  'account.session': 'Session',
  'account.sessionDesc': 'Sign out of this browser. Your data stays put.',
  'account.logOut': 'Log out',

  'attribute.required': ' (required)',

  'reqAssist.title': 'AI booking assistant',
  'reqAssist.description':
    'Describe what you need in English, Kinyarwanda, or French — the assistant asks follow-up questions and fills the form below for you to review before sending.',
  'reqAssist.stillNeeded': 'Still needed:',
  'reqAssist.thinking': 'Thinking…',
  'reqAssist.inputPlaceholder':
    'e.g. My kitchen sink pipe is leaking, I need someone tomorrow morning',
  'reqAssist.sendAria': 'Send to assistant',
  'reqAssist.failedSuffix': 'you can fill in the form manually below.',
  'reqAssist.unavailable':
    'The AI assistant is unavailable right now — you can fill in the form manually below.',
  'reqAssist.filled':
    'Filled in {count} field below — review and edit everything before sending',
  'reqAssist.filledPlural':
    'Filled in {count} fields below — review and edit everything before sending',
  'reqAssist.skipped': ' ({count} suggestion could not be verified and was left out).',
  'reqAssist.skippedPlural': ' ({count} suggestions could not be verified and were left out).',
  'reqAssist.field.service': 'Service',
  'reqAssist.field.title': 'Title',
  'reqAssist.field.description': 'Description',

  'aiAssist.title': 'Describe your job (optional)',
  'aiAssist.description':
    'Tell us what you need in your own words, or attach a photo — we’ll pre-fill the form below for you to review.',
  'aiAssist.placeholder':
    'e.g. My kitchen sink pipe is leaking under the cabinet, been dripping for two days',
  'aiAssist.changePhoto': 'Change photo',
  'aiAssist.attachPhoto': 'Attach a photo',
  'aiAssist.photoAlt': 'Attached job photo',
  'aiAssist.thinking': 'Thinking…',
  'aiAssist.suggest': 'Suggest details',
  'aiAssist.failed': 'Could not get suggestions — you can still fill this in yourself',
  'aiAssist.filled': 'Filled in {count} field below — double-check everything before sending',
  'aiAssist.filledPlural': 'Filled in {count} fields below — double-check everything before sending',
  'aiAssist.skipped': ' ({count} field left blank).',
  'aiAssist.skippedPlural': ' ({count} fields left blank).',

  'requests.new.eyebrow': 'New request',
  'requests.new.title': 'Request a service',
  'requests.new.directed': 'Send this request directly to the provider you were viewing.',
  'requests.new.open':
    'Describe what you need — nearby providers will be able to send you quotes.',
  'requests.new.serviceSection': 'What do you need?',
  'requests.new.service': 'Service',
  'requests.new.selectService': 'Select a service…',
  'requests.new.fixedByOffering': 'Fixed by the offering you selected.',
  'requests.new.changeService': 'Change service',
  'requests.new.noServices':
    'This provider has not listed any services yet, so a direct request cannot be sent.',
  'requests.new.onlyServices': 'Showing only the services {name} offers.',
  'requests.new.describeJob': 'Describe the job',
  'requests.new.describeJobHint':
    'The more specific you are, the more accurate your quotes will be.',
  'requests.new.titleLabel': 'Title',
  'requests.new.titlePlaceholder': 'e.g. Leaking kitchen pipe',
  'requests.new.descLabel': 'Description',
  'requests.new.descPlaceholder':
    'I need someone to repair a leaking water pipe under the kitchen sink. It has been dripping for two days.',
  'requests.new.moreDetails': 'A few more details',
  'requests.new.moreDetailsHintDirected':
    'Follows the setup {name} published for this service.',
  'requests.new.moreDetailsHintOpen':
    'Questions specific to this service, so providers can quote accurately.',
  'requests.new.includedWithOffering': 'Included with this offering — set by {name}',
  'requests.new.whenAndHowMuch': 'When and how much',
  'requests.new.preferredDate': 'Preferred date',
  'requests.new.preferredTime': 'Preferred time',
  'requests.new.budget': 'Budget (RWF)',
  'requests.new.budgetMinAria': 'Minimum budget in RWF',
  'requests.new.budgetMaxAria': 'Maximum budget in RWF',
  'requests.new.minimum': 'Minimum',
  'requests.new.maximum': 'Maximum',
  'requests.new.budgetInverted': 'The maximum needs to be at least the minimum.',
  'requests.new.budgetHint':
    'Optional, but quotes land closer to your intent when you share a range.',
  'requests.new.notes': 'Additional notes',
  'requests.new.optional': '(optional)',
  'requests.new.notesPlaceholder': 'Parking is available on the street. Second floor, no lift.',
  'requests.new.summary': 'Request summary',
  'requests.new.summaryService': 'Service',
  'requests.new.sentTo': 'Sent to',
  'requests.new.selectedProvider': 'the selected provider',
  'requests.new.competition': 'Competition',
  'requests.new.openToOthers': 'Open to other providers',
  'requests.new.private': 'Private',
  'requests.new.when': 'When',
  'requests.new.flexible': 'Flexible',
  'requests.new.budgetLabel': 'Budget',
  'requests.new.beforeYouSend': 'Before you send',
  'requests.new.checkService': 'Service chosen',
  'requests.new.checkTitle': 'Title added',
  'requests.new.checkDesc': 'Description added',
  'requests.new.checkBudget': 'Budget in range',
  'requests.new.sending': 'Sending…',
  'requests.new.send': 'Send request',
  'requests.new.privacyNoteStart':
    'If negotiating with {name} gets difficult, other matching providers can also send competitive quotes.',
  'requests.new.privacyNoteBold':
    'You still decide who wins, and providers never see each other’s prices.',
  'requests.new.privacyNoteTail': 'Off by default — your request starts private to them.',
  'requests.new.footerDirectedOpen':
    'Sent first to {name} — other matching providers can also quote, but every price stays between you and each provider.',
  'requests.new.footerDirectedPrivate':
    'Only {name} will be notified — your request and quotes stay private between the two of you.',
  'requests.new.footerOpen':
    'Providers who match this request will be notified. You are never charged at this step.',
  'requests.new.errorService': 'Please choose a service.',
  'requests.new.errorCreate': 'Could not create request',
  'requests.new.budgetRange': '{min} – {max} RWF',
  'requests.new.budgetUpTo': 'Up to {max} RWF',
  'requests.new.budgetFrom': 'From {min} RWF',
  'requests.new.budgetUnspecified': 'Not specified',
  'requests.new.yes': 'Yes',
  'requests.new.no': 'No',

  'aiSearch.toggle': 'AI search',
  'aiSearch.placeholder':
    'Describe what you need in one sentence — e.g. I need someone to install a CCTV system for my small shop in Kigali.',
  'aiSearch.thinking': 'Reading your request…',
  'aiSearch.failed': 'AI could not read that — showing a plain keyword search instead.',
  'aiSearch.noCriteria': 'No clear criteria were found — showing all providers.',
  'aiSearch.title': 'AI search',
  'aiSearch.clear': 'Clear AI search',
  'aiSearch.chipService': 'Service',
  'aiSearch.chipLocation': 'Location',
  'aiSearch.chipBudget': 'Budget',
  'aiSearch.chipExperience': 'Experience',
  'aiSearch.chipVerified': 'Verified',
  'aiSearch.chipRating': 'Rating',
  'aiSearch.urgencyNormal': 'Standard timing',
  'aiSearch.urgencyUrgent': 'Urgent — available now',
  'aiSearch.skipped': ' ({count} could not be applied and was left out).',
  'aiSearch.skippedPlural': ' ({count} could not be applied and were left out).',
} as const;

export type MessageKey = keyof typeof EN;

const RW = {
  'common.settings': 'Ibyumere',
  'common.loading': 'Biratangira…',
  'common.saving': 'Birabika…',
  'common.save': 'Bika',
  'common.saved': 'Byabikijwe',
  'common.cancel': 'Hagarika',

  'languages.eyebrow': 'Ibyumere',
  'languages.title': 'Ururimi',
  'languages.description':
    'Hitamo ururimi gukoreshwa kugira no wowe. Igisengeza cyawe gizabikora ku konto yawe, no gukubikira kuri mudasobwa wundi.',
  'languages.panelTitle': 'Ururimi gukoreshwa',
  'languages.panelDescription': 'Uruherengane rw’ururimi umwe. Ibintu bigahita bihinduka.',
  'languages.current': 'Ubu',
  'languages.formatsIn': 'Amatariki n’amubare bazarandikwa hakurikijwe',
  'languages.regionNote':
    'Ibi guhindura ururimi rw’ibikoresho gusa. Ibisobanuro by’abayobitsi, ibitekerezo, n’ibiciro by’ibigengereza birakomeza mu ururimi rwabigize.',
  'languages.save': 'Bika ururimi',
  'languages.saving': 'Birabika…',
  'languages.saved': 'Ururimi rwarabikijwe.',
  'languages.error': 'Ntitwashobora kubika ururimi rwawe. Ongera ugerageze.',
  'languages.useLanguage': 'Koresha {name}',
  'languages.selectedLabel': 'Ururimi rwahisemo',

  'notifications.loading': 'Biratangira ibipfunwe byawe…',
  'notifications.title': 'Ubutumwa',
  'notifications.description':
    'Hitamo uburyo ubashaka kumenera umuziki wose watanzemo. Buri muhinduro birabikwa byibwe, nta fomu yo gutanga.',
  'notifications.thisDevice': 'Iki gikoresho',
  'notifications.thisDeviceDescription':
    'Ubutumwa bwa push busaba uruhare rumwe kuri buri browser cyangwa telefone w’uriho.',
  'notifications.smsUnavailable': 'Ubutumwa bwambiri kuri SMS ntibwaboneka.',
  'notifications.deliveryChannels': 'Uburyo bwo kohereza ubutumwa',
  'notifications.deliveryChannelsDescription':
    'Hitamo uburyo kuri buri woko w’ubutumwa. Gushatya byose kwa ikiganiye byemewe, nta byahobijwe.',
  'notifications.updateType': 'Ubutumwa buherekeza kuri ki',
  'notifications.error': 'Ntitwashobora guhindura ibi',

  'personalization.loading': 'Biratangira ibyumere byawe…',
  'personalization.title': 'Gushyira imbere ibigomba byawe',
  'personalization.description':
    'Tegereza uko Bii Localfinder igufuza. Buri muhinduro birabikwa ku gahoro uhimye.',
  'personalization.recommendations': 'Ibyifashisha',
  'personalization.activeCount': '{on} mu {total} bikora.',
  'personalization.autoSave': 'Ahinduko birabikwa byibwe',
  'personalization.interests': 'Intera zawe',
  'personalization.interestsDescription':
    'Ibyo twabaronka ku byo ubu wigeze ureba. Uko ureba byinshi, nkuko nkora neza.',
  'personalization.recommendationsEnabled': 'Ibyifashisha bigenawe',
  'personalization.recommendationsEnabledDescription':
    'Koresha igikorwa cyawe kugira ngo ibyo ubona bijyandanye. Kumuha iki kugaragaza abayobitsi b’abahabanze, bari hafi, n’abahora ryiza cyane.',
  'personalization.locationEnabled': 'Ibyifashisha hakurikijwe aho uri',
  'personalization.locationEnabledDescription':
    'Kubikora aho uri kugaragaza abayobitsi bari hafi imbere.',
  'personalization.recentlyViewed': 'Byabonye',
  'personalization.recentlyViewedDescription':
    'Garagaza abayobitsi wagiye kureba ku ipaji yawe y’imbere.',

  'auth.email': 'Aderesi ya email',
  'auth.emailPlaceholder': 'wowe@umusosiyete.com',
  'auth.password': 'Ijambobanga',
  'auth.forgotPassword': 'Wibagiwe ijambobanga?',
  'auth.pointVerifiedTitle': 'Buri muyobozi w’ishinga yamaze guemezwa',
  'auth.pointVerifiedBody':
    'Ubonako urutonde rw’iyemezo mbere y’uko ohereza ubutumwa.',
  'auth.pointCompareTitle': 'Ibiciro ushobora kugereranya',
  'auth.pointCompareBody':
    'Umucyo, igiciro n’amasezerano bijya mu murongo umwe usobeza.',
  'auth.pointPayTitle': 'Nta wagenzura hakati, nta nyiriza',
  'auth.pointPayBody': 'Wishyura umuyobozi ubwe iyo akazi karangiye.',
  'auth.pointNearbyTitle': 'Bamenye abari hafi yawe',
  'auth.pointNearbyBody':
    'Ipaji yemewe igeza abakiriya baho bashaka serivisi.',
  'auth.pointPipelineTitle': 'Umurongo w’akazi, atari ubukoronge',
  'auth.pointPipelineBody':
    'Ibisabwa, ibiciro, ubutumwa n’amasezerano biba mu mwanya umwe.',
  'auth.pointPriceTitle': 'Wowe usize igiciro',
  'auth.pointPriceBody':
    'Ibiciro bisobanutse bibaha amahane ku kazi, atari ku guhanahana.',
  'login.eyebrow': 'Murakaza neza',
  'login.heading': 'Korana n’abantu ushobora kubyemeza.',
  'login.title': 'Injira',
  'login.description': 'Injira muri konti yawe ya Bii Localfinder.',
  'login.passwordUpdated':
    'Ijambobanga ryahindutse. Injirana n’ijambobanga ryawe rishya.',
  'login.submit': 'Injira',
  'login.submitting': 'Birimo kwinjira…',
  'login.failed': 'Kwinjira nti byabaye',
  'login.footer': 'Nta konti ufite?',
  'login.footerAction': 'Kora umwe ku buntu',
  'login.asideCities': 'Kigali · Rubavu · Musanze · Huye',

  'register.forClients': 'Ku bakiriya',
  'register.forProviders': 'Ku baha serivisi',
  'register.headingClient': 'Shaka umuyobozi w’aho uri utabishishikaje.',
  'register.headingProvider': 'Hindura umwuga wawe ukaba akazi k’aho uri.',
  'register.title': 'Kora konti yawe',
  'register.subtitle': 'Kwinjira ni ubuntu. Nta karita ikenewe.',
  'register.accountType': 'Ubwoko bw’akonti',
  'register.roleClient': 'Ndashaka serivisi',
  'register.roleProvider': 'Ndaha serivisi',
  'register.firstName': 'Izina',
  'register.firstNamePlaceholder': 'Jean',
  'register.lastName': 'Izina ry’umuryango',
  'register.lastNamePlaceholder': 'Uwase',
  'register.passwordHint': 'Bijyanye n’inyuguti 8 byibuze',
  'register.submitClient': 'Kora konti y’umukiriya',
  'register.submitProvider': 'Kora konti y’umuyobozi',
  'register.creating': 'Birimo gukora konti…',
  'register.failed': 'Iyi konti nti yanditswe',
  'register.footer': 'Ufite konti?',
  'register.footerAction': 'Injira',
  'register.asideFooter':
    'Injira nk’umukiriya cyangwa umuyobozi mu menota nto nto.',

  'forgot.eyebrow': 'Kubasubizanya konti',
  'forgot.heading': 'Reka dukusubize mu kwinjira.',
  'forgot.title': 'Wibagiwe ijambobanga?',
  'forgot.description':
    'Andika aderesi ya email wiyandikishije kugira ngo tuguhereze ahuza ryo guhitamo ijambobanga rishya.',
  'forgot.sent':
    'Niba iya email ibaho, ahuza ryo kongera ririmo kuza. Ribaho iminota 60 gusa kandi rikoreshwa rimwe.',
  'forgot.nothing': 'Nta kintu uzabona? Reba mu spam y’email yawe, cyangwa',
  'forgot.tryDifferent': 'gera ku aderesi yindi',
  'forgot.submit': 'Ohereza ahuza ryo kongera',
  'forgot.sending': 'Birimo kohereza…',
  'forgot.failed': 'Ntitwashoboye kohereza email yo kongera. Ongera ugerageze.',
  'forgot.footer': 'Waributse indi nkuru?',
  'forgot.footerAction': 'Garuka ku kwinjira',

  'reset.eyebrow': 'Kubasubizanya konti',
  'reset.headingIncomplete': 'Iryo huza ntiryuzuye.',
  'reset.heading': 'Hitamo ijambobanga rishya.',
  'reset.noTokenTitle': 'Icyimbo cy’igihuza kirimo kigomba',
  'reset.noTokenBody':
    'Iyi paji igomba gufungurwa kuva ku huza ririmo email yawe yo kongera. Saba irindi rishya ugere.',
  'reset.requestNew': 'Saba ahuza rishya',
  'reset.title': 'Shyiraho ijambobanga rishya',
  'reset.description':
    'Uzava mu mwanya wose wari winjiyemo maze usabwe kwinjira nyuma.',
  'reset.done': 'Ijambobanga ryahindutse. Tugushera ku paji yo kwinjira…',
  'reset.newPassword': 'Ijambobanga rishya',
  'reset.confirmPassword': 'Emeza ijambobanga rishya',
  'reset.minChars': 'Bijyanye n’inyuguti {min} byibuze.',
  'reset.submit': 'Hindura ijambobanga',
  'reset.updating': 'Birimo guhindura…',
  'reset.mismatch': 'Ayo majambobanga abiri ntahwanye.',
  'reset.failed': 'Ntitwashoboye kongera ijambobanga ryawe. Ongera ugerageze.',
  'reset.footer': 'Wahindukanye?',
  'reset.footerAction': 'Garuka ku kwinjira',

  'home.eyebrow': 'Murakaza neza',
  'home.greeting': 'Murakaza neza, {name}.',
  'home.subtitleClient':
    'Fata aho wahasize — tanga isaba, gereranya ibiciro, cyangwa subira mu biganiro byafunguye.',
  'home.subtitleProvider':
    'Aho ukorera: komeza serivisi zawe zigezweho, subiza ibisabwa ugirire no ku bisabwa.',
  'home.subtitleAdmin':
    'Urubuga rwose — ibantu bategereje, abakoresha n’uwo isoko iriho.',
  'home.activeRequests': '{count} zisabwa zikorwa',
  'home.readyWhenYouAre': 'Twiteze gufasha',
  'home.noFeesEver': 'Nta bisanzwe',
  'home.workspaceSummary': 'Aho ukorera',
  'home.replyFast': 'Subiza vuba watsinde akazi',
  'home.adminSummary': 'Byose biva ahandi hamwe',
  'home.adminModerate': 'Shaka, genzura, hinduranya',
  'home.statSavedProviders': 'Abayobozi wizeye',
  'home.statSavedProvidersSub': 'Iyo uvuga umuntu ukunda',
  'home.statSavedSearches': 'Gushaka kwarokowe',
  'home.statSavedSearchesSub': 'Umenywa iyo abayobozi bashya baje',
  'home.statQuickAction': 'Igikorwa cyihuse',
  'home.statClientCta': 'Tanga isaba n’umuyoboti (AI)',
  'home.statProviderCta': 'Ongera serivisi',
  'home.statAdminCta': 'Fungura urubuga rw’ubuyobozi',
  'home.go': 'Komeza',
  'home.actionPostRequest': 'Tanga isaba',
  'home.actionPostRequestBody': 'Sobanura akazi — umuyoboti (AI) ashobora kukwandikira.',
  'home.actionFindProviders': 'Shaka abayobozi',
  'home.actionFindProvidersBody': 'Shaka ushingiye ku serivisi, igiciro, amanota cyangwa akagari.',
  'home.actionMyBookings': 'Uburere bwanjye',
  'home.actionMyBookingsBody': 'Akazi gakorenwe imwe hamwe n’imiterere yakwo.',
  'home.actionMessages': 'Ubutumwa',
  'home.actionMessagesBody': 'Ibiganirwa n’abayobozi wahimbye.',
  'home.actionProviderMessagesBody': 'Ibiganirwa n’abakiriya kuri ibiciro n’akazi.',
  'home.actionDashboard': 'Fungura dashboard yawe',
  'home.actionDashboardBody': 'Analytics, ibikorwa n’ibisabwa, byose hamwe.',
  'home.actionManageServices': 'Genzura serivisi zawe',
  'home.actionManageServicesBody': 'Komeza ibiciro n’ukuboneka kwawe bugende.',
  'home.actionAdminConsole': 'Urubuga rw’ubuyobozi',
  'home.actionAdminConsoleBody': 'Imirongo yo kugenzura, abakoresha n’imibare y’ikigo.',
  'home.actionSavedSearches': 'Gushaka kwarokowe',
  'home.actionSavedSearchesBody': 'Ubushakashatsi ukurikirana mu gushaka ibyo ushaka.',
  'home.recentRequests': 'Ibisabwa byawe',
  'home.allRequests': 'Ibisabwa byose',
  'home.serviceRequest': 'Isaba serivisi',
  'home.quotes': 'ibiciro {count}',
  'home.upcomingBookings': 'Uburere bugiye',
  'home.allBookings': 'Uburere bwose',
  'home.recForYou': 'Byahariwe wowe',
  'home.recForYouSub': 'Bikurikiranye n’ukoresha urubuga.',
  'home.becauseYouView': 'Kubera ko ukunda {category}',
  'home.popularServices': 'Serivisi zizwi cyane',
  'home.nearbyProviders': 'Abayobozi bari hafi',
  'home.highlyRated': 'Abayobozi bafite amanota hejuru',
  'home.continueExploring': 'Komeza ushake',
  'home.recentlyViewed': 'Wabonye ku iherezo',
  'home.interestsTitle': 'Ibyo ukunda',
  'home.interestsBody':
    'Kanda kuri kimwe ushake abayobozi. Ibikorwa byawe — gushaka, kureba n’uburere — ni byo bivamo.',
  'home.savedSearchesEmpty':
    'Rokora ishaka ngo tubwire iyo abayobozi bashya bajemo. Ugereranya kuva',
  'home.savedSearchesLink': 'ubushakashatsi bwawe',
  'home.manageSavedSearches': 'Genzura ubushakashatsi',

  'homeSearch.serviceLabel': 'Serivisi ukenera',
  'homeSearch.servicePlaceholder': 'Ni iki gikeneye gukomoza?',
  'homeSearch.locationLabel': 'Umujyi cyangwa ahantu',
  'homeSearch.locationPlaceholder': 'Kigali, urumuri…',
  'homeSearch.submit': 'Shaka',
  'homeSearch.popular': 'Bizwi cyane',

  'providerCard.verified': '{count} byemejwe',
  'providerCard.distance': '{distance} km uvuye',
  'providerCard.servesArea': 'Aho uri arahari',
  'providerCard.repliesIn': 'Inzira ~{minutes} min',
  'providerCard.repliesInHours': 'Inzira ~{hours} h',
  'providerCard.yearsExperience': 'Imyaka {count} y\'ubuhanga',
  'providerCard.from': 'Kuva',
  'providerCard.contactForPricing': 'Baza igiciro',
  'providerCard.removeFromCompare': 'Kura mu kugereranya',
  'providerCard.addToCompare': 'Ongera mu kugereranya',
  'providerCard.removeAria': 'Kura {name} mu kugereranya',
  'providerCard.addAria': 'Ongera {name} mu kugereranya',

  'verification.verifiedProvider': 'Umuyobozi wemejwe',
  'verification.businessVerified': 'Isosiyete yemejwe',
  'verification.suspended': 'Imezerwa ryahagaritswe',

  'availability.notAvailable': 'Ntabwo ariho ubu',
  'availability.today': 'Uyumunsi arahari',
  'availability.tomorrow': 'Ejo arahari',
  'availability.next': 'Azaboneka {label}',

  'status.open': 'Yafunguwe',
  'status.quoted': 'Igiciro gitarzwe',
  'status.negotiating': 'Kuganirwa ku giciro',
  'status.pending': 'Gutegereza',
  'status.accepted': 'Byakiriwe',
  'status.booked': 'Byabikijwe',
  'status.confirmed': 'Byemejwe',
  'status.inProgress': 'Birakorwa',
  'status.completed': 'Byarangiye',
  'status.cancelled': 'Byahagaritswe',
  'status.rejected': 'Byanze',
  'status.disputed': 'Haracyahari',
  'status.expired': 'Byashize',
  'status.superseded': 'Byasimbuwe',
  'status.draft': 'Bitarangira',
  'status.archived': 'Byabitswe',
  'status.approved': 'Byemejwe',
  'status.flagged': 'Byafashweho ibimenyetso',
  'status.unverified': 'Bitaraemejwa',
  'status.verified': 'Byemejwe',
  'status.suspended': 'Byahagaritswe',
  'status.responded': 'Byasubijwe',
  'status.underReview': 'Birakurikiranwa',
  'status.dismissed': 'Byangowe',
  'status.active': 'Birakora',
  'status.invited': 'Batumiwe',
  'status.removed': 'Byakuweho',
  'status.pastDue': 'Byarenze igihe',
  'status.trialing': 'Bigeragezwa',

  'account.loading': 'Biratangira konti yawe…',
  'account.signedOut': 'Wasesuye',
  'account.signedOutBody': 'Urunyamibare rwawe rwarangiye. Injira wongere ukomeze.',
  'account.logIn': 'Injira',
  'account.eyebrow': 'Konti yanjye',
  'account.activeSession': 'Urufunzo rukora',
  'account.goodStanding': 'Uruzinduko rwiza',
  'account.signedInOn': 'Winjijwe muri iyi browser',
  'account.roleClient': 'Umukiriya',
  'account.roleProvider': 'Umuyobozi',
  'account.roleAdmin': 'Umuyobozi w’urubuga',
  'account.activity': 'Ibikorwa',
  'account.activityMeta': 'Akazi kawe kuri Bii',
  'account.preferences': 'Ibyifuza n’ukuranga',
  'account.preferencesMeta': 'Genzura urubuga rwawe',
  'account.linkProfile': 'Umwirondoro wanjye',
  'account.linkProfileBody': 'Amazina yawe, ifoto na bio.',
  'account.linkRequests': 'Ibisabwa byanjye',
  'account.linkRequestsBody': 'Shyira akazi ukagereranya ibiciro biza.',
  'account.linkBookings': 'Uburere',
  'account.linkBookingsBody': 'Akazi gazuzuzwa, gakora cyangwa karangije.',
  'account.linkMessages': 'Ubutumwa',
  'account.linkMessagesBody': 'Ibiganirwa n’abayobozi n’abakiriya.',
  'account.linkSaved': 'Abayobozi wizeye',
  'account.linkSavedBody': 'Abayobozi wabitse kugira ubo usabe.',
  'account.linkNotifications': 'Ibyifuza by’amarangamutima',
  'account.linkNotificationsBody': 'Email na push, uko ubishaka.',
  'account.linkPersonalization': 'Gushyira imbere ibigogora',
  'account.linkPersonalizationBody': 'Ibyo tugusabaho, n’impanvu.',
  'account.linkLanguage': 'Ururimi',
  'account.linkLanguageBody': 'Ururimi urubuga rukoresha.',
  'account.adminConsole': 'Urubuga rw’ubuyobozi',
  'account.providerWorkspace': 'Aho umuyobozi akorera',
  'account.activeWorkspace': 'Aho ukorera gukora',
  'account.providerDesc':
    'Amasezerano, serivisi, uburere n’amafaranga biba mu ruhande rw’umuyobozi.',
  'account.adminDesc':
    'Kugenzura, atari ugurisha — urubuga rukora ibigeragezo, amakuru, amakimbirane n’ibyiciro.',
  'account.clientDesc': 'Birahari gusa iyo ugurisha serivisi ku rubuga.',
  'account.openDashboard': 'Fungura dashboard',
  'account.openAdmin': 'Fungura urubuga rw’ubuyobozi',
  'account.becomeProvider': 'Ba umuyobozi',
  'account.becomeProviderHint':
    'Ugomba kugumana ibanga ryawe n’amabazwa — ntabwo ukora konti nshya.',
  'account.session': 'Urufunzo',
  'account.sessionDesc': 'Sohoka muri iyi browser. Amakuru yawe aragumana.',
  'account.logOut': 'Nsohoke',

  'attribute.required': ' (birakenewe)',

  'reqAssist.title': 'Umuyoboti w’isaba (AI)',
  'reqAssist.description':
    'Sobanura ibyo ukenera mu Cyongereza, Ikinyarwanda cyangwa Igifaransa — umuyoboti akubaza ibibazo kandi ayujuje ifomu igikurikira kugira ngo uhere.',
  'reqAssist.stillNeeded': 'Biracyakenewe:',
  'reqAssist.thinking': 'Biratekereza…',
  'reqAssist.inputPlaceholder':
    'urugero: Igitembo cy’isinki cyaravuye, nkeneye umuntu ejo mu gitondo',
  'reqAssist.sendAria': 'Ohereza umuyoboti',
  'reqAssist.failedSuffix': 'ushobora kwuzuza ifomu ubwawe hepfo.',
  'reqAssist.unavailable':
    'Umuyoboti wa AI ntabwo akora ubu — shobora kwuzuza ifomu ubwawe hepfo.',
  'reqAssist.filled': '{count} cyujujwe mu ifomu — reba no gukosora byose mbere yo kohereza',
  'reqAssist.filledPlural': '{count} zujujwe mu ifomu — reba no gukosora byose mbere yo kohereza',
  'reqAssist.skipped': ' ({count} icyasabwa ntacyemejwe, ntacyashyizwe).',
  'reqAssist.skippedPlural': ' ({count} zisabwa ntazemejwe, ntazashyizwe).',
  'reqAssist.field.service': 'Serivisi',
  'reqAssist.field.title': 'Umutwe',
  'reqAssist.field.description': 'Ibisobanuro',

  'aiAssist.title': 'Sobanura akazi kawe (ukubyitaho)',
  'aiAssist.description':
    'Tubwire ibyo ukenera mu magambo yawe, cyangwa komeka ifoto — tuzujuje ifomu yepfo kugira ngo uhere.',
  'aiAssist.placeholder':
    'urugero: Igitembo cy’isinki cyaravuye mu kabati, kiratura ku minsi ibiri',
  'aiAssist.changePhoto': 'Hindura ifoto',
  'aiAssist.attachPhoto': 'Komeka ifoto',
  'aiAssist.photoAlt': 'Ifoto y’akazi',
  'aiAssist.thinking': 'Biratekereza…',
  'aiAssist.suggest': 'Tanga ibitekerezo',
  'aiAssist.failed': 'Ntitwashoboye kubona ibitekerezo — ushobora kubishyira ubwawe',
  'aiAssist.filled': '{count} cyujujwe — reba vyose mbere yo kohereza',
  'aiAssist.filledPlural': '{count} zujujwe — reba vyose mbere yo kohereza',
  'aiAssist.skipped': ' ({count} cyasigajwe ubusa).',
  'aiAssist.skippedPlural': ' ({count} zyasigajwe ubusa).',

  'requests.new.eyebrow': 'Isaba rishya',
  'requests.new.title': 'Saba serivisi',
  'requests.new.directed': 'Ohereza iri saba ku muyobozi wari ureba.',
  'requests.new.open':
    'Sobanura ibyo ukenera — abayobozi bari hafi bazabasha kuguhereza ibiciro.',
  'requests.new.serviceSection': 'Ni iki ukenera?',
  'requests.new.service': 'Serivisi',
  'requests.new.selectService': 'Hitamo serivisi…',
  'requests.new.fixedByOffering': 'Bihamye n’icyo watanze (offering).',
  'requests.new.changeService': 'Hindura serivisi',
  'requests.new.noServices':
    'Uyu muyobozi ntarashyiraho serivisi, nuko isaba ritashoboka.',
  'requests.new.onlyServices': 'Bagaragaza gusa serivisi {name} atanga.',
  'requests.new.describeJob': 'Sobanura akazi',
  'requests.new.describeJobHint':
    'Iyo usobanuye neza, ibiciro bizaba byiza kurushaho.',
  'requests.new.titleLabel': 'Umutwe',
  'requests.new.titlePlaceholder': 'urugero: Igitembo cya kichene kiravura',
  'requests.new.descLabel': 'Ibisobanuro',
  'requests.new.descPlaceholder':
    'Nkeneye umuntu wo gukosora igitembo cy’amazi gifashe munsi y’isinki. Kiratura ku minsi ibiri.',
  'requests.new.moreDetails': 'Ibindi bisobanuro byiyongera',
  'requests.new.moreDetailsHintDirected':
    'Bikurikiranye n’ibyo {name} yashyizeho kuri iyi serivisi.',
  'requests.new.moreDetailsHintOpen':
    'Ibibazo byihariye by’iyi serivisi, kugira ngo abayobozi babashe gutanga igiciro cyiza.',
  'requests.new.includedWithOffering': 'Bijyanye n’iki cyahanzwe — byashyizweho na {name}',
  'requests.new.whenAndHowMuch': 'Igihe n’ingano y’amafaranga',
  'requests.new.preferredDate': 'Itariki wifuza',
  'requests.new.preferredTime': 'Igihe wifuza',
  'requests.new.budget': 'Ingengo y’amafaranga (RWF)',
  'requests.new.budgetMinAria': 'Ingengo ntoya muri RWF',
  'requests.new.budgetMaxAria': 'Ingengo nini muri RWF',
  'requests.new.minimum': 'Ingano ntoya',
  'requests.new.maximum': 'Ingano nini',
  'requests.new.budgetInverted': 'Ingano nini igomba kuba ihabanye cyangwa iruta iya hasi.',
  'requests.new.budgetHint':
    'Ni ubushake, ariko ibiciro bizagereranywa neza iyo wagaragaje ingano.',
  'requests.new.notes': 'Andi makuru',
  'requests.new.optional': '(ukubyitaho)',
  'requests.new.notesPlaceholder': 'Hari aho bahagarika ibinyabiziga. Ku etaje ya kabiri, nta lifiti.',
  'requests.new.summary': 'Incamake y’isaba',
  'requests.new.summaryService': 'Serivisi',
  'requests.new.sentTo': 'Kohereza',
  'requests.new.selectedProvider': 'umuyobozi wahiswe',
  'requests.new.competition': 'Urugero',
  'requests.new.openToOthers': 'Birahuririjwe abandi',
  'requests.new.private': 'Ryihariye',
  'requests.new.when': 'Igihe',
  'requests.new.flexible': 'Birahuririje',
  'requests.new.budgetLabel': 'Ingengo',
  'requests.new.beforeYouSend': 'Mbere yo kohereza',
  'requests.new.checkService': 'Serivisi yahiswe',
  'requests.new.checkTitle': 'Umutwe warongewe',
  'requests.new.checkDesc': 'Ibisobanuro byongewe',
  'requests.new.checkBudget': 'Ingengo iri mu rugero',
  'requests.new.sending': 'Birimo kohereza…',
  'requests.new.send': 'Ohereza isaba',
  'requests.new.privacyNoteStart':
    'Niba kuganira na {name} bihagire, abandi bayobozi bashobora gutanga ibiciro biciriritse.',
  'requests.new.privacyNoteBold':
    'Wowe uhisemo uwatsinze, n’abayobozi ntibabona ibiciro by’abandi.',
  'requests.new.privacyNoteTail': 'Ntibishyirwa ku gahitamo — isaba ryawe ritangira ryihariye.',
  'requests.new.footerDirectedOpen':
    'Bihanze kuri {name} — abandi bayobozi barashobora gutanga igiciro, ariko buri giciro kibaho hagati yawe n’umuyobozi.',
  'requests.new.footerDirectedPrivate':
    '{name} gusa niwe uzamenyeshwa — isaba ryawe n’ibiciro bisigara ryihariye hagati yanyu.',
  'requests.new.footerOpen':
    'Abayobozi bahuye n’iri saba bazamenyeshwa. Nta mafaranga usabwa muri ici cyarukano.',
  'requests.new.errorService': 'Hitamo serivisi.',
  'requests.new.errorCreate': 'Ntitwashoboye gukora isaba',
  'requests.new.budgetRange': '{min} – {max} RWF',
  'requests.new.budgetUpTo': 'Kugeza {max} RWF',
  'requests.new.budgetFrom': 'Kuva {min} RWF',
  'requests.new.budgetUnspecified': 'Ntibyavuzwe',
  'requests.new.yes': 'Yego',
  'requests.new.no': 'Oya',

  'aiSearch.toggle': 'Shakisha AI',
  'aiSearch.placeholder':
    'Andika ukeneye mu magambo ahambaye — urugero: Nkeneye umuntu uzishyiraho kamera yo kurinda mu duka ryanjye ryato riri mu Kigali.',
  'aiSearch.thinking': 'Ndasome icyo ukuriye…',
  'aiSearch.failed': 'AI ntisobanuye ibi — turakora ishatsha ry’ijambo gusa.',
  'aiSearch.noCriteria': 'Nta bigezwa neza bisobanuye — turagarura abatanga serivisi bwose.',
  'aiSearch.title': 'Shakisha AI',
  'aiSearch.clear': 'Futa ishatsha ry’AI',
  'aiSearch.chipService': 'Serivisi',
  'aiSearch.chipLocation': 'Ahantu',
  'aiSearch.chipBudget': 'Ingengo y’amafaranga',
  'aiSearch.chipExperience': 'Ububumbe',
  'aiSearch.chipVerified': 'Byemejwe',
  'aiSearch.chipRating': 'Amanota',
  'aiSearch.urgencyNormal': 'Igihe gisanzwe',
  'aiSearch.urgencyUrgent': 'Ihutirwa — bamaze ubu',
  'aiSearch.skipped': ' ({count} ntibyashoboye gukoreshwa kandi byagabanyijwe).',
  'aiSearch.skippedPlural': ' ({count} ntibyashoboye gukoreshwa kandi byagabanyijwe).',
} as const;

export const MESSAGES: Record<LocaleCode, Record<MessageKey, string>> = {
  en: EN,
  rw: RW,
};

/**
 * Tiny `{placeholder}` interpolator. A dependency-free stand-in for
 * `Intl.MessageFormat`: the only interpolation this app needs is filling in
 * counts and names, and adding a library for that is a heavier commitment
 * than the feature currently warrants. An unknown key is returned as-is so a
 * typo shows up as `{name}` on screen instead of silently rendering blank.
 */
export function interpolate(template: string, values: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

/** Locale-aware formatters for the dates and numbers translated screens render. */
export function createFormatters(code: LocaleCode) {
  return {
    date: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(code, options ?? { dateStyle: 'medium' }).format(new Date(value)),
    number: (value: number, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(code, options).format(value),
  };
}
