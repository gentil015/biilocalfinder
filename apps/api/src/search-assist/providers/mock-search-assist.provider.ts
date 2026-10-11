import { Injectable } from '@nestjs/common';
import { resolveRwandaLocation } from '../rwanda-locations';
import {
  DEFAULT_SEARCH_ASSIST_LANGUAGE,
  SearchAssistInput,
  SearchAssistLanguage,
  SearchAssistOutput,
  SearchAssistProvider,
  isSearchAssistLanguage,
} from '../search-assist.interface';

// Deterministic, keyword-based stand-in used when no GROQ_API_KEY and no
// GEMINI_API_KEY are configured — keeps local dev, CI, and offline sandboxes
// fully functional, same pattern as MockBookingAssistProvider/MockAssistProvider.
// It only ever fills a criterion whose value it can read straight out of the
// message (catalog service names, known Rwandan places, urgency words,
// stated budgets/years/ratings) — anything it cannot is left out so
// SearchAssistService reports it as skipped rather than guessed.
@Injectable()
export class MockSearchAssistProvider implements SearchAssistProvider {
  async parse(input: SearchAssistInput): Promise<SearchAssistOutput> {
    const raw = this.normalize(input.message);
    const language = this.detectLanguage(raw) ?? input.language;

    const service = this.matchService(raw, input.services);
    const place = resolveRwandaLocation(input.message);
    const urgency = URGENT_RE.test(raw) ? 'urgent' : 'normal';
    const { budgetMin, budgetMax } = this.extractBudget(raw);
    const minExperience = this.extractExperience(raw);
    const minRating = this.extractRating(raw);
    const verifiedOnly = VERIFIED_RE.test(raw);
    const keywords = this.guessKeywords(raw, service, place?.label);

    const out: SearchAssistOutput = {
      language,
      reply: this.reply(language, !!(service || place || budgetMin !== undefined || budgetMax !== undefined)),
      urgency,
    };
    if (service) {
      out.serviceKey = service.key;
      out.serviceName = service.name;
    }
    if (place) out.city = place.label;
    if (budgetMin !== undefined) out.budgetMin = budgetMin;
    if (budgetMax !== undefined) out.budgetMax = budgetMax;
    if (minExperience !== undefined) out.minExperience = minExperience;
    if (minRating !== undefined) out.minRating = minRating;
    if (verifiedOnly) out.verifiedOnly = true;
    if (keywords.length) out.keywords = keywords;
    return out;
  }

  // --- language detection -------------------------------------------------

  private detectLanguage(text: string): SearchAssistLanguage | undefined {
    if (RW_MARKERS.some((m) => text.includes(m))) return 'rw';
    if (FR_MARKERS.some((m) => text.includes(m))) return 'fr';
    if (EN_MARKERS.some((m) => text.includes(m))) return 'en';
    return undefined;
  }

  // Lowercased + diacritics stripped so "réparer" matches "reparer".
  private normalize(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/['’]/g, ' ');
  }

  // --- service matching ---------------------------------------------------

  // Scores each real catalog entry by how many of the message's content
  // words appear in its name/category and keeps the best — the mock can
  // never invent a service that is not in `input.services`, and a message
  // with no overlap resolves to no service at all (the client then sees
  // only the criteria that were readable).
  private matchService(text: string, services: SearchAssistInput['services']) {
    const words = text.split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
    let best: { entry: SearchAssistInput['services'][number]; score: number } | undefined;
    for (const entry of services) {
      // categoryKey is the key's prefix (see buildSearchSystemPrompt) — the
      // mock re-derives it rather than receiving it as a separate field.
      const haystack = this.normalize(`${entry.name} ${entry.key.split('/')[0]}`);
      let score = 0;
      for (const word of words) if (haystack.includes(word)) score += 1;
      if (score > 0 && (!best || score > best.score)) best = { entry, score };
    }
    return best?.entry;
  }

  // --- budget / experience / rating extraction ----------------------------

  private extractBudget(text: string): { budgetMin?: number; budgetMax?: number } {
    // Explicit range: "between 30000 and 60000 RWF", "entre X et Y".
    const pair =
      /\bbetween\b[^0-9]*(\d[\d\s,.]*)[^0-9]*\band\b[^0-9]*(\d[\d\s,.]*)/.exec(text) ??
      /\bentre\b[^0-9]*(\d[\d\s,.]*)[^0-9]*\bet\b[^0-9]*(\d[\d\s,.]*)/.exec(text);
    if (pair) {
      const a = this.toNumber(pair[1]);
      const b = this.toNumber(pair[2]);
      if (a !== undefined && b !== undefined) return { budgetMin: Math.min(a, b), budgetMax: Math.max(a, b) };
    }

    // Only numbers stated next to a money/budget word count — a bare "2
    // days" or "3 rooms" is never treated as a budget.
    const numbers = new Set<number>();
    for (const re of [MONEY_SUFFIX_RE, BUDGET_CONTEXT_RE]) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        const n = this.toNumber(m[1]);
        if (n !== undefined) numbers.add(n);
      }
    }
    const [first, second] = [...numbers];
    if (first === undefined) return {};
    if (second !== undefined) return { budgetMin: Math.min(first, second), budgetMax: Math.max(first, second) };

