/**
 * YC Hedge Fund - Command Palette (Cmd+K)
 * VS Code-style command palette for quick navigation and actions
 */

export interface Command {
  id: string;
  label: string;
  description?: string;
  category: string;
  shortcut?: string;
  icon?: string;
  action: () => void;
}

export class CommandPalette {
  private commands: Command[] = [];
  private overlay: HTMLElement | null = null;
  private input: HTMLInputElement | null = null;
  private results: HTMLElement | null = null;
  private selectedIndex = 0;
  private isOpen = false;

  init(): void {
    this.createDOM();
    this.registerDefaultCommands();
    this.setupKeyboard();
  }

  register(command: Command): void {
    this.commands.push(command);
  }

  open(): void {
    if (!this.overlay || !this.input) return;
    this.isOpen = true;
    this.overlay.setAttribute('aria-hidden', 'false');
    this.overlay.classList.add('open');
    this.input.value = '';
    this.selectedIndex = 0;
    this.render(this.commands.slice(0, 8));
    // Focus after transition starts
    requestAnimationFrame(() => this.input?.focus());
  }

  close(): void {
    if (!this.overlay) return;
    this.isOpen = false;
    this.overlay.setAttribute('aria-hidden', 'true');
    this.overlay.classList.remove('open');
    this.input?.blur();
  }

  private fuzzyMatch(query: string, text: string): boolean {
    const q = query.toLowerCase();
    const t = text.toLowerCase();
    let qi = 0;
    for (let ti = 0; ti < t.length && qi < q.length; ti++) {
      if (t[ti] === q[qi]) qi++;
    }
    return qi === q.length;
  }

  private filter(query: string): Command[] {
    if (!query.trim()) return this.commands.slice(0, 8);
    return this.commands
      .filter(cmd =>
        this.fuzzyMatch(query, cmd.label) ||
        (cmd.description && this.fuzzyMatch(query, cmd.description)) ||
        this.fuzzyMatch(query, cmd.category)
      )
      .slice(0, 8);
  }

  private render(commands: Command[]): void {
    if (!this.results) return;
    this.results.innerHTML = '';

    if (commands.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'command-empty';
      empty.textContent = 'No commands found';
      this.results.appendChild(empty);
      return;
    }

    // Group by category
    const grouped = new Map<string, Command[]>();
    commands.forEach(cmd => {
      if (!grouped.has(cmd.category)) grouped.set(cmd.category, []);
      grouped.get(cmd.category)!.push(cmd);
    });

    let globalIndex = 0;
    grouped.forEach((cmds, category) => {
      // Category header
      const header = document.createElement('div');
      header.className = 'command-category-header';
      header.textContent = category;
      this.results!.appendChild(header);

      cmds.forEach(cmd => {
        const item = document.createElement('div');
        item.className = 'command-item' + (globalIndex === this.selectedIndex ? ' selected' : '');
        item.dataset.index = String(globalIndex);

        const iconEl = document.createElement('span');
        iconEl.className = 'command-icon';
        iconEl.textContent = cmd.icon || '›';

        const textEl = document.createElement('div');
        textEl.className = 'command-text';

        const labelEl = document.createElement('div');
        labelEl.className = 'command-label';
        labelEl.textContent = cmd.label;

        textEl.appendChild(labelEl);

        if (cmd.description) {
          const descEl = document.createElement('div');
          descEl.className = 'command-desc';
          descEl.textContent = cmd.description;
          textEl.appendChild(descEl);
        }

        item.appendChild(iconEl);
        item.appendChild(textEl);

        if (cmd.shortcut) {
          const shortcutEl = document.createElement('span');
          shortcutEl.className = 'command-shortcut';
          shortcutEl.textContent = cmd.shortcut;
          item.appendChild(shortcutEl);
        }

        const capturedIndex = globalIndex;
        item.addEventListener('click', () => {
          this.selectedIndex = capturedIndex;
          this.execute(cmd);
        });

        item.addEventListener('mouseenter', () => {
          this.selectedIndex = capturedIndex;
          this.updateSelection();
        });

        this.results!.appendChild(item);
        globalIndex++;
      });
    });
  }

