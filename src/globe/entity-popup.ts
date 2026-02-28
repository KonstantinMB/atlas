/**
 * Entity popup panel — shows when user clicks a globe marker
 * Anchored center-right, not mouse-following
 */

export interface EntityInfo {
  id: string;
  name: string;
  type: string;
  subtitle?: string;
  fields: Array<{ label: string; value: string }>;
  coordinates?: [number, number];
  severity?: 'low' | 'medium' | 'high' | 'critical';
  color?: string;
}

let popupEl: HTMLElement | null = null;

/**
 * Create DOM and append to body — call once at startup
 */
export function initEntityPopup(): void {
  if (document.getElementById('entity-popup')) return;

  const el = document.createElement('div');
  el.id = 'entity-popup';
  el.className = 'entity-popup';

  el.innerHTML = `
    <div class="entity-popup-header">
      <div class="entity-popup-type-badge" id="ep-type"></div>
      <button class="entity-popup-close" id="ep-close" aria-label="Close">✕</button>
    </div>
    <div class="entity-popup-name" id="ep-name"></div>
    <div class="entity-popup-subtitle" id="ep-subtitle"></div>
    <div class="entity-popup-fields" id="ep-fields"></div>
    <div class="entity-popup-coords" id="ep-coords"></div>
  `;

  document.body.appendChild(el);
  popupEl = el;

  document.getElementById('ep-close')?.addEventListener('click', hideEntityPopup);
}

/**
 * Show the popup with the given entity info
 */
export function showEntityPopup(info: EntityInfo): void {
  if (!popupEl) initEntityPopup();
  const el = popupEl!;

  // Type badge
  const badge = el.querySelector<HTMLElement>('#ep-type')!;
  badge.textContent = formatType(info.type);
  badge.style.borderColor = info.color ?? '';
  badge.style.color = info.color ?? '';

  // Name
  el.querySelector<HTMLElement>('#ep-name')!.textContent = info.name;

  // Subtitle
  const subtitleEl = el.querySelector<HTMLElement>('#ep-subtitle')!;
  subtitleEl.textContent = info.subtitle ?? '';
  subtitleEl.style.display = info.subtitle ? '' : 'none';

  // Fields
  const fieldsEl = el.querySelector<HTMLElement>('#ep-fields')!;
  fieldsEl.innerHTML = '';
  info.fields.forEach(f => {
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'entity-popup-field';
    fieldDiv.innerHTML = `
      <span class="entity-field-label">${escapeHtml(f.label)}</span>
      <span class="entity-field-value">${escapeHtml(f.value)}</span>
    `;
    fieldsEl.appendChild(fieldDiv);
  });
  fieldsEl.style.display = info.fields.length ? '' : 'none';

  // Coordinates
  const coordsEl = el.querySelector<HTMLElement>('#ep-coords')!;
  if (info.coordinates) {
    const [lon, lat] = info.coordinates;
    const latStr = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}`;
    const lonStr = `${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;
    coordsEl.textContent = `${latStr}, ${lonStr}`;
    coordsEl.style.display = '';
  } else {
    coordsEl.style.display = 'none';
  }

  // Severity accent on left border
  if (info.severity) {
    const severityColors: Record<string, string> = {
      critical: '#ef4444',
      high:     '#f97316',
      medium:   '#eab308',
      low:      '#22c55e',
    };
    el.style.borderLeftColor = severityColors[info.severity] ?? '';
    el.style.borderLeftWidth = '3px';
  } else if (info.color) {
    el.style.borderLeftColor = info.color;
    el.style.borderLeftWidth = '3px';
  } else {
    el.style.borderLeftColor = '';
    el.style.borderLeftWidth = '';
  }

  el.classList.add('visible');
}

/**
 * Hide the popup
 */
export function hideEntityPopup(): void {
  popupEl?.classList.remove('visible');
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatType(type: string): string {
  return type.replace(/-/g, ' ').toUpperCase();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
