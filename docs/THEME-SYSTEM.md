# YC Hedge Fund Theme System

## Overview

YC Hedge Fund includes a complete dark/light theme system built with CSS custom properties (CSS variables) and vanilla TypeScript. The system supports smooth transitions, localStorage persistence, system preference detection, and keyboard shortcuts.

## Features

- **Dual Theme Support**: Dark (default) and Light themes
- **Intelligent Default**: Dark theme for intelligence dashboard aesthetic
- **Auto-Detection**: Respects system preference (`prefers-color-scheme`)
- **Persistence**: Theme choice saved to localStorage
- **Smooth Transitions**: 200ms transitions between themes
- **Keyboard Shortcut**: `Ctrl/Cmd + Shift + T` to toggle
- **Event-Driven**: Custom `themechange` event for components
- **Accessible**: ARIA labels and keyboard support

## File Structure

```
src/
├── lib/
│   ├── theme.ts          # Theme manager implementation
│   └── theme.d.ts        # TypeScript definitions
├── styles/
│   └── base.css          # Theme CSS variables and styles
└── main.ts               # Theme initialization
```

## Theme Colors

### Dark Theme (Default)
- Background: `#0a0f0a` (deep green-black)
- Panel: `rgba(10, 15, 10, 0.95)` (semi-transparent dark)
- Text: `#e8f0e8` (light green-white)
- Accent: `#4ade80` (bright green)
- Border: `rgba(74, 222, 128, 0.2)` (green with opacity)

### Light Theme
- Background: `#f8f9fa` (soft gray)
- Panel: `rgba(255, 255, 255, 0.95)` (semi-transparent white)
- Text: `#1a1a1a` (near black)
- Accent: `#2563eb` (bright blue)
- Border: `rgba(37, 99, 235, 0.2)` (blue with opacity)

## Usage

### Initialize Theme System

```typescript
import { initTheme } from './lib/theme';

// Call once on app startup
initTheme();
```

### Toggle Theme

```typescript
import { toggleTheme } from './lib/theme';

// Toggle between dark and light
toggleTheme();
```

### Set Specific Theme

```typescript
import { setTheme } from './lib/theme';

// Set to dark
setTheme('dark');

// Set to light
setTheme('light');
```

### Get Current Theme

```typescript
import { getTheme } from './lib/theme';

const currentTheme = getTheme(); // 'dark' | 'light'
```

### Listen for Theme Changes

```typescript
window.addEventListener('themechange', (e) => {
  const theme = e.detail.theme; // 'dark' | 'light'
  console.log('Theme changed to:', theme);

  // Update component-specific logic
  updateMapStyle(theme);
});
```

## CSS Variables

All theme-aware styles use CSS custom properties:

```css
/* Use in your stylesheets */
.my-component {
  background: var(--bg-panel);
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
}

/* Transitions are automatic */
.my-component {
  transition: background var(--transition-base),
              color var(--transition-base);
}
```

### Available CSS Variables

#### Colors
- `--bg-primary`: Main background
- `--bg-secondary`: Secondary background
- `--bg-panel`: Panel background (semi-transparent)
- `--bg-panel-hover`: Panel hover state
- `--bg-input`: Input field background
- `--bg-button`: Button background
- `--bg-button-hover`: Button hover state
- `--text-primary`: Main text color
- `--text-secondary`: Secondary text
- `--text-tertiary`: Tertiary/muted text
- `--text-accent`: Accent/link color
- `--text-muted`: Disabled text
- `--border-primary`: Main border color
- `--border-secondary`: Secondary borders
- `--border-hover`: Hover state borders