  private updateSelection(): void {
    if (!this.results) return;
    const items = this.results.querySelectorAll('.command-item');
    items.forEach((el, i) => {
      el.classList.toggle('selected', i === this.selectedIndex);
    });
    const selected = items[this.selectedIndex] as HTMLElement;
    selected?.scrollIntoView({ block: 'nearest' });
  }

  private execute(command: Command): void {
    this.close();
    try {
      command.action();
    } catch (err) {
      console.error('[CommandPalette] Command failed:', command.id, err);
    }
  }

  private createDOM(): void {
    // Remove stale placeholder if present
    const existing = document.getElementById('command-palette');
    if (existing) existing.remove();

    this.overlay = document.createElement('div');
    this.overlay.id = 'command-palette';
    this.overlay.className = 'command-palette-overlay';
    this.overlay.setAttribute('aria-hidden', 'true');
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-label', 'Command palette');

    const modal = document.createElement('div');
    modal.className = 'command-palette-modal';
    modal.addEventListener('click', e => e.stopPropagation());

    // Search bar
    const searchBar = document.createElement('div');
    searchBar.className = 'command-palette-search';

    const searchIcon = document.createElement('span');
    searchIcon.className = 'search-icon';
    searchIcon.textContent = '⌕';

    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.id = 'command-palette-input';
    this.input.placeholder = 'Type a command...';
    this.input.autocomplete = 'off';
    this.input.spellcheck = false;

    const closeBtn = document.createElement('span');
    closeBtn.className = 'search-close';
    closeBtn.title = 'Close (Esc)';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => this.close());

    searchBar.appendChild(searchIcon);
    searchBar.appendChild(this.input);
    searchBar.appendChild(closeBtn);

    // Results
    this.results = document.createElement('div');
    this.results.className = 'command-palette-results';
    this.results.id = 'command-palette-results';

    // Footer
    const footer = document.createElement('div');
    footer.className = 'command-palette-footer';
    footer.innerHTML = `
      <span class="kbd-hint"><kbd>↑↓</kbd> Navigate</span>
      <span class="kbd-hint"><kbd>Enter</kbd> Execute</span>
      <span class="kbd-hint"><kbd>Esc</kbd> Close</span>
    `;

    modal.appendChild(searchBar);
    modal.appendChild(this.results);
    modal.appendChild(footer);

    this.overlay.appendChild(modal);
    document.body.appendChild(this.overlay);

    // Close on overlay click
    this.overlay.addEventListener('click', () => this.close());

    // Input listener for filtering
    this.input.addEventListener('input', () => {
      this.selectedIndex = 0;
      const filtered = this.filter(this.input!.value);
      this.render(filtered);
    });

