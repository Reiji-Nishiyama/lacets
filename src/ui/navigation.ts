import { create } from 'zustand'

export type Screen =
  | { name: 'routes' }
  | { name: 'preview'; routeId: string }
  | { name: 'ride' }
  | { name: 'devices' }
  | { name: 'settings' }

interface NavigationState {
  screen: Screen
  navigate: (screen: Screen) => void
}

export const useNavigation = create<NavigationState>((set) => ({
  screen: { name: 'routes' },
  navigate: (screen) => set({ screen }),
}))
