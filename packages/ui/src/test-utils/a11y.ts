/*
 * While a modal overlay (menu, dialog) is open, Radix sets aria-hidden on everything outside it
 * and traps focus inside. axe still sees the now unreachable trigger as a focusable element in
 * a hidden region and reports aria-hidden-focus. Use only on stories that end with a modal open.
 */
export const openModalA11y = {
  a11y: { config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] } },
}
