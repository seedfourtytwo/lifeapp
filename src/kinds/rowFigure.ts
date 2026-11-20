export type RowFigureParts = {
  /** What is done so far, read bright. Null when the figure is a lone value. */
  done: string | null;
  /** The slash and the goal — or the whole of a lone figure. Read quiet. */
  rest: string;
};

/**
 * A row's figure, split where it reads "done / goal": the done part stands
 * out, the goal recedes. A lone figure ("15:00" with nothing done) is all rest.
 */
export function splitRowFigure(figure: string): RowFigureParts {
  const slash = figure.indexOf(' / ');
  if (slash < 0) return { done: null, rest: figure };
  return { done: figure.slice(0, slash), rest: figure.slice(slash) };
}
