import { Injectable } from '@nestjs/common';
import {
  CustomerAssistInput,
  CustomerAssistLanguage,
  CustomerAssistOutput,
  CustomerAssistProvider,
} from '../customer-assist.interface';

// Deterministic, dictionary-based stand-in used when no GROQ_API_KEY and no
// GEMINI_API_KEY are configured — keeps local dev, CI, and offline sandboxes
// fully functional, matching the mock pattern of BookingAssist/SearchAssist.
// Good enough to route obvious keywords ("paint", "isuku", "réparer") to a
// matching service and answer in the right language; the real providers
// handle anything loose.
@Injectable()
export class MockCustomerAssistProvider implements CustomerAssistProvider {
  suggest(input: CustomerAssistInput): Promise<CustomerAssistOutput> {
    const text = input.messages[input.messages.length - 1]?.text ?? '';
    const language = this.detectLanguage(input.language, text);
    const matched = this.matchServices(input.services, text);

    const reply =
      matched.length > 0
        ? this.foundReply(language, matched.map((s) => s.name))
        : this.notFoundReply(language);

    return Promise.resolve({
      language,
      reply,
      serviceKeys: matched.map((s) => s.key),
      categoryKeys: [],
      questions: [],
    });
  }

  // Keyword overlap scoring over the catalog plus a small dictionary of
  // common Rwandan/French terms, so the mock degrades gracefully instead of
  // reasoning about natural language.
  private matchServices(
    services: CustomerAssistInput['services'],
    message: string,
  ): CustomerAssistInput['services'] {
    const words = message
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3);

    const scored = services
      .map((s) => {
        const haystack = `${s.key} ${s.name} ${s.category}`.toLowerCase();
        let score = 0;
        for (const w of words) {
          if (haystack.includes(w)) score += 1;
        }
        for (const [alias, targets] of Object.entries(ALIASES)) {
          if (!words.includes(alias)) continue;
          for (const target of targets) {
            if (haystack.includes(target)) score += 2;
          }
        }
        return { s, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, 3).map((x) => x.s);
  }

  private detectLanguage(hint: CustomerAssistLanguage, text: string): CustomerAssistLanguage {
    const lower = text.toLowerCase();
    const hits = {
      rw: (KNOWN_WORDS.rw.filter((w) => lower.includes(w)).length),
      fr: (KNOWN_WORDS.fr.filter((w) => lower.includes(w)).length),
    };
    if (hits.rw > hits.fr) return 'rw';
    if (hits.fr > 0) return 'fr';
    return hint;
  }

  private foundReply(language: CustomerAssistLanguage, names: string[]): string {
    const list = names.join(', ');
    if (language === 'rw') {
      return `Nabonye ibi bikorwa byihuza n’icyo usaba: ${list}. Kanda ku yabonetse hasi hanyuma ukoze ubusabe.`;
    }
    if (language === 'fr') {
      return `J'ai trouvé des prestations qui correspondent : ${list}. Touchez l'une des suggestions ci-dessous pour commencer.`;
    }
    return `I found services that match: ${list}. Tap one below to get started.`;
  }

  private notFoundReply(language: CustomerAssistLanguage): string {
    if (language === 'rw') {
      return 'Ankitewe n’uko ntibona igikorwa gihuza na byo. Sobanura icyo ukeneye mu magambo make kandi nzakibaza mu buryo butandukanye.';
    }
    if (language === 'fr') {
      return 'Je n’ai pas trouvé de bonne correspondance. Décrivez ce dont vous avez besoin un peu différemment et je réessaierai.';
    }
    return "I didn't find a good match. Try describing what you need a little differently and I'll try again.";
  }
}

// Extra synonyms beyond what string overlap already catches. Targets are
// substrings matched against `<key> <name> <category>`.
const ALIASES: Record<string, string[]> = {
  // English
  laptop: ['computer', 'laptop'],
  pc: ['computer', 'laptop'],
  phone: ['phone', 'smartphone'],
  clean: ['clean', 'cleaning', 'isuku'],
  repair: ['repair', 'fix', 'repar'],
  plumb: ['plumbing', 'plomber'],
  electric: ['electric', 'electrical', 'elektrik'],
  wedding: ['wedding', 'photography', 'dj', 'events'],
  // French
  reparer: ['repair', 'fix', 'repar', 'computer'],
  nettoyer: ['clean', 'cleaning', 'isuku'],
  demenagement: ['moves', 'moving', 'demenage'],
  traduction: ['translation', 'trad'],
  // Kinyarwanda
  gutunganya: ['repair', 'fix', 'repar', 'computer'],
  isuku: ['clean', 'cleaning'],
  kurera: ['baby', 'babysit', 'nanny', 'gardening'],
  gukora: ['repair', 'service'],
};

const KNOWN_WORDS: Record<'rw' | 'fr', string[]> = {
  rw: ['nde', 'gutunganya', 'isuku', 'umunsi', 'ejo', 'nkoresha', 'ubwiza', 'gukosora', 'ibikorwa', 'abakozi'],
  fr: ['demain', 'repare', 'réparer', 'nettoyer', 'cherche', 'quelqu', 'prestataire', 'demander', 'besoin'],
};