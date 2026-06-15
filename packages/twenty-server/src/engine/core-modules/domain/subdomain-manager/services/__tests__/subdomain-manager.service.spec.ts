import { type Repository } from 'typeorm';

import { SubdomainManagerService } from 'src/engine/core-modules/domain/subdomain-manager/services/subdomain-manager.service';
import { type TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { type WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

describe('SubdomainManagerService', () => {
  let service: SubdomainManagerService;
  let takenSubdomains: Set<string>;
  let defaultSubdomain: string | undefined;

  const workspaceRepository = {
    findOne: jest.fn(
      ({ where: { subdomain } }: { where: { subdomain: string } }) =>
        Promise.resolve(
          takenSubdomains.has(subdomain) ? { id: 'existing' } : null,
        ),
    ),
  } as unknown as Repository<WorkspaceEntity>;

  const twentyConfigService = {
    get: jest.fn((key: string) =>
      key === 'DEFAULT_SUBDOMAIN' ? defaultSubdomain : undefined,
    ),
  } as unknown as TwentyConfigService;

  beforeEach(() => {
    takenSubdomains = new Set();
    defaultSubdomain = undefined;
    jest.clearAllMocks();
    service = new SubdomainManagerService(
      workspaceRepository,
      twentyConfigService,
    );
  });

  describe('getSubdomainAvailability', () => {
    it('should report a free, valid subdomain as available', async () => {
      const result = await service.getSubdomainAvailability('apple');

      expect(result).toEqual({
        isValid: true,
        available: true,
        suggestedSubdomain: 'apple',
      });
    });

    it('should suggest a numbered variant when the subdomain is taken', async () => {
      takenSubdomains.add('apple');

      const result = await service.getSubdomainAvailability('apple');

      expect(result.isValid).toBe(true);
      expect(result.available).toBe(false);
      expect(result.suggestedSubdomain).toBe('apple-2');
    });

    it('should skip taken numbered variants', async () => {
      takenSubdomains.add('apple');
      takenSubdomains.add('apple-2');
      takenSubdomains.add('apple-3');

      const result = await service.getSubdomainAvailability('apple');

      expect(result.suggestedSubdomain).toBe('apple-4');
    });

    it('should flag an invalid format and still return a usable suggestion', async () => {
      const result = await service.getSubdomainAvailability('A');

      expect(result.isValid).toBe(false);
      expect(result.available).toBe(false);
      expect(result.suggestedSubdomain.length).toBeGreaterThanOrEqual(3);
    });

    it('should flag reserved subdomains as invalid', async () => {
      const result = await service.getSubdomainAvailability('admin');

      expect(result.isValid).toBe(false);
      expect(result.available).toBe(false);
    });

    it('should treat the default subdomain as unavailable', async () => {
      defaultSubdomain = 'mycompany';

      const result = await service.getSubdomainAvailability('mycompany');

      expect(result.isValid).toBe(true);
      expect(result.available).toBe(false);
      expect(result.suggestedSubdomain).toBe('mycompany-2');
    });
  });

  describe('findAvailableSubdomain', () => {
    it('should return the base subdomain when it is free', async () => {
      expect(await service.findAvailableSubdomain('acme')).toBe('acme');
    });

    it('should append a numbered suffix when the base is taken', async () => {
      takenSubdomains.add('acme');

      expect(await service.findAvailableSubdomain('acme')).toBe('acme-2');
    });

    it('should slugify an invalid base before searching', async () => {
      expect(await service.findAvailableSubdomain('Acme Corp!!')).toBe(
        'acme-corp',
      );
    });
  });

  describe('generateSubdomain', () => {
    it('should derive a subdomain from a work email', async () => {
      expect(
        await service.generateSubdomain({ userEmail: 'john@acme.com' }),
      ).toBe('acme');
    });

    it('should derive a subdomain from the workspace display name', async () => {
      expect(
        await service.generateSubdomain({ workspaceDisplayName: 'Acme Inc' }),
      ).toBe('acme-inc');
    });

    it('should avoid collisions with a numbered suffix', async () => {
      takenSubdomains.add('acme');

      expect(
        await service.generateSubdomain({ userEmail: 'john@acme.com' }),
      ).toBe('acme-2');
    });
  });
});
