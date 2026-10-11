import { ServiceUnavailableException } from '@nestjs/common';
import { GeminiBookingAssistProvider } from './gemini-booking-assist.provider';
import { BookingAssistInput } from '../booking-assist.interface';

const INPUT: BookingAssistInput = {
  language: 'en',
  messages: [{ role: 'user', text: 'I need a plumber tomorrow' }],
  services: [{ key: 'plumbing/leak', name: 'Leak detection and pipe repair', category: 'Plumbing' }],
  attributes: [],
};

function geminiResponse(text: string) {
  return {
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  };
}

describe('GeminiBookingAssistProvider', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.GEMINI_API_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
    jest.restoreAllMocks();
  });

  function makeProvider() {
    process.env.GEMINI_API_KEY = 'test-key';
    return new GeminiBookingAssistProvider();
  }

  it('calls Gemini with the key in a header (never a URL) and JSON mode, then parses the output', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      geminiResponse(JSON.stringify({ language: 'fr', serviceKey: 'plumbing/leak', title: 'Fuite' })),
    );
    global.fetch = fetchMock as any;

    const out = await makeProvider().suggest(INPUT);

    expect(out).toEqual({ language: 'fr', serviceKey: 'plumbing/leak', title: 'Fuite' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('generativelanguage.googleapis.com');
    expect(url).toContain(':generateContent');
    expect(url).not.toContain('test-key');
    expect(init.headers['x-goog-api-key']).toBe('test-key');

    const body = JSON.parse(init.body);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.systemInstruction.parts[0].text).toContain('Never invent');
    expect(body.contents[body.contents.length - 1].role).toBe('user');
    expect(body.contents[body.contents.length - 1].parts[0].text).toContain('I need a plumber tomorrow');
  });

  it('strips a stray markdown fence instead of failing to parse', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      geminiResponse('```json\n{"language":"rw","title":"Impuguke"}\n```'),
    ) as any;

    const out = await makeProvider().suggest(INPUT);

    expect(out.language).toBe('rw');
    expect(out.title).toBe('Impuguke');
  });

  it('fails closed on unparseable model output rather than passing junk on', async () => {
    global.fetch = jest.fn().mockResolvedValue(geminiResponse('sorry, I cannot do that')) as any;

    const out = await makeProvider().suggest(INPUT);

    expect(out).toEqual({});
  });

  it('maps a non-2xx response to a 503 the frontend can fall back from', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) }) as any;

    await expect(makeProvider().suggest(INPUT)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('maps a network failure to a 503 the frontend can fall back from', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNRESET')) as any;

    await expect(makeProvider().suggest(INPUT)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('maps an empty candidate to a 503 instead of returning nothing quietly', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [] }),
    }) as any;

    await expect(makeProvider().suggest(INPUT)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