#### Status Colors
- `--status-critical`: Critical alerts (#ef4444 / #dc2626)
- `--status-high`: High priority (#f97316 / #ea580c)
- `--status-medium`: Medium priority (#eab308 / #ca8a04)
- `--status-low`: Low priority (#22c55e / #16a34a)
- `--status-info`: Information (#3b82f6 / #2563eb)

#### Sentiment Colors
- `--sentiment-positive`: Positive sentiment
- `--sentiment-negative`: Negative sentiment
- `--sentiment-neutral`: Neutral sentiment

#### Shadows
- `--shadow-sm`: Small shadow
- `--shadow-md`: Medium shadow
- `--shadow-lg`: Large shadow
- `--shadow-glow`: Glow effect

#### Spacing (theme-independent)
- `--spacing-xs`: 4px
- `--spacing-sm`: 8px
- `--spacing-md`: 16px
- `--spacing-lg`: 24px
- `--spacing-xl`: 32px

#### Border Radius (theme-independent)
- `--radius-sm`: 4px
- `--radius-md`: 8px
- `--radius-lg`: 12px

#### Transitions (theme-independent)
- `--transition-fast`: 150ms
- `--transition-base`: 200ms
- `--transition-slow`: 300ms

## HTML Integration

Add the theme toggle button to your UI:

```html
<button id="theme-toggle" class="theme-toggle" aria-label="Toggle theme">
  <span class="theme-icon">🌙</span>
</button>
```

Wire it up in JavaScript:

```typescript
const toggleButton = document.getElementById('theme-toggle');
const iconSpan = toggleButton?.querySelector('.theme-icon');

const updateIcon = () => {
  const theme = getTheme();
  iconSpan.textContent = theme === 'dark' ? '🌙' : '☀️';
};

toggleButton?.addEventListener('click', () => {
  toggleTheme();
  updateIcon();
});
```

## Keyboard Shortcuts

- **Toggle Theme**: `Ctrl/Cmd + Shift + T`

## Best Practices

1. **Always use CSS variables** for colors, never hardcode hex values
2. **Include transitions** on theme-aware properties for smooth switching
3. **Test both themes** during development
4. **Use semantic variable names** (e.g., `--text-primary` not `--color-white`)
5. **Maintain contrast ratios** for accessibility (WCAG AA minimum)

## Example Component

```typescript
// my-panel.ts
export function createPanel(): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'my-panel';
  panel.innerHTML = `
    <h3>Data Panel</h3>
    <p class="text-secondary">Adapts to theme automatically</p>
    <button class="btn">Action</button>
  `;

  // Listen for theme changes if needed
  window.addEventListener('themechange', (e) => {
    const theme = e.detail.theme;
    // Perform theme-specific logic
    console.log('Panel theme updated:', theme);
  });

  return panel;
}
```

```css
/* my-panel.css */
.my-panel {
  background: var(--bg-panel);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  transition: all var(--transition-base);
}

.my-panel h3 {
  color: var(--text-accent);
  margin-bottom: var(--spacing-sm);
}

.my-panel:hover {
  background: var(--bg-panel-hover);
  border-color: var(--border-hover);
  box-shadow: var(--shadow-glow);
}
```

## Testing

View the theme demo page:

```bash
npm run dev
# Navigate to: http://localhost:5173/src/theme-demo.html
```

The demo page includes:
- Typography examples
- Status badges
- Sentiment indicators
- Buttons and inputs
- Data cards
- Loading states
- Code blocks
- Links

## Integration with deck.gl

For map/globe components, listen for theme changes:

```typescript
import { initGlobe } from './globe/globe';

const globe = initGlobe(container);

window.addEventListener('themechange', (e) => {
  const theme = e.detail.theme;

  // Update basemap style
  const basemapUrl = theme === 'dark'
    ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
    : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

  globe.setBasemap(basemapUrl);
});
```

## Browser Support

- Modern browsers with CSS custom properties support
- localStorage API required
- matchMedia API for system preference detection (graceful fallback)

## Performance

- CSS variables are hardware-accelerated
- Transitions use `cubic-bezier(0.4, 0, 0.2, 1)` for smooth easing
- No JavaScript re-rendering required on theme change
- Single event listener for theme changes

## Future Enhancements

- [ ] Auto dark mode schedule (sunset/sunrise based)
- [ ] High contrast mode
- [ ] Custom theme colors (user-defined)
- [ ] Theme export/import
- [ ] Smooth fade transition overlay during theme switch
