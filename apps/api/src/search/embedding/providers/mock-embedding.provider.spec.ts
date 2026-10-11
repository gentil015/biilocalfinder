import { MockEmbeddingProvider } from './mock-embedding.provider';

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // both vectors are already unit-normalized by the provider
}

describe('MockEmbeddingProvider', () => {
  const provider = new MockEmbeddingProvider();

  it('produces a unit-length vector of the configured dimensionality', async () => {
    const vector = await provider.embed('emergency plumbing repairs');
    expect(vector).not.toBeNull();
    expect(vector).toHaveLength(provider.dimensions);
    const norm = Math.sqrt(vector!.reduce((sum, v) => sum + v * v, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it('is deterministic — the same text always hashes to the same vector', async () => {
    const a = await provider.embed('leaking tap in the kitchen');
    const b = await provider.embed('leaking tap in the kitchen');
    expect(a).toEqual(b);
  });

  it('returns null for text with no usable tokens', async () => {
    expect(await provider.embed('')).toBeNull();
    expect(await provider.embed('   !!! ---')).toBeNull();
  });

  it('gives texts with more shared words a higher cosine similarity than texts sharing none', async () => {
    const query = await provider.embed('leaking tap kitchen');
    const overlapping = await provider.embed('kitchen tap leaking urgently');
    const unrelated = await provider.embed('wedding photography drone');

    const simOverlap = cosine(query!, overlapping!);
    const simUnrelated = cosine(query!, unrelated!);
    expect(simOverlap).toBeGreaterThan(simUnrelated);
  });
});
