import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProfessionalProfileService } from './professional-profile.service';

describe('ProfessionalProfileService', () => {
  let service: ProfessionalProfileService;
  let prisma: any;
  let providerContext: any;

  beforeEach(() => {
    prisma = {
      providerExperience: {
        count: jest.fn().mockResolvedValue(2),
        create: jest.fn((args) => args.data),
        findUnique: jest.fn(),
        update: jest.fn((args) => args.data),
        delete: jest.fn(),
        findMany: jest.fn(),
      },
      providerEducation: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn((args) => args.data),
        findUnique: jest.fn(),
        update: jest.fn((args) => args.data),
        delete: jest.fn(),
        findMany: jest.fn(),
      },
    };
    providerContext = { resolveForUser: jest.fn().mockResolvedValue({ id: 'provider-1' }) };
    service = new ProfessionalProfileService(prisma, providerContext);
  });

  it('creates a current experience with a trimmed title and no end date', async () => {
    const result = await service.createExperience('user-1', {
      title: '  Senior electrician ',
      organization: ' Kigali Power ',
      location: '  ',
      startDate: '2020-01-01',
      endDate: '2021-01-01',
      isCurrent: true,
    });

    expect(result).toMatchObject({
      providerId: 'provider-1',
      title: 'Senior electrician',
      organization: 'Kigali Power',
      location: null,
      endDate: null,
      isCurrent: true,
      position: 2,
    });
  });

  it('rejects an end date before the start date', async () => {
    await expect(
      service.createExperience('user-1', {
        title: 'Electrician',
        organization: 'Kigali Power',
        startDate: '2022-01-01',
        endDate: '2021-01-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.providerExperience.create).not.toHaveBeenCalled();
  });

  it('will not edit another provider’s experience entry', async () => {
    prisma.providerExperience.findUnique.mockResolvedValue({ id: 'exp-1', providerId: 'someone-else' });

    await expect(service.updateExperience('user-1', 'exp-1', { title: 'Mine now' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.providerExperience.update).not.toHaveBeenCalled();
  });

  it('creates education with optional fields left null', async () => {
    const result = await service.createEducation('user-1', { school: ' KIST ', degree: '  ' });

    expect(result).toMatchObject({
      providerId: 'provider-1',
      school: 'KIST',
      degree: null,
      fieldOfStudy: null,
      startDate: null,
      endDate: null,
    });
  });
});
