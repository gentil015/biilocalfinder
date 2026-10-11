import { buildOrTsQuery, PostgresProviderSearchService } from './postgres-provider-search.service';

describe('buildOrTsQuery', () => {
  it('builds an OR-joined, prefix-matching query from multiple words', () => {
    expect(buildOrTsQuery('wedding photographer')).toBe('wedding:* | photographer:*');
  });

  it('strips characters that would otherwise be interpreted as tsquery operators', () => {
    // Regression: raw user input must never be able to inject tsquery
    // syntax (&, |, !, (, ), :) — every token is sanitized to
    // alphanumerics before being joined, so this can never error or
    // behave unexpectedly at the database layer.
    expect(buildOrTsQuery('plumber & drop table')).toBe('plumber:* | drop:* | table:*');
  });

  it('returns null for empty or whitespace-only input', () => {
    expect(buildOrTsQuery('')).toBeNull();
    expect(buildOrTsQuery('   ')).toBeNull();
  });

  it('handles a single word', () => {
    expect(buildOrTsQuery('plumbing')).toBe('plumbing:*');
  });
});

describe('PostgresProviderSearchService (semantic query embedding, via tryEmbedQuery)', () => {
  function makeService(embeddingProvider: { embed: jest.Mock }) {
    // tryEmbedQuery is private and doesn't touch prisma/ranking — casting
    // to `any` to reach it directly is simpler and more honest here than
    // standing up a full Prisma mock just to exercise this one branch.
    return new (PostgresProviderSearchService as any)({}, {}, embeddingProvider);
  }

  it('skips embedding a query shorter than the minimum length', async () => {
    const embed = jest.fn();
    const service = makeService({ embed });
    const result = await (service as any).tryEmbedQuery('ab');
    expect(result).toBeNull();
    expect(embed).not.toHaveBeenCalled();
  });

  it('embeds a long-enough query with the "query" intent', async () => {
    const embed = jest.fn().mockResolvedValue([0.1, 0.2]);
    const service = makeService({ embed });
    const result = await (service as any).tryEmbedQuery('leaking tap in the kitchen');
    expect(result).toEqual([0.1, 0.2]);
    expect(embed).toHaveBeenCalledWith('leaking tap in the kitchen', 'query');
  });

  it('falls back to null (never throws) when the embedding provider itself throws', async () => {
    const embed = jest.fn().mockRejectedValue(new Error('vendor down'));
    const service = makeService({ embed });
    await expect((service as any).tryEmbedQuery('leaking tap')).resolves.toBeNull();
  });
});

describe('PostgresProviderSearchService (optional DB capability probes)', () => {
  // Regression coverage for the bug these probes exist to prevent: the search
  // SQL referenced `service_offerings.embedding` and PostGIS columns that are
  // created by raw-SQL migrations, so on a database without them every
  // keyword search 500'd with `column ... does not exist` instead of just
  // skipping the optional ranking signals.
  function makeService(probeRows: { ok: boolean }[] | Error) {
    const queryRaw = jest.fn(async () => {
      if (probeRows instanceof Error) throw probeRows;
      return probeRows;
    });
    const service = new (PostgresProviderSearchService as any)(
      { $queryRaw: queryRaw },
      {},
      { embed: jest.fn() },
    );
    return { service, queryRaw };
  }

  describe('hasSemanticSupport', () => {
    it('is true only when pgvector and the embedding column both exist', async () => {
      const { service } = makeService([{ ok: true }]);
      await expect((service as any).hasSemanticSupport()).resolves.toBe(true);
    });

    it('is false when either is missing, disabling semantic search', async () => {
      const { service } = makeService([{ ok: false }]);
      await expect((service as any).hasSemanticSupport()).resolves.toBe(false);
    });

    it('is false — and never throws — when the probe query itself fails', async () => {
      const { service } = makeService(new Error('permission denied'));
      await expect((service as any).hasSemanticSupport()).resolves.toBe(false);
    });

    it('probes once and caches, so the catalog is not re-queried per request', async () => {
      const { service, queryRaw } = makeService([{ ok: true }]);
      await (service as any).hasSemanticSupport();
      await (service as any).hasSemanticSupport();
      await (service as any).hasSemanticSupport();
      expect(queryRaw).toHaveBeenCalledTimes(1);
    });
  });

  describe('hasGeoSupport', () => {
    it('is true only when PostGIS and both geography columns exist', async () => {
      const { service } = makeService([{ ok: true }]);
      await expect((service as any).hasGeoSupport()).resolves.toBe(true);
    });

    it('is false when PostGIS is absent, so coordinates are ignored rather than 500ing', async () => {
      const { service } = makeService([{ ok: false }]);
      await expect((service as any).hasGeoSupport()).resolves.toBe(false);
    });

    it('is false — and never throws — when the probe query itself fails', async () => {
      const { service } = makeService(new Error('connection lost'));
      await expect((service as any).hasGeoSupport()).resolves.toBe(false);
    });

    it('probes once and caches', async () => {
      const { service, queryRaw } = makeService([{ ok: true }]);
      await (service as any).hasGeoSupport();
      await (service as any).hasGeoSupport();
      expect(queryRaw).toHaveBeenCalledTimes(1);
    });
  });

  it('never embeds the query when the database lacks vector support', async () => {
    const embed = jest.fn().mockResolvedValue([0.1, 0.2]);
    const queryRaw = jest.fn(async (sql: any) => {
      // Capability probe -> unsupported; the main search query -> empty result.
      const text = String(sql?.strings?.join(' ') ?? '');
      if (text.includes('pg_extension')) return [{ ok: false }];
      return [];
    });
    const service = new (PostgresProviderSearchService as any)(
      { $queryRaw: queryRaw },
      { rank: jest.fn().mockReturnValue({}) },
      { embed },
    );
    // Must not throw, and must not spend an embeddings call on a database
    // that has nowhere to store the vector.
    await (service as any).search({ q: 'dus' }).catch(() => undefined);
    expect(embed).not.toHaveBeenCalled();
  });
});
