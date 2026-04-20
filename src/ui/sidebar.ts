/**
 * Sidebar: tool palette + element list.
 */
import type { ElementType } from '../types.js';
import { getElements, on } from '../store/model.js';

type ToolMode = 'select' | ElementType;
let currentTool: ToolMode = 'select';
let onPlaceCb: ((type: ElementType, x: number, y: number) => void) | null = null;
let onSelectFromListCb: ((id: string) => void) | null = null;

export function initSidebar(
  container: HTMLElement,
  svg: SVGSVGElement,
  onPlace: (type: ElementType, x: number, y: number) => void,
  onSelectFromList: (id: string) => void,
): void {
  onPlaceCb = onPlace;
  onSelectFromListCb = onSelectFromList;
  const buttons = container.querySelectorAll<HTMLButtonElement>('[data-tool]');

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      currentTool = btn.dataset['tool'] as ToolMode;
      buttons.forEach((b) => b.classList.toggle('active', b === btn));
      svg.style.cursor = currentTool === 'select' ? '' : 'crosshair';
    });
  });

  svg.addEventListener('click', (e) => {
    if (currentTool === 'select') return;
    if ((e.target as Element).closest('.diagram-element')) return;
    // Pass raw screen coordinates — placeElement calls screenToWorld internally
    onPlaceCb?.(currentTool as ElementType, e.clientX, e.clientY);
    setTool('select', buttons);
    svg.style.cursor = '';
  });

  renderElementList(container);
  on('element:added',   () => renderElementList(container));
  on('element:updated', () => renderElementList(container));
  on('element:removed', () => renderElementList(container));
  on('model:loaded',    () => renderElementList(container));
}

/** Highlights the list item matching the given element id (call on canvas selection change). */
export function highlightListItems(ids: Set<string>): void {
  const list = document.querySelector<HTMLUListElement>('#element-list');
  if (!list) return;
  list.querySelectorAll<HTMLLIElement>('li').forEach((li) => {
    li.classList.toggle('active', ids.has(li.dataset['id'] ?? ''));
  });
  if (ids.size === 1) {
    const [id] = ids;
    list.querySelector<HTMLLIElement>(`li[data-id="${id}"]`)?.scrollIntoView({ block: 'nearest' });
  }
}

export function getCurrentTool(): ToolMode { return currentTool; }

function setTool(tool: ToolMode, buttons: NodeListOf<HTMLButtonElement>): void {
  currentTool = tool;
  buttons.forEach((b) => b.classList.toggle('active', b.dataset['tool'] === tool));
}

function renderElementList(container: HTMLElement): void {
  const list = container.querySelector<HTMLUListElement>('#element-list');
  if (!list) return;
  // Preserve current active id across re-renders
  const activeId = list.querySelector<HTMLLIElement>('li.active')?.dataset['id'] ?? null;
  list.innerHTML = '';
  getElements().forEach((el) => {
    const li = document.createElement('li');
    li.dataset['id'] = el.id;
    if (el.id === activeId) li.classList.add('active');
    const typeIcon = typeEmoji(el.type as ElementType);
    const name = document.createElement('span');
    name.textContent = `${typeIcon} ${el.label}`;
    li.appendChild(name);
    li.addEventListener('click', () => {
      list.querySelectorAll('li').forEach((x) => x.classList.remove('active'));
      li.classList.add('active');
      onSelectFromListCb?.(el.id);
    });
    list.appendChild(li);
  });
}

function typeEmoji(type: ElementType): string {
  switch (type) {
    case 'Process':        return '⭕';
    case 'ExternalEntity': return '▭';
    case 'DataStore':      return '🗄';
    case 'TrustBoundary':  return '╌';
    case 'TrustZone':      return '🔲';
  }
}
