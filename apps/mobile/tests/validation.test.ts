import { loginSchema, registerFormSchema, serviceRequestFormSchema } from '@/src/utils/validation';

describe('validation schemas', () => {
  it('accepts valid login details', () => {
    expect(loginSchema.safeParse({ email: 'CLIENT@Example.com', password: 'secret' }).success).toBe(true);
  });

  it('rejects invalid email addresses', () => {
    expect(loginSchema.safeParse({ email: 'nope', password: 'secret' }).success).toBe(false);
  });

  it('requires terms acceptance for registration', () => {
    const base = {
      firstName: 'Aline',
      lastName: 'Umuhoza',
      email: 'aline@example.com',
      password: 'password123',
      role: 'CLIENT' as const,
    };
    expect(registerFormSchema.safeParse({ ...base, termsAccepted: false }).success).toBe(false);
    expect(registerFormSchema.safeParse({ ...base, termsAccepted: true }).success).toBe(true);
  });

  it('validates service request dates and budgets', () => {
    const base = {
      serviceId: '2f2f5e9e-1111-4222-8333-444444444444',
      title: 'Garden cleanup',
      description: 'Please mow and clear the front garden.',
      preferredDate: '2026-12-15',
      budgetMin: '',
      budgetMax: '25000',
    };
    expect(serviceRequestFormSchema.safeParse(base).success).toBe(true);
    expect(serviceRequestFormSchema.safeParse({ ...base, preferredDate: '15/12/2026' }).success).toBe(false);
  });
});
