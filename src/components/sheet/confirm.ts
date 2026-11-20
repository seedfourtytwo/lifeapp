/**
 * The app's own "are you sure?" — asked from anywhere, answered on a sheet.
 *
 * `Alert.alert` is the stock dialog on Android and does nothing at all on the
 * web build, so a restore or a delete there could never be confirmed. These
 * two functions replace it: they hand a request to the one `ConfirmHost`
 * mounted at the app root and resolve when the person answers.
 *
 * No React in here, so hooks, stores and plain modules can all call it, and
 * the rules that keep a promise from hanging are tested on their own.
 */

export type ConfirmOptions = {
  title: string;
  /** One sentence under the title. */
  message?: string;
  /** The verb on the primary button: "Delete", "Restore". */
  confirmLabel: string;
  /** Defaults to the app's Cancel. */
  cancelLabel?: string;
  /** Paints the primary button red: the action destroys something. */
  destructive?: boolean;
};

export type NotifyOptions = {
  title: string;
  message?: string;
};

export type SheetRequest =
  | ({ kind: 'confirm' } & ConfirmOptions)
  | ({ kind: 'notify' } & NotifyOptions);

type HostListener = (request: SheetRequest | null) => void;

let host: HostListener | null = null;
let answerOpen: ((confirmed: boolean) => void) | null = null;

function ask(request: SheetRequest): Promise<boolean> {
  // Nobody can answer without a host on screen.
  if (!host) return Promise.resolve(false);
  // One question at a time: the newer one takes the sheet.
  answerOpen?.(false);
  return new Promise<boolean>((resolve) => {
    answerOpen = resolve;
    host?.(request);
  });
}

/** Ask a yes/no question. Resolves true only when the primary button is pressed. */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return ask({ kind: 'confirm', ...options });
}

/** Say something that needs one OK. Resolves once it is acknowledged or dismissed. */
export async function notify(options: NotifyOptions): Promise<void> {
  await ask({ kind: 'notify', ...options });
}

/** The host's answer for whatever is open; a no-op when nothing is. */
export function settleConfirm(confirmed: boolean): void {
  if (!answerOpen) return;
  const answer = answerOpen;
  answerOpen = null;
  answer(confirmed);
  host?.(null);
}

/**
 * Registers the mounted host. Returns its detach, which answers anything still
 * open "no" so no caller is left waiting on a sheet that is gone.
 */
export function attachConfirmHost(listener: HostListener): () => void {
  host = listener;
  return () => {
    if (host !== listener) return;
    answerOpen?.(false);
    answerOpen = null;
    host = null;
  };
}
