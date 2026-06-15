import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Provider as JotaiProvider } from 'jotai';
import { SOURCE_LOCALE } from 'twenty-shared/translations';
import { ThemeProvider } from 'twenty-ui-deprecated/theme-constants';

import { SignInUpWorkspaceCreationForm } from '@/auth/sign-in-up/components/internal/SignInUpWorkspaceCreationForm';
import {
  jotaiStore,
  resetJotaiStore,
} from '@/ui/utilities/state/jotai/jotaiStore';
import { dynamicActivate } from '~/utils/i18n/dynamicActivate';

const createWorkspaceMock = jest.fn();
const applySuggestionMock = jest.fn();
const handleSubdomainChangeMock = jest.fn();
const useWorkspaceSubdomainFieldMock = jest.fn();

jest.mock('@/auth/sign-in-up/hooks/useSignUpInNewWorkspace', () => ({
  useSignUpInNewWorkspace: () => ({ createWorkspace: createWorkspaceMock }),
}));

jest.mock('@/auth/sign-in-up/hooks/useWorkspaceSubdomainField', () => ({
  useWorkspaceSubdomainField: () => useWorkspaceSubdomainFieldMock(),
}));

dynamicActivate(SOURCE_LOCALE);

const renderForm = () =>
  render(
    <JotaiProvider store={jotaiStore}>
      <ThemeProvider colorScheme="light">
        <I18nProvider i18n={i18n}>
          <SignInUpWorkspaceCreationForm />
        </I18nProvider>
      </ThemeProvider>
    </JotaiProvider>,
  );

describe('SignInUpWorkspaceCreationForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetJotaiStore();
    useWorkspaceSubdomainFieldMock.mockReturnValue({
      subdomain: 'apple',
      status: 'available',
      errorMessage: undefined,
      suggestion: undefined,
      isAvailable: true,
      handleSubdomainChange: handleSubdomainChangeMock,
      applySuggestion: applySuggestionMock,
    });
  });

  it('keeps Continue disabled until a workspace name is entered', () => {
    renderForm();

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('creates the workspace with the chosen name and subdomain in the same tab', async () => {
    createWorkspaceMock.mockResolvedValue(undefined);

    renderForm();

    fireEvent.change(screen.getByLabelText('Workspace name'), {
      target: { value: 'Apple' },
    });

    const continueButton = screen.getByRole('button', { name: 'Continue' });

    expect(continueButton).toBeEnabled();

    await act(async () => {
      fireEvent.click(continueButton);
    });

    expect(createWorkspaceMock).toHaveBeenCalledWith({
      displayName: 'Apple',
      subdomain: 'apple',
      newTab: false,
    });
  });

  it('offers a one-click suggestion when the address is taken', () => {
    useWorkspaceSubdomainFieldMock.mockReturnValue({
      subdomain: 'apple',
      status: 'unavailable',
      errorMessage: undefined,
      suggestion: 'apple-2',
      isAvailable: false,
      handleSubdomainChange: handleSubdomainChangeMock,
      applySuggestion: applySuggestionMock,
    });

    renderForm();

    fireEvent.change(screen.getByLabelText('Workspace name'), {
      target: { value: 'Apple' },
    });

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();

    fireEvent.click(screen.getByText('Use apple-2 instead'));

    expect(applySuggestionMock).toHaveBeenCalledTimes(1);
  });
});
