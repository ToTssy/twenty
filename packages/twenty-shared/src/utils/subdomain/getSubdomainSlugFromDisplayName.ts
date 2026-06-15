import { isDefined } from '@/utils/validation/isDefined';

// Keep in sync with SUBDOMAIN_PATTERN (3-30 chars, lowercase alphanumeric and
// hyphens, must start and end with a letter or number).
const SUBDOMAIN_MIN_LENGTH = 3;
const SUBDOMAIN_MAX_LENGTH = 30;

// Turns a human workspace name into a friendly subdomain slug.
// e.g. "Café Münchën Inc." -> "cafe-munchen-inc", "日本語" -> undefined.
// Returns undefined when nothing usable can be derived so callers can fall
// back to a generated name.
export const getSubdomainSlugFromDisplayName = (
  displayName?: string,
): string | undefined => {
  if (!isDefined(displayName)) {
    return undefined;
  }

  const slug = displayName
    .normalize('NFKD')
    // Strip diacritics so accented letters keep their base form.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // Any run of non-alphanumeric characters becomes a single hyphen.
    .replace(/[^a-z0-9]+/g, '-')
    // Drop leading/trailing hyphens.
    .replace(/^-+|-+$/g, '')
    .slice(0, SUBDOMAIN_MAX_LENGTH)
    // Slicing can leave a trailing hyphen, drop it again.
    .replace(/-+$/g, '');

  return slug.length >= SUBDOMAIN_MIN_LENGTH ? slug : undefined;
};
