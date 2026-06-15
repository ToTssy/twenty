import { getSubdomainValidationSchema } from '@/settings/domains/utils/getSubdomainValidationSchema';
import { useLazyQuery } from '@apollo/client/react';
import { useEffect, useMemo, useState } from 'react';
import {
  getSubdomainSlugFromDisplayName,
  isDefined,
} from 'twenty-shared/utils';
import { useDebounce } from 'use-debounce';
import { CheckWorkspaceSubdomainAvailabilityDocument } from '~/generated-metadata/graphql';

export type SubdomainFieldStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'unavailable'
  | 'invalid';

const AVAILABILITY_CHECK_DEBOUNCE_MS = 400;

// Common free email providers we don't want to seed a subdomain from.
const FREE_EMAIL_DOMAIN_LABELS = new Set([
  'gmail',
  'googlemail',
  'outlook',
  'hotmail',
  'live',
  'msn',
  'yahoo',
  'ymail',
  'icloud',
  'me',
  'aol',
  'proton',
  'protonmail',
  'gmx',
  'zoho',
  'yandex',
]);

const getSeedBaseFromEmail = (email?: string): string | undefined => {
  if (!isDefined(email)) {
    return undefined;
  }

  const domainLabel = email.split('@')[1]?.split('.')[0]?.toLowerCase();

  if (!isDefined(domainLabel) || FREE_EMAIL_DOMAIN_LABELS.has(domainLabel)) {
    return undefined;
  }

  return getSubdomainSlugFromDisplayName(domainLabel);
};

// Powers the onboarding subdomain picker: auto-fills an available subdomain from
// the workspace name (seeded from the user's work email) until the user takes
// manual control, then reports live availability of the manually typed value.
export const useWorkspaceSubdomainField = ({
  workspaceName,
  seedEmail,
}: {
  workspaceName: string;
  seedEmail?: string;
}) => {
  const subdomainSchema = useMemo(() => getSubdomainValidationSchema(), []);

  const [subdomain, setSubdomain] = useState('');
  const [isManuallyEdited, setIsManuallyEdited] = useState(false);
  const [status, setStatus] = useState<SubdomainFieldStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [suggestion, setSuggestion] = useState<string | undefined>();

  const [checkAvailabilityQuery] = useLazyQuery(
    CheckWorkspaceSubdomainAvailabilityDocument,
    { fetchPolicy: 'no-cache' },
  );

  const seedBase = useMemo(() => getSeedBaseFromEmail(seedEmail), [seedEmail]);

  // While the user hasn't taken control, the name drives the subdomain, falling
  // back to the email-derived seed before any name is typed.
  const autofillBase = isManuallyEdited
    ? undefined
    : (getSubdomainSlugFromDisplayName(workspaceName) ?? seedBase);
  const [debouncedAutofillBase] = useDebounce(
    autofillBase,
    AVAILABILITY_CHECK_DEBOUNCE_MS,
  );

  const manualValue = isManuallyEdited ? subdomain : undefined;
  const [debouncedManualValue] = useDebounce(
    manualValue,
    AVAILABILITY_CHECK_DEBOUNCE_MS,
  );

  // Autofill flow: adopt the available suggestion derived from name/email.
  useEffect(() => {
    if (isManuallyEdited) {
      return;
    }

    if (!isDefined(debouncedAutofillBase)) {
      setSubdomain('');
      setStatus('idle');
      setSuggestion(undefined);
      return;
    }

    let isCancelled = false;

    setStatus('checking');

    checkAvailabilityQuery({ variables: { subdomain: debouncedAutofillBase } })
      .then(({ data }) => {
        if (isCancelled) {
          return;
        }

        const result = data?.checkWorkspaceSubdomainAvailability;

        if (!isDefined(result)) {
          setStatus('idle');
          return;
        }

        setSubdomain(result.suggestedSubdomain);
        setStatus('available');
        setErrorMessage(undefined);
        setSuggestion(undefined);
      })
      .catch(() => {
        if (!isCancelled) {
          setStatus('idle');
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [debouncedAutofillBase, isManuallyEdited, checkAvailabilityQuery]);

  // Manual flow: report availability for the value the user typed.
  useEffect(() => {
    if (
      !isManuallyEdited ||
      !isDefined(debouncedManualValue) ||
      debouncedManualValue === ''
    ) {
      return;
    }

    const validation = subdomainSchema.safeParse(debouncedManualValue);

    if (!validation.success) {
      setStatus('invalid');
      setErrorMessage(validation.error.issues[0].message);
      setSuggestion(undefined);
      return;
    }

    let isCancelled = false;

    setErrorMessage(undefined);
    setStatus('checking');

    checkAvailabilityQuery({ variables: { subdomain: debouncedManualValue } })
      .then(({ data }) => {
        if (isCancelled) {
          return;
        }

        const result = data?.checkWorkspaceSubdomainAvailability;

        if (!isDefined(result)) {
          setStatus('idle');
          return;
        }

        if (!result.isValid) {
          setStatus('invalid');
          setSuggestion(undefined);
          return;
        }

        if (result.available) {
          setStatus('available');
          setSuggestion(undefined);
          return;
        }

        setStatus('unavailable');
        setSuggestion(result.suggestedSubdomain);
      })
      .catch(() => {
        if (!isCancelled) {
          setStatus('idle');
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [
    debouncedManualValue,
    isManuallyEdited,
    checkAvailabilityQuery,
    subdomainSchema,
  ]);

  const handleSubdomainChange = (value: string) => {
    const normalized = value.trim().toLowerCase();

    // Clearing the field hands control back to name-based autofill.
    if (normalized === '') {
      setIsManuallyEdited(false);
      setSubdomain('');
      setErrorMessage(undefined);
      setSuggestion(undefined);
      setStatus('idle');
      return;
    }

    setIsManuallyEdited(true);
    setSubdomain(normalized);

    const validation = subdomainSchema.safeParse(normalized);

    if (!validation.success) {
      setStatus('invalid');
      setErrorMessage(validation.error.issues[0].message);
      setSuggestion(undefined);
      return;
    }

    setErrorMessage(undefined);
    setStatus('checking');
  };

  const applySuggestion = () => {
    if (!isDefined(suggestion)) {
      return;
    }

    setIsManuallyEdited(true);
    setSubdomain(suggestion);
    setStatus('available');
    setErrorMessage(undefined);
    setSuggestion(undefined);
  };

  return {
    subdomain,
    status,
    errorMessage,
    suggestion,
    isAvailable: status === 'available',
    handleSubdomainChange,
    applySuggestion,
  };
};