    const at = text.search(/\d/);
    const window = at >= 0 ? text.slice(Math.max(0, at - 40), at + 40) : '';
    if (/(at least|au moins|minimum|>=|\bmin\b|kuva)/.test(window)) return { budgetMin: first };
    return { budgetMax: first };
  }

  private toNumber(value: string): number | undefined {
    const cleaned = value.replace(/[\s,]/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  }

  private extractExperience(text: string): number | undefined {
    const m =
      /\b(\d+)\s*\+\s*(?:years?|yrs?|ans)\b/.exec(text) ??
      /\b(\d+)\s*(?:years?|yrs?|ans)\s*(?:of\s+)?(?:experience|exp|d'experience|d'experience)\b/.exec(text) ??
      /\b(?:experience|at least|minimum|au moins)\D{0,16}(\d+)\s*(?:years?|yrs?|ans)?\b/.exec(text);
    const n = m ? Number(m[1]) : NaN;
    return Number.isInteger(n) && n >= 0 && n <= 60 ? n : undefined;
  }

  private extractRating(text: string): number | undefined {
    const m =
      /\b(\d(?:\.\d)?)\s*\+?\s*(?:stars?|star rating|rating|amanota)\b/.exec(text) ??
      /\b(?:at least|minimum|au moins|>=)\s*(\d(?:\.\d)?)\s*(?:stars?)\b/.exec(text);
    const n = m ? Number(m[1]) : NaN;
    return Number.isFinite(n) && n >= 1 && n <= 5 ? n : undefined;
  }

  // --- free-text keywords -------------------------------------------------

  // Meaningful leftovers: content words that are not the chosen service's
  // own words, not a known place, and not intent filler — the closest a
  // keyword matcher can get to "expertise terms the service does not cover".
  private guessKeywords(text: string, service?: { name: string; key: string }, placeLabel?: string): string[] {
    const excluded = new Set<string>();
    if (service)
      for (const w of this.normalize(`${service.name} ${service.key.split('/')[0]}`).split(/\s+/))
        excluded.add(w);
    if (placeLabel) excluded.add(this.normalize(placeLabel).split(/\s+/)[0]);

    const out: string[] = [];
    for (const word of text.split(/[^a-z0-9]+/)) {
      if (word.length < 3 || STOPWORDS.has(word) || excluded.has(word)) continue;
      if (resolveRwandaLocation(word)) continue;
      if (out.includes(word)) continue;
      out.push(word);
      if (out.length >= KEYWORD_LIMIT) break;
    }
    return out;
  }

  // --- copy ---------------------------------------------------------------

  private reply(language: string, hasCriteria: boolean): string {
    if (language === 'rw') {
      return hasCriteria
        ? 'Ibi ndabonye — reba ibikurikizwa bya hasi.'
        : 'Nta bigezwa neza bisobanuye — andika serivisi, ahantu n’igihe ukeneye.';
    }
    if (language === 'fr') {
      return hasCriteria
        ? 'Voici ce que j’ai compris — vérifiez les critères ci-dessous.'
        : 'Je n’ai pas lu de critères clairs — précisez le service, le lieu et le moment souhaité.';
    }
    return hasCriteria
      ? 'Here is what I understood — review the search criteria below.'
      : 'I could not read clear criteria from that — try naming the service, the place, and when you need it.';
  }
}

const KEYWORD_LIMIT = 5;

const EN_MARKERS = [' i need ', ' i want ', ' please ', ' my ', ' the ', ' can you ', ' looking for '];
const FR_MARKERS = [
  ' je veux',
  ' je voudrais',
  ' besoin',
  ' pourriez',
  ' pouvez',
  ' combien',
  ' demain',
  ' merci',
  ' nettoy',
  ' repar',
  ' une ',
  ' avec ',
  ' pour ',
  ' dans ',
  ' les ',
];
const RW_MARKERS = [
  ' nshaka ',
  ' nkeneye ',
  ' dukeze ',
  ' mfite ',
  ' nifuza ',
  ' umuvugangi ',
  ' gusuka ',
  ' uwuhe munsi ',
  ' saa ',
  ' arimo ',
  ' ukwiye ',
  ' kugirw',
  ' gukorw',
];

// "Today / now / ASAP" in all three languages — matches the booking mock's
// date vocabulary so the same sentence reads the same way in both features.
const URGENT_RE =
  /\b(urgent|asap|immediately|right now|tonight|today|this morning|quickly|fast|now)\b|\buyu munsi\b|\bnanuho\b|\bvuba\b|\baujourd'?hui\b|\btout de suite\b/;
const VERIFIED_RE = /\b(verified|licensed?|certified|accredited|official)\b|\biyemezw\b/;

const STOPWORDS = new Set([
  'the', 'and', 'for', 'you', 'your', 'that', 'this', 'with', 'have', 'has', 'had',
  'are', 'was', 'were', 'can', 'could', 'would', 'should', 'will', 'shall', 'need',
  'needs', 'want', 'wants', 'looking', 'find', 'hire', 'someone', 'anyone', 'please',
  'about', 'into', 'from', 'near', 'close', 'best', 'good', 'great', 'very', 'much',
  'who', 'what', 'when', 'where', 'how', 'why', 'not', 'but', 'all', 'any', 'one',
  'our', 'their', 'them', 'they', 'she', 'her', 'him', 'his', 'its', 'get', 'got',
  'make', 'makes', 'made', 'well', 'here', 'there', 'then', 'than', 'just', 'also',
  'some', 'more', 'most', 'other', 'only', 'over', 'under', 'out', 'off', 'ago',
  'rwanda', 'kigali', // the city itself never belongs in q — location is its own criterion
]);

const MONEY_SUFFIX_RE = /(\d[\d\s,.]*)\s*(?:rwf|francs?\b|fr\b)/g;
const BUDGET_CONTEXT_RE = /\b(?:budget|price|prix|amafaranga|mararo)\b[^\d]{0,24}(\d[\d\s,.]*)/g;