    // Input keyboard navigation
    this.input.addEventListener('keydown', (e) => {
      const filtered = this.filter(this.input!.value);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, filtered.length - 1);
        this.updateSelection();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.updateSelection();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = filtered[this.selectedIndex];
        if (cmd) this.execute(cmd);
      } else if (e.key === 'Escape') {
        this.close();
      }
    });
  }

  private setupKeyboard(): void {
    document.addEventListener('keydown', (e) => {
      // Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (this.isOpen) {
          this.close();
        } else {
          this.open();
        }
      }
    });
  }

  private registerDefaultCommands(): void {
    const flyToCommands: Command[] = [
      {
        id: 'fly-middle-east',
        label: 'Fly to Middle East',
        category: 'Navigation',
        icon: '🌍',
        action: async () => {
          const { flyToLocation } = await import('../globe/globe');
          flyToLocation({ longitude: 45, latitude: 25, zoom: 3.5 });
        },
      },
      {
        id: 'fly-asia',
        label: 'Fly to Asia-Pacific',
        category: 'Navigation',
        icon: '🌏',
        action: async () => {
          const { flyToLocation } = await import('../globe/globe');
          flyToLocation({ longitude: 120, latitude: 20, zoom: 3 });
        },
      },
      {
        id: 'fly-europe',
        label: 'Fly to Europe',
        category: 'Navigation',
        icon: '🌍',
        action: async () => {
          const { flyToLocation } = await import('../globe/globe');
          flyToLocation({ longitude: 15, latitude: 50, zoom: 3.5 });
        },
      },
      {
        id: 'fly-americas',
        label: 'Fly to Americas',
        category: 'Navigation',
        icon: '🌎',
        action: async () => {
          const { flyToLocation } = await import('../globe/globe');
          flyToLocation({ longitude: -80, latitude: 20, zoom: 2.5 });
        },
      },
      {
        id: 'fly-africa',
        label: 'Fly to Africa',
        category: 'Navigation',
        icon: '🌍',
        action: async () => {
          const { flyToLocation } = await import('../globe/globe');
          flyToLocation({ longitude: 20, latitude: 5, zoom: 3 });
        },
      },
    ];

    const themeCommands: Command[] = [
      {
        id: 'dark-theme',
        label: 'Switch to Dark Theme',
        category: 'Theme',
        icon: '🌙',
        action: () => {
          document.documentElement.setAttribute('data-theme', 'dark');
          localStorage.setItem('atlas-theme', 'dark');
          window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: 'dark' } }));
        },
      },
      {
        id: 'light-theme',
        label: 'Switch to Light Theme',
        category: 'Theme',
        icon: '☀️',
        action: () => {
          document.documentElement.setAttribute('data-theme', 'light');
          localStorage.setItem('atlas-theme', 'light');
          window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: 'light' } }));
        },
      },
    ];

    const layerCommands: Command[] = [
      'military-bases',
      'nuclear-facilities',
      'undersea-cables',
      'conflict-zones',
      'earthquakes',
      'fires',
      'aircraft',
      'chokepoints',
      'financial-centers',
      'pipelines',
    ].map(layerId => ({
      id: `toggle-${layerId}`,
      label: `Toggle ${layerId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`,
      category: 'Layers',
      icon: '◎',
      action: async () => {
        const { toggleLayer } = await import('../globe/globe');
        toggleLayer(layerId);
      },
    }));

    const panelCommands: Command[] = [
      {
        id: 'expand-all',
        label: 'Expand All Panels',
        category: 'Panels',
        icon: '⬇',
        action: () => {
          document.querySelectorAll('.panel-body.collapsed').forEach(el =>
            el.classList.remove('collapsed')
          );
        },
      },
      {
        id: 'collapse-all',
        label: 'Collapse All Panels',
        category: 'Panels',
        icon: '⬆',
        action: () => {
          document.querySelectorAll('.panel-body').forEach(el =>
            el.classList.add('collapsed')
          );
        },
      },
    ];

    const tradingCommands: Command[] = [
      {
        id: 'reset-portfolio',
        label: 'Reset Portfolio',
        description: 'Reset paper trading portfolio to initial state',
        category: 'Trading',
        icon: '↺',
        action: () => {
          if (confirm('Reset paper trading portfolio? This cannot be undone.')) {
            localStorage.removeItem('atlas-portfolio');
            window.location.reload();
          }
        },
      },
      {
        id: 'view-signals',
        label: 'View Signals',
        description: 'Scroll to the signals panel',
        category: 'Trading',
        icon: '📡',
        action: () => {
          const panel = document.querySelector('[data-panel="signals"]');
          panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        },
      },
    ];

    [...flyToCommands, ...themeCommands, ...layerCommands, ...panelCommands, ...tradingCommands]
      .forEach(cmd => this.register(cmd));
  }
}

export const commandPalette = new CommandPalette();
