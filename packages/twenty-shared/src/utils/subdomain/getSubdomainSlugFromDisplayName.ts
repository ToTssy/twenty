import { isDefined } from '@/utils/validation/isDefined';

const SUBDOMAIN_MIN_LENGTH = 3;
const SUBDOMAIN_MAX_LENGTH = 30;

export const getSubdomainSlugFromDisplayName = (
  displayName?: string,
): string | undefined => {
  if (!isDefined(displayName)) {
    return undefined;
  }

  const slug = displayName
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SUBDOMAIN_MAX_LENGTH)
    .replace(/-+$/g, '');

  return slug.length >= SUBDOMAIN_MIN_LENGTH ? slug : undefined;
};
