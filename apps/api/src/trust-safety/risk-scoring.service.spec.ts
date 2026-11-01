import { RiskScoringService } from './risk-scoring.service';

describe('RiskScoringService', () => {
  const service = new RiskScoringService();

  it.each([
    [0, 'LOW'],
    [24, 'LOW'],
    [25, 'MODERATE'],
    [49, 'MODERATE'],
    [50, 'HIGH'],
    [74, 'HIGH'],
    [75, 'CRITICAL'],
  ] as const)('maps a score of %i to %s', (points, expected) => {
    expect(service.score([
      { code: 'signal', severity: 'MODERATE', points, reason: 'Test signal' },
    ])).toEqual({ score: points, level: expected });
  });

  it('caps at 100 and counts each correlated indicator code once', () => {
    expect(
      service.score([
        { code: 'duplicate_identity', severity: 'HIGH', points: 25, reason: 'First check' },
        { code: 'duplicate_identity', severity: 'HIGH', points: 25, reason: 'Repeated check' },
        { code: 'forged_document', severity: 'CRITICAL', points: 100, reason: 'Confirmed evidence' },
      ]),
    ).toEqual({ score: 100, level: 'CRITICAL' });
  });

  it('never produces a negative score', () => {
    expect(
      service.score([{ code: 'invalid', severity: 'LOW', points: -20, reason: 'Invalid input' }]),
    ).toEqual({ score: 0, level: 'LOW' });
  });
});
