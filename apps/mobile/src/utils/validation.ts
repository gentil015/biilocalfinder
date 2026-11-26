import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address');
export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');
export const uuidSchema = z.string().uuid('Invalid selection');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password'),
});

export const registerSchema = z
  .object({
    firstName: z.string().trim().min(2, 'Enter your first name'),
    lastName: z.string().trim().min(2, 'Enter your last name'),
    email: emailSchema,
    phone: z.string().trim().optional(),
    password: passwordSchema,
    role: z.enum(['CLIENT', 'PROVIDER']),
    termsAccepted: z.literal(true),
  });

export const registerFormSchema = registerSchema.extend({
  termsAccepted: z.boolean().refine((value) => value, {
    message: 'You must accept the terms to continue',
  }),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Missing reset token'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const otpSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

export const serviceRequestSchema = z.object({
  serviceId: uuidSchema,
  providerId: uuidSchema.optional(),
  serviceOfferingId: uuidSchema.optional(),
  title: z.string().trim().min(4, 'Add a short title'),
  description: z.string().trim().min(10, 'Describe the work in a little more detail'),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a preferred date'),
  preferredTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM').optional().or(z.literal('')),
  budgetMin: z.number().min(0).optional(),
  budgetMax: z.number().min(0).optional(),
  additionalNotes: z.string().max(2000).optional(),
  locationId: uuidSchema.optional(),
  images: z.array(z.string()).max(5).optional(),
});

export const serviceRequestFormSchema = serviceRequestSchema.extend({
  budgetMin: z.union([z.literal(''), z.coerce.number().min(0)]).optional(),
  budgetMax: z.union([z.literal(''), z.coerce.number().min(0)]).optional(),
});

export const offeringSchema = z.object({
  serviceId: uuidSchema,
  title: z.string().trim().max(120).optional(),
  description: z.string().trim().max(4000).optional(),
  basePrice: z.number().min(0).optional(),
  priceType: z.enum(['FIXED', 'HOURLY', 'PER_DAY', 'STARTING_FROM', 'CUSTOM_QUOTE']),
  duration: z.string().trim().max(100).optional(),
});

export const offeringFormSchema = z.object({
  serviceId: uuidSchema,
  title: z.string().trim().max(120).optional(),
  description: z.string().trim().max(4000).optional(),
  basePrice: z
    .string()
    .optional()
    .refine((value) => !value || (Number.isFinite(Number(value)) && Number(value) >= 0), 'Enter a valid price'),
  priceType: z.enum(['FIXED', 'HOURLY', 'PER_DAY', 'STARTING_FROM', 'CUSTOM_QUOTE']),
  duration: z.string().trim().max(100).optional(),
});

export const quoteSchema = z.object({
  requestId: uuidSchema,
  price: z.number().min(0, 'Enter a valid price'),
  estimatedDuration: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  materials: z.string().max(1000).optional(),
});

export const quoteFormSchema = z.object({
  requestId: uuidSchema,
  price: z
    .string()
    .min(1, 'Enter a valid price')
    .refine((value) => Number.isFinite(Number(value)) && Number(value) >= 0, 'Enter a valid price'),
  estimatedDuration: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  materials: z.string().max(1000).optional(),
});

export const providerProfileSchema = z.object({
  businessName: z.string().trim().min(2, 'Enter a business or professional name'),
  description: z.string().trim().max(4000).optional(),
  phone: z.string().trim().max(30).optional(),
  yearsOfExperience: z.number().int().min(0).max(60).optional(),
  serviceRadiusKm: z.number().min(1).max(200).optional(),
});

export const providerOnboardingFormSchema = z.object({
  providerType: z.enum(['INDIVIDUAL', 'TEAM', 'BUSINESS', 'AGENCY']),
  businessName: z.string().trim().min(2, 'Enter a business or professional name'),
  bio: z.string().trim().max(4000).optional(),
  phone: z.string().trim().max(30).optional(),
  registrationNumber: z.string().trim().max(100).optional(),
  representativeName: z.string().trim().max(120).optional(),
  teamSize: z.string().optional(),
});

export const providerProfileFormSchema = z.object({
  businessName: z.string().trim().min(2, 'Enter a business or professional name'),
  description: z.string().trim().max(4000).optional(),
  phone: z.string().trim().max(30).optional(),
  yearsOfExperience: z.string().optional(),
  serviceRadiusKm: z.string().optional(),
});

export const weeklySlotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  isActive: z.boolean().optional(),
});
