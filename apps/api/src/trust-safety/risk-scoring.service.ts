import { Injectable } from '@nestjs/common';

export interface RiskContribution {
  code: string;
  severity: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  points: number;
  reason: string;
  evidenceReference?: string;
}

export interface RiskScore {
  score: number;
  level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
}

@Injectable()
export class RiskScoringService {
  score(contributions: RiskContribution[]): RiskScore {
    const unique = new Map<string, RiskContribution>();
    for (const contribution of contributions) {
      if (!unique.has(contribution.code)) unique.set(contribution.code, contribution);
    }

    const score = Math.max(0, Math.min(100, [...unique.values()].reduce((total, item) => total + item.points, 0)));
    if (score >= 75) return { score, level: 'CRITICAL' };
    if (score >= 50) return { score, level: 'HIGH' };
    if (score >= 25) return { score, level: 'MODERATE' };
    return { score, level: 'LOW' };
  }
}
