import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { GoogleAuthService } from './google-auth.service';

describe('GoogleAuthService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, GOOGLE_WEB_CLIENT_ID: 'web-client-id.apps.googleusercontent.com' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('rejects missing configuration', async () => {
    delete process.env.GOOGLE_WEB_CLIENT_ID;
    delete process.env.GOOGLE_ANDROID_CLIENT_ID;
    delete process.env.GOOGLE_IOS_CLIENT_ID;
    delete process.env.GOOGLE_ALLOWED_AUDIENCES;
    const service = new GoogleAuthService();
    await expect(service.verifyIdToken('token')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps verified payload', async () => {
    const service = new GoogleAuthService();
    (service as any).client = {
      verifyIdToken: jest.fn().mockResolvedValue({
        getPayload: () => ({
          sub: 'google-sub-123',
          email: 'User@Example.com',
          email_verified: true,
          given_name: 'Test',
          family_name: 'User',
          picture: 'https://example.com/a.png',
          iss: 'https://accounts.google.com',
          aud: 'web-client-id.apps.googleusercontent.com',
        }),
      }),
    };

    await expect(service.verifyIdToken('token')).resolves.toEqual({
      sub: 'google-sub-123',
      email: 'user@example.com',
      emailVerified: true,
      firstName: 'Test',
      lastName: 'User',
      avatarUrl: 'https://example.com/a.png',
    });
  });

  it('rejects unverified email', async () => {
    const service = new GoogleAuthService();
    (service as any).client = {
      verifyIdToken: jest.fn().mockResolvedValue({
        getPayload: () => ({
          sub: 'google-sub-123',
          email: 'user@example.com',
          email_verified: false,
          iss: 'https://accounts.google.com',
        }),
      }),
    };
    await expect(service.verifyIdToken('token')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
