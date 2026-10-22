// Only a primary-button press on non-interactive titlebar content starts window movement.
// Event delegation makes nested logo SVG/text as draggable as the titlebar background.
const INTERACTIVE = 'button, input, select, textarea, a, label, [role="button"], [contenteditable], .language-control';

export function isTitlebarDragStart(event) {
  if (event.button !== 0 || event.detail > 1 || !event.target?.closest) return false;
  return !event.target.closest(INTERACTIVE);
}

export function bindTitlebarDrag(titlebar, startDragging) {
  if (!titlebar || typeof startDragging !== 'function') return;
  titlebar.addEventListener('mousedown', (event) => {
    if (!isTitlebarDragStart(event)) return;
    // Keep the host-side call bound to the actual mousedown so macOS can track the drag.
    Promise.resolve(startDragging()).catch((error) => {
      console.warn('Native window drag failed:', error);
    });
  });
}
