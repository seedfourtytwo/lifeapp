import React, { createContext, useContext, useId, useLayoutEffect } from 'react';
import type { NightLayer } from './tokens';

export type OverlayEntry = {
  layer: NightLayer;
  /** While true, the screens under it are hidden from a screen reader. */
  modal: boolean;
  node: React.ReactNode;
};

export type OverlayPortal = {
  set: (id: string, entry: OverlayEntry) => void;
  remove: (id: string) => void;
};

export const OverlayPortalContext = createContext<OverlayPortal | null>(null);

type Props = {
  layer: NightLayer;
  modal: boolean;
  children: React.ReactNode;
};

/**
 * Lifts its children out of the screen into the KitHost's layer, above every
 * screen of the stack. They render in the host's place in the tree, so they
 * see the host's providers, not the caller's.
 */
export function Overlay({ layer, modal, children }: Props) {
  const portal = useContext(OverlayPortalContext);
  if (!portal) throw new Error('A sheet or overlay needs a KitHost above it.');
  const id = useId();
  // Every render hands the host the latest children; the host does not re-render the screen for it.
  useLayoutEffect(() => {
    portal.set(id, { layer, modal, node: children });
  });
  useLayoutEffect(() => () => portal.remove(id), [portal, id]);
  return null;
}
