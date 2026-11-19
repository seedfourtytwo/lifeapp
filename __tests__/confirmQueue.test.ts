/**
 * `confirm` / `notify`: the promise behind the app's own confirmation sheet.
 *
 * Call sites await an answer from anywhere — a hook, a store helper, a plain
 * module — so the rules that keep those promises from hanging live here, away
 * from the sheet that draws them:
 *  - no host on screen means nobody can answer, so the answer is "no";
 *  - one question at a time: a newer one answers the older "no";
 *  - every question is answered exactly once.
 */
import {
  attachConfirmHost,
  confirm,
  notify,
  settleConfirm,
  type SheetRequest,
} from '../src/components/sheet/confirm';

let shown: (SheetRequest | null)[] = [];
let detach: (() => void) | null = null;

function attach(): void {
  detach = attachConfirmHost((request) => shown.push(request));
}

beforeEach(() => {
  shown = [];
});

afterEach(() => {
  detach?.();
  detach = null;
});

const ASK = { title: 'Delete "Water"?', message: 'This cannot be undone.', confirmLabel: 'Delete' };

describe('confirm', () => {
  it('answers no when no host is mounted, rather than hanging', async () => {
    await expect(confirm(ASK)).resolves.toBe(false);
  });

  it('hands the question to the host and resolves with the answer', async () => {
    attach();
    const answer = confirm({ ...ASK, destructive: true });
    expect(shown).toEqual([{ kind: 'confirm', ...ASK, destructive: true }]);
    settleConfirm(true);
    await expect(answer).resolves.toBe(true);
    expect(shown.at(-1)).toBeNull();
  });

  it('resolves false on cancel', async () => {
    attach();
    const answer = confirm(ASK);
    settleConfirm(false);
    await expect(answer).resolves.toBe(false);
  });

  it('answers the first question no when a second one opens over it', async () => {
    attach();
    const first = confirm(ASK);
    const second = confirm({ ...ASK, title: 'Restore backup?' });
    await expect(first).resolves.toBe(false);
    expect(shown.at(-1)).toMatchObject({ title: 'Restore backup?' });
    settleConfirm(true);
    await expect(second).resolves.toBe(true);
  });

  it('ignores an answer when nothing is open', async () => {
    attach();
    const answer = confirm(ASK);
    settleConfirm(true);
    settleConfirm(false);
    await expect(answer).resolves.toBe(true);
    expect(shown).toEqual([expect.objectContaining({ kind: 'confirm' }), null]);
  });

  it('answers no when the host goes away with a question open', async () => {
    attach();
    const answer = confirm(ASK);
    detach?.();
    detach = null;
    await expect(answer).resolves.toBe(false);
    await expect(confirm(ASK)).resolves.toBe(false);
  });
});

describe('notify', () => {
  it('shows a one-button notice and resolves once it is acknowledged', async () => {
    attach();
    let done = false;
    const seen = notify({ title: 'Could not save', message: 'Disk full.' }).then(() => {
      done = true;
    });
    expect(shown).toEqual([{ kind: 'notify', title: 'Could not save', message: 'Disk full.' }]);
    await Promise.resolve();
    expect(done).toBe(false);
    settleConfirm(true);
    await seen;
    expect(done).toBe(true);
  });

  it('resolves without a host too', async () => {
    await expect(notify({ title: 'Saved' })).resolves.toBeUndefined();
  });

  it('gives way to a question asked after it', async () => {
    attach();
    const notice = notify({ title: 'Saved' });
    const answer = confirm(ASK);
    await expect(notice).resolves.toBeUndefined();
    settleConfirm(true);
    await expect(answer).resolves.toBe(true);
  });
});
