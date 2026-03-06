/**
 * Reactive State Management
 * Simple pub/sub pattern for vanilla TypeScript
 * No dependencies, client-side only
 */

type Listener<T> = (value: T) => void;
type Unsubscribe = () => void;

/**
 * Observable value that notifies listeners on change
 */
class Observable<T> {
  private value: T;
  private listeners: Set<Listener<T>> = new Set();

  constructor(initialValue: T) {
    this.value = initialValue;
  }

  /**
   * Get current value
   */
  get(): T {
    return this.value;
  }

  /**
   * Set new value and notify all listeners
   */
  set(newValue: T): void {
    if (this.value !== newValue) {
      this.value = newValue;
      this.notify();
    }
  }

  /**
   * Update value using a function
   */
  update(updater: (current: T) => T): void {
    this.set(updater(this.value));
  }

  /**
   * Subscribe to value changes
   */
  subscribe(listener: Listener<T>): Unsubscribe {
    this.listeners.add(listener);
    // Immediately call listener with current value
    listener(this.value);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of current value
   */
  private notify(): void {
    this.listeners.forEach(listener => listener(this.value));
  }
}

/**
 * Prediction market momentum for trading signals
 */
export interface PredictionMarketMomentum {
  marketId: string;
  title: string;
  category: string;
  sentimentMomentum: number; // -1 to +1
  probability: number; // 0 to 1
  lastUpdated: number;
}

/**
 * Application state interface
 */
interface AppState {
  // Globe state
  globe: {
    initialized: boolean;
    activeLayers: Set<string>;
    viewState: {
      longitude: number;
      latitude: number;
      zoom: number;
      pitch: number;
      bearing: number;
    };
  };

  // Data loading states
  loading: {
    news: boolean;
    markets: boolean;
    osint: boolean;
    intelligence: boolean;
  };

  // Selected entities
  selected: {
    country: string | null;
    event: string | null;
    asset: string | null;
  };

  // Panel states
  panels: {
    news: boolean;
    insights: boolean;
    instability: boolean;
    risk: boolean;
    markets: boolean;
    signals: boolean;
    portfolio: boolean;
  };

  // Trading state
  trading: {
    enabled: boolean;
    balance: number;
    dailyPnL: number;
    positions: number;
  };

  // WebSocket connection states
  connections: {
    relay: 'disconnected' | 'connecting' | 'connected' | 'error';
    ais: boolean;
    opensky: boolean;
  };

  // Prediction market sentiment momentum (for signal engine)
  predictionMarkets: PredictionMarketMomentum[];
}

/**
 * Global application store
 */
class Store {
  private observables: Map<string, Observable<any>> = new Map();

  constructor(initialState: AppState) {
    // Create observables for each top-level state key
    Object.entries(initialState).forEach(([key, value]) => {
      this.observables.set(key, new Observable(value));
    });
  }

  /**
   * Get an observable by key
   */
  get<K extends keyof AppState>(key: K): AppState[K] {
    const observable = this.observables.get(key as string);
    if (!observable) {
      throw new Error(`Observable '${String(key)}' not found in store`);
    }
    return observable.get();
  }

  /**
   * Set a value by key
   */
  set<K extends keyof AppState>(key: K, value: AppState[K]): void {
    const observable = this.observables.get(key as string);
    if (!observable) {
      throw new Error(`Observable '${String(key)}' not found in store`);
    }
    observable.set(value);
  }

  /**
   * Update a value by key using a function
   */
  update<K extends keyof AppState>(
    key: K,
    updater: (current: AppState[K]) => AppState[K]
  ): void {
    const observable = this.observables.get(key as string);
    if (!observable) {
      throw new Error(`Observable '${String(key)}' not found in store`);
    }
    observable.update(updater);
  }

  /**
   * Subscribe to changes on a specific key
   */
  subscribe<K extends keyof AppState>(
    key: K,
    listener: Listener<AppState[K]>
  ): Unsubscribe {
    const observable = this.observables.get(key as string);
    if (!observable) {
      throw new Error(`Observable '${String(key)}' not found in store`);
    }
    return observable.subscribe(listener);
  }

  /**
   * Get entire state snapshot (for debugging)
   */
  getState(): AppState {
    const state: any = {};
    this.observables.forEach((observable, key) => {
      state[key] = observable.get();
    });
    return state as AppState;
  }
}

// Initial state
const initialState: AppState = {
  globe: {
    initialized: false,
    activeLayers: new Set(['test-markers']),
    viewState: {
      longitude: 30,
      latitude: 25,
      zoom: 2.5,
      pitch: 35,
      bearing: 0,
    },
  },

  loading: {
    news: false,
    markets: false,
    osint: false,
    intelligence: false,
  },

  selected: {
    country: null,
    event: null,
    asset: null,
  },

  panels: {
    news: true,
    insights: true,
    instability: true,
    risk: true,
    markets: true,
    signals: false,
    portfolio: false,
  },

  trading: {
    enabled: false,
    balance: 1_000_000,
    dailyPnL: 0,
    positions: 0,
  },

  connections: {
    relay: 'disconnected',
    ais: false,
    opensky: false,
  },

  predictionMarkets: [],
};

// Global store instance
let store: Store;

/**
 * Initialize the global store
 */
export function initState(): Store {
  if (!store) {
    store = new Store(initialState);

    // Persist certain state to localStorage
    if (typeof window !== 'undefined') {
      // Load persisted state
      const persisted = localStorage.getItem('atlas-state');
      if (persisted) {
        try {
          const parsed = JSON.parse(persisted);
          if (parsed.panels) {
            store.set('panels', parsed.panels);
          }
          if (parsed.globe?.activeLayers) {
            store.update('globe', current => ({
              ...current,
              activeLayers: new Set(parsed.globe.activeLayers),
            }));
          }
        } catch (e) {
          console.error('[State] Failed to parse persisted state:', e);
        }
      }

      // Persist on changes
      ['panels', 'globe'].forEach(key => {
        store.subscribe(key as keyof AppState, () => {
          const state = store.getState();
          const toPersist = {
            panels: state.panels,
            globe: {
              activeLayers: Array.from(state.globe.activeLayers),
            },
          };
          localStorage.setItem('atlas-state', JSON.stringify(toPersist));
        });
      });
    }
  }

  return store;
}

/**
 * Get the global store instance
 */
export function getStore(): Store {
  if (!store) {
    throw new Error('Store not initialized. Call initState() first.');
  }
  return store;
}

// Export types
export type { AppState, Store, Unsubscribe };
