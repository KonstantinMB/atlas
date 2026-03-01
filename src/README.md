# YC Hedge Fund Frontend (Phase 0)

## Structure Created

```
src/
├── index.html                 # App shell with dark theme
├── main.ts                    # Entry point with initialization logic
├── styles/
│   └── base.css              # Dark intelligence dashboard theme
├── lib/
│   ├── state.ts              # Reactive state management (pub/sub)
│   └── websocket.ts          # WebSocket manager with auto-reconnect
├── globe/                     # deck.gl globe (to be built)
├── panels/                    # Right-side panels (to be built)
├── trading/                   # Paper trading engine (to be built)
├── intelligence/              # Client-side analytics (to be built)
└── data/                      # Static JSON datasets (to be added)
```

## Key Features

### 1. Dark Theme System
- CSS variables for all colors
- Intelligence dashboard aesthetic (#0a0f0a background)
- Monospace fonts for metrics/values
- Glowing accents with --text-accent (#4ade80)

### 2. Reactive State Management
- Observable pattern with pub/sub
- Type-safe with TypeScript interfaces
- localStorage persistence for panels and layers
- No dependencies, vanilla implementation

### 3. WebSocket Manager
- Auto-reconnect with exponential backoff
- Event emitter pattern
- Connection state tracking
- Ready for Railway relay integration

### 4. Layout Structure
- Full-screen globe container (deck.gl)
- Left panel for layer toggles (280px)
- Right panel for intelligence feeds (380px)
- Command palette (Cmd+K) overlay
- All panels use backdrop blur and dark glass effect

## Development

```bash
# Install dependencies
npm install

# Start dev server (port 3000)
npm run dev

# Type check
npm run typecheck

# Build for production
npm run build
```

## Next Steps (Phase 1)

1. Initialize deck.gl + MapLibre GL JS in globe.ts
2. Create static data layers (military-bases, cables, etc.)
3. Build layer toggle UI
4. Add basic panel components
5. Test real-time data flow

## Design Principles

- Vanilla TypeScript ONLY (no frameworks)
- Direct DOM manipulation
- Bundle size < 300KB gzipped
- Client-side intelligence compute
- Dark theme only
- Data-dense information display
