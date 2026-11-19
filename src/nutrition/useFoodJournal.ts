import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { HomeNotebookChip } from '../notes';
import { JOURNAL_NOTEBOOK_MAX } from '../protocol';
import { useJournalNotebookStore } from '../store/journalNotebookStore';
import { readFoodJournalNotebookId, resolveFoodJournalNotebook } from './foodJournal';
import { confirm, notify } from '../components/sheet/confirm';

type Options = {
  /** Every notebook Home knows about today — the pointer is resolved against these. */
  notebooks: readonly HomeNotebookChip[];
  /** Open today's entry in the given notebook. */
  onOpen: (notebookId: string) => void;
  /** A notebook was just created — Home's chip list is a beat behind. */
  onCreated?: () => void;
};

export type FoodJournalAffordance = {
  /** False until the stored pointer has been read; render nothing before then. */
  ready: boolean;
  /** The food journal's Home chip, or null when there is not one. */
  notebook: HomeNotebookChip | null;
  /** True while a creation is in flight. */
  starting: boolean;
  /** Ask to create the food journal, then open it. Confirms first. */
  start: () => void;
};

/**
 * The Nutrition screen's food journal affordance.
 *
 * Two states and no third: either the notebook exists and this behaves exactly
 * like the notebook buttons on the Today page, or it does not and the
 * screen offers to start one. Creating costs a fifth of the five-notebook budget,
 * so it is confirmed, never automatic — and deleting the notebook by hand puts
 * the screen back in the offering state rather than quietly rebuilding it.
 */
export function useFoodJournal({
  notebooks,
  onOpen,
  onCreated,
}: Options): FoodJournalAffordance {
  const { t } = useTranslation('nutrition');
  const { t: tCommon } = useTranslation('common');
  const [storedId, setStoredId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  const startNotebook = useJournalNotebookStore((s) => s.startFoodJournal);

  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;
  const onCreatedRef = useRef(onCreated);
  onCreatedRef.current = onCreated;

  /**
   * Re-read whenever the notebook list changes rather than only on mount: that
   * is when Home has refreshed after a focus, a day rollover, or an import, and
   * it is the cheapest moment to notice the pointer moved underneath us.
   */
  const notebookKey = notebooks.map((notebook) => notebook.id).join(',');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const id = await readFoodJournalNotebookId();
        if (!cancelled) setStoredId(id);
      } catch {
        // Non-fatal — the screen stays in its opt-in state until the next read.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [notebookKey]);

  const notebook = useMemo(
    () => resolveFoodJournalNotebook(storedId, notebooks),
    [storedId, notebooks],
  );

  const create = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    try {
      const result = await startNotebook();
      if (result.status === 'atCap') {
        void notify({
          title: t('foodJournal.capTitle'),
          message: t('foodJournal.capBody', { max: result.max }),
        });
        return;
      }
      if (result.status === 'discarded') {
        void notify({
          title: t('foodJournal.couldNotStartTitle'),
          message: tCommon('errors.dataReplacedTryAgain'),
        });
        return;
      }
      setStoredId(result.notebookId);
      onCreatedRef.current?.();
      onOpenRef.current(result.notebookId);
    } catch (error) {
      void notify({
        title: t('foodJournal.couldNotStartTitle'),
        message: error instanceof Error ? error.message : tCommon('errors.somethingWentWrong'),
      });
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }, [startNotebook, t, tCommon]);

  const start = useCallback(() => {
    void confirm({
      title: t('foodJournal.confirmTitle'),
      message: t('foodJournal.confirmBody', { max: JOURNAL_NOTEBOOK_MAX }),
      confirmLabel: t('foodJournal.confirmStart'),
    }).then((confirmed) => {
      if (confirmed) void create();
    });
  }, [create, t]);

  return { ready, notebook, starting, start };
}
