import type { Methodology } from '../types.js';
import { getMethodology, setMethodology, loadModel, resetModel, on, undo, redo, canUndo, canRedo } from '../store/model.js';
import { setZoom, resetView, getTransform } from '../diagram/canvas.js';
import { importJson } from '../io/json.js';
import { importYaml } from '../io/yaml.js';
import { openSaveModal, openAlertModal, openConfirmModal, openHelpModal } from './modals.js';
import { clearStorage } from '../store/persistence.js';

export function initToolbar(
  container: HTMLElement,
  onOpenMetadata: () => void,
  onOpenTheme: () => void,
  onOpenReport: () => void,
): void {
  const methodSelect = container.querySelector<HTMLSelectElement>('#method-select');
  const zoomIn       = container.querySelector<HTMLButtonElement>('#zoom-in');
  const zoomOut      = container.querySelector<HTMLButtonElement>('#zoom-out');
  const resetBtn     = container.querySelector<HTMLButtonElement>('#zoom-reset');
  const zoomLabel    = container.querySelector<HTMLSpanElement>('#zoom-label');
  const metaBtn      = container.querySelector<HTMLButtonElement>('#metadata-btn');
  const themeBtn     = container.querySelector<HTMLButtonElement>('#theme-btn');
  const helpBtn      = container.querySelector<HTMLButtonElement>('#help-btn');
  const saveBtn      = container.querySelector<HTMLButtonElement>('#save-btn');
  const reportBtn    = container.querySelector<HTMLButtonElement>('#report-btn');
  const clearBtn     = container.querySelector<HTMLButtonElement>('#clear-btn');
  const openFile     = container.querySelector<HTMLInputElement>('#open-file');
  const projectName  = container.querySelector<HTMLSpanElement>('#project-name');
  const undoBtn      = container.querySelector<HTMLButtonElement>('#undo-btn');
  const redoBtn      = container.querySelector<HTMLButtonElement>('#redo-btn');

  if (methodSelect) {
    methodSelect.value = getMethodology();
    methodSelect.addEventListener('change', () => {
      setMethodology(methodSelect.value as Methodology);
    });
  }

  zoomIn?.addEventListener('click', () => {
    setZoom(getTransform().scale * 1.2);
    updateZoomLabel(zoomLabel);
  });
  zoomOut?.addEventListener('click', () => {
    setZoom(getTransform().scale / 1.2);
    updateZoomLabel(zoomLabel);
  });
  resetBtn?.addEventListener('click', () => {
    resetView();
    updateZoomLabel(zoomLabel);
  });

  metaBtn?.addEventListener('click', onOpenMetadata);
  themeBtn?.addEventListener('click', onOpenTheme);
  helpBtn?.addEventListener('click', openHelpModal);
  saveBtn?.addEventListener('click', openSaveModal);
  reportBtn?.addEventListener('click', onOpenReport);

  undoBtn?.addEventListener('click', () => { undo(); syncUndoRedo(); });
  redoBtn?.addEventListener('click', () => { redo(); syncUndoRedo(); });

  clearBtn?.addEventListener('click', () => {
    openConfirmModal(
      'Starta nytt diagram? Osparade ändringar går förlorade.',
      () => { clearStorage(); resetModel(); },
      'Nytt diagram',
    );
  });

  openFile?.addEventListener('change', () => {
    const file = openFile.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const result = file.name.endsWith('.yaml') || file.name.endsWith('.yml')
        ? importYaml(text, file.size)
        : importJson(text, file.size);
      if (result.ok) {
        loadModel(result.model);
      } else {
        openAlertModal(`Import misslyckades: ${result.error}`);
      }
    };
    reader.readAsText(file);
    openFile.value = '';
  });

  // Keep project name in toolbar in sync with metadata
  on('metadata:updated', (meta) => {
    if (projectName) projectName.textContent = meta.name;
  });

  // Keep undo/redo buttons in sync with history state
  const syncUndoRedo = (): void => {
    if (undoBtn) undoBtn.disabled = !canUndo();
    if (redoBtn) redoBtn.disabled = !canRedo();
  };
  on('*', syncUndoRedo);

  // Keep zoom label in sync when scroll-wheel zoom changes scale
  window.addEventListener('zoom:changed', () => updateZoomLabel(zoomLabel));
}

function updateZoomLabel(label: HTMLSpanElement | null): void {
  if (label) label.textContent = `${Math.round(getTransform().scale * 100)}%`;
}
