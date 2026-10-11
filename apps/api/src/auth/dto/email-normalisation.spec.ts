import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './register.dto';
import { LoginDto } from './login.dto';
import { RequestPasswordResetDto } from './request-password-reset.dto';

// The register/login payloads are normalised by @Transform before anything
// else looks at them, so these go through class-transformer + class-validator
// exactly like the global ValidationPipe does at runtime.
async function normalize<T extends object>(cls: new () => T, plain: Record<string, unknown>): Promise<T> {
  const dto = plainToInstance(cls, plain);
  await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  return dto;
}

describe('email normalisation', () => {
  it.each([
    ['DUSHIMEGENTIL0@GMAIL.COM', 'dushimegentil0@gmail.com'],
    ['  Mixed@Case.com  ', 'mixed@case.com'],
  ])('lowercases and trims %j on register', async (input, expected) => {
    const dto = await normalize(RegisterDto, {
      email: input,
      password: 'password123',
      firstName: 'A',
      lastName: 'B',
      role: 'CLIENT',
    });

    expect(dto.email).toBe(expected);
  });

  it('normalises login identically, so an address is reachable in any casing', async () => {
    const dto = await normalize(LoginDto, { email: '  Mixed@Case.com ', password: 'password123' });

    expect(dto.email).toBe('mixed@case.com');
  });

  it('normalises a password-reset request too — otherwise the lookup misses and no mail is ever sent', async () => {
    const dto = await normalize(RequestPasswordResetDto, { email: '  Mixed@Case.com ' });

    expect(dto.email).toBe('mixed@case.com');
  });

  it('treats an empty phone as absent, not as a value that collides on the unique index', async () => {
    const dto = await normalize(RegisterDto, {
      email: 'a@example.com',
      phone: '',
      password: 'password123',
      firstName: 'A',
      lastName: 'B',
      role: 'CLIENT',
    });

    // undefined (a real SQL NULL) rather than '' -- Postgres does not treat
    // two NULLs as duplicates, but it does treat two '' as a violation.
    expect(dto.phone).toBeUndefined();
  });

  it('keeps a real phone number intact', async () => {
    const dto = await normalize(RegisterDto, {
      email: 'a@example.com',
      phone: '+226701234567',
      password: 'password123',
      firstName: 'A',
      lastName: 'B',
      role: 'CLIENT',
    });

    expect(dto.phone).toBe('+226701234567');
  });
});
