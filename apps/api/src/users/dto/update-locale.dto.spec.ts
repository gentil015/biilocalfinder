import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateLocaleDto } from './update-locale.dto';

// Mirrors the global ValidationPipe in src/main.ts (whitelist +
// forbidNonWhitelisted + transform), so these assertions are about what the
// endpoint actually accepts, not about the decorators in isolation.
async function parse(plain: Record<string, unknown>) {
  const dto = plainToInstance(UpdateLocaleDto, plain);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  return { dto, errors };
}

describe('UpdateLocaleDto', () => {
  it.each(['en', 'rw'])('accepts the supported tag %j', async (locale) => {
    const { dto, errors } = await parse({ locale });

    expect(errors).toHaveLength(0);
    expect(dto.locale).toBe(locale);
  });

  // The column is a plain TEXT, so this check is the only thing standing
  // between a client and a locale nothing can render — an unknown tag would
  // otherwise be persisted and fall back silently at every call site.
  it.each(['fr', 'EN', 'rw-RW', 'en-GB', '', 'rw; DROP TABLE users'])(
    'rejects %j',
    async (locale) => {
      const { errors } = await parse({ locale });

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('locale');
    },
  );

  it('rejects a missing locale rather than defaulting it', async () => {
    // Defaulting here would silently discard a client's explicit choice, and a
    // PATCH with no field is a client bug worth surfacing.
    const { errors } = await parse({});

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('locale');
  });

  it('rejects extra fields, as forbidNonWhitelisted does at runtime', async () => {
    const { errors } = await parse({ locale: 'rw', role: 'ADMIN' });

    expect(errors.map((e) => e.property)).toEqual(expect.arrayContaining(['role']));
  });
});
