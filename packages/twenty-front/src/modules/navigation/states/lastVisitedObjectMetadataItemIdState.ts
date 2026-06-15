import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

export const lastVisitedObjectMetadataItemIdState = createAtomState<
  string | null
>({
  key: 'lastVisitedObjectMetadataItemIdState',
  defaultValue: null,
  useLocalStorage: true,
  // This atom is only ever read imperatively (store.get) and never subscribed
  // through a hook, so it never mounts/hydrates from localStorage on its own.
  // getOnInit makes store.get return the persisted value on a fresh load,
  // otherwise the home redirect always falls back to the alphabetically-first
  // object instead of the last-visited one.
  localStorageOptions: { getOnInit: true },
});
