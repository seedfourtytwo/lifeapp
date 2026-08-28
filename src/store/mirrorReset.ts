/**
 * The one member every SQLite mirror exposes for "an import or Clear data just
 * replaced the rows I mirror".
 *
 * Each store blanks its own fields. The list of what a store holds belongs with
 * that store and not with the import/clear coordinator, which used to spell all
 * of them out from outside: a field added to a store and forgotten there
 * survived the wipe and kept showing pre-clear data.
 *
 * Refilling is deliberately not part of this. The order mirrors come back in is
 * global — elements before the day maps keyed off them, settings before the
 * language they select — so `reloadStoresAfterImport` keeps that.
 */
export interface ResettableMirror {
  /** Return to an empty state: the rows behind this mirror are gone. */
  reset: () => Promise<void>;
}
