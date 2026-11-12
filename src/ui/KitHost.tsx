import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ConfirmFrame, type ConfirmRequest } from './ConfirmSheet';
import { OverlayPortalContext, type OverlayEntry, type OverlayPortal } from './Overlay';
import { UndoBar } from './UndoBar';
import { nightLayer, nightMotion, type NightLayer } from './tokens';

export type UndoRequest = {
  /** What just happened: "Water +2", "Could not save". */
  message: string;
  /** Puts it back. Without it the bar is a plain notice. */
  onUndo?: () => void;
};

type UndoApi = {
  /** Shows the bar, replacing any bar already up: one at a time. */
  show: (request: UndoRequest) => void;
  dismiss: () => void;
};

type ConfirmApi = (request: ConfirmRequest) => Promise<boolean>;

const UndoContext = createContext<UndoApi | null>(null);
const ConfirmContext = createContext<ConfirmApi | null>(null);

/** Android stacks by elevation, the rest by zIndex: both, from the one order. */
function layerStyle(layer: NightLayer) {
  return { zIndex: nightLayer[layer], elevation: nightLayer[layer] };
}

type PendingConfirm = ConfirmRequest & { resolve: (confirmed: boolean) => void };
type ShownUndo = UndoRequest & { key: number };

/**
 * Holds the kit's overlays above every screen: sheets, the confirm and the
 * undo bar, stacked by `nightLayer`. Mounted once around the navigator. While
 * a sheet or confirm is open, the screens under it are hidden from a screen
 * reader.
 */
export function KitHost({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation('common');
  const [overlays, setOverlays] = useState<Record<string, OverlayEntry>>({});
  const [confirming, setConfirming] = useState<PendingConfirm | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [undo, setUndo] = useState<ShownUndo | null>(null);
  const pendingConfirm = useRef<PendingConfirm | null>(null);
  const undoKey = useRef(0);

  const portal = useMemo<OverlayPortal>(
    () => ({
      set: (id, entry) => setOverlays((previous) => ({ ...previous, [id]: entry })),
      remove: (id) =>
        setOverlays((previous) => {
          const { [id]: _removed, ...rest } = previous;
          return rest;
        }),
    }),
    [],
  );

  const settleConfirm = useCallback((confirmed: boolean) => {
    const pending = pendingConfirm.current;
    pendingConfirm.current = null;
    setConfirmVisible(false);
    pending?.resolve(confirmed);
  }, []);

  const confirm = useCallback<ConfirmApi>(
    (request) =>
      new Promise<boolean>((resolve) => {
        // One question at a time: a new one answers the old one with "no".
        pendingConfirm.current?.resolve(false);
        const pending = { ...request, resolve };
        pendingConfirm.current = pending;
        setConfirming(pending);
        setConfirmVisible(true);
      }),
    [],
  );

  // A question still open when the host goes away is answered "no", never left hanging.
  useEffect(() => () => pendingConfirm.current?.resolve(false), []);

  const undoApi = useMemo<UndoApi>(
    () => ({
      show: (request) => {
        undoKey.current += 1;
        setUndo({ ...request, key: undoKey.current });
      },
      dismiss: () => setUndo(null),
    }),
    [],
  );

  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), nightMotion.undoMs);
    return () => clearTimeout(timer);
  }, [undo]);

  const entries = Object.entries(overlays).sort(([, a], [, b]) => nightLayer[a.layer] - nightLayer[b.layer]);
  const modalOpen = confirmVisible || entries.some(([, entry]) => entry.modal);

  return (
    <OverlayPortalContext.Provider value={portal}>
      <ConfirmContext.Provider value={confirm}>
        <UndoContext.Provider value={undoApi}>
          <View
            style={kitHostStyles.screens}
            importantForAccessibility={modalOpen ? 'no-hide-descendants' : 'auto'}
            accessibilityElementsHidden={modalOpen}
          >
            {children}
          </View>
          {entries.map(([id, entry]) => (
            <View
              key={id}
              style={[StyleSheet.absoluteFill, layerStyle(entry.layer)]}
              pointerEvents="box-none"
            >
              {entry.node}
            </View>
          ))}
          {confirming ? (
            <View style={[StyleSheet.absoluteFill, layerStyle('confirm')]} pointerEvents="box-none">
              <ConfirmFrame
                {...confirming}
                visible={confirmVisible}
                onConfirm={() => settleConfirm(true)}
                onCancel={() => settleConfirm(false)}
              />
            </View>
          ) : null}
          {undo ? (
            <View
              style={[StyleSheet.absoluteFill, layerStyle('undo')]}
              pointerEvents="box-none"
            >
              <UndoBar
                key={undo.key}
                message={undo.message}
                action={
                  undo.onUndo
                    ? {
                        label: t('actions.undo'),
                        onPress: () => {
                          setUndo(null);
                          undo.onUndo?.();
                        },
                      }
                    : undefined
                }
              />
            </View>
          ) : null}
        </UndoContext.Provider>
      </ConfirmContext.Provider>
    </OverlayPortalContext.Provider>
  );
}

/** Ask before one of the few things that cannot be undone. Resolves true only for the action itself. */
export function useConfirm(): ConfirmApi {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm needs a KitHost above it.');
  return confirm;
}

/** Show what just happened, with the way back. */
export function useUndoBar(): UndoApi {
  const undo = useContext(UndoContext);
  if (!undo) throw new Error('useUndoBar needs a KitHost above it.');
  return undo;
}

export const kitHostStyles = StyleSheet.create({
  screens: {
    flex: 1,
  },
});
