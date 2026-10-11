import { EmbeddingIndexService, toVectorLiteral } from './embedding-index.service';

describe('toVectorLiteral', () => {
  it('formats a number array as a pgvector literal', () => {
    expect(toVectorLiteral([0.1, -0.2, 0])).toBe('[0.1,-0.2,0]');
  });

  it('substitutes 0 for a non-finite value rather than emitting invalid SQL', () => {
    expect(toVectorLiteral([1, NaN, Infinity])).toBe('[1,0,0]');
  });
});

describe('EmbeddingIndexService.buildEmbeddingText', () => {
  const service = new EmbeddingIndexService({} as any, {} as any, {} as any);

  it('combines category, service, and offering fields into one string', () => {
    const text = service.buildEmbeddingText({
      id: 'off-1',
      title: 'Emergency Plumbing Repairs',
      description: 'Same-day fixes for leaks, burst pipes, and blocked drains.',
      service: {
        name: 'Plumbing',
        description: 'General plumbing services',
        category: { name: 'Home Repair' },
      },
    });
    expect(text).toContain('Home Repair');
    expect(text).toContain('Plumbing');
    expect(text).toContain('Emergency Plumbing Repairs');
    expect(text).toContain('leaks, burst pipes');
  });

  it('skips missing optional fields rather than inserting empty segments', () => {
    const text = service.buildEmbeddingText({
      id: 'off-2',
      title: null,
      description: null,
      service: { name: 'Plumbing', description: null, category: { name: 'Home Repair' } },
    });
    expect(text).toBe('Home Repair. Plumbing');
  });
});
