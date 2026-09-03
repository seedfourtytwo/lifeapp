/**
 * Minimal local types for react-test-renderer, which ships without its own and
 * is present transitively via react-native. Enough for the component
 * regression tests; not a full surface.
 */
declare module 'react-test-renderer' {
  import type { ReactElement } from 'react';

  /**
   * Props come back as `unknown` on purpose: the real ones are `any`, and a
   * test that wants to read one says which shape it expects at the cast.
   */
  export interface ReactTestInstance {
    readonly type: unknown;
    readonly props: Record<string, unknown>;
    readonly parent: ReactTestInstance | null;
    readonly children: (ReactTestInstance | string)[];
    find(predicate: (node: ReactTestInstance) => boolean): ReactTestInstance;
    findAll(predicate: (node: ReactTestInstance) => boolean): ReactTestInstance[];
    findByType(type: unknown): ReactTestInstance;
    findAllByType(type: unknown): ReactTestInstance[];
  }

  export interface ReactTestRenderer {
    readonly root: ReactTestInstance;
    update(element: ReactElement): void;
    unmount(): void;
    toJSON(): unknown;
  }

  export function create(element: ReactElement): ReactTestRenderer;
  export function act(callback: () => void): void;

  const TestRenderer: {
    create: typeof create;
    act: typeof act;
  };
  export default TestRenderer;
}
