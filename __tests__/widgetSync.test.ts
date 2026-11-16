import { readFileSync } from 'fs';
import { join } from 'path';
import {
  WIDGET_SYNC_DEBOUNCE_MS,
  createDebouncedRequest,
  shouldSyncWidget,
} from '../src/hooks/useWidgetSync';

const root = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

describe('widget sync is reachable from the app', () => {
  it('mounts useWidgetSync at the app root', () => {
    const app = read('App.tsx');
    expect(app).toMatch(/import \{ useWidgetSync \} from '\.\/src\/hooks\/useWidgetSync'/);
    expect(app).toMatch(/^\s*useWidgetSync\(\);/m);
  });

  it('the hook requests an update and listens to all three stores off the render path', () => {
    const hook = read('src/hooks/useWidgetSync.ts');
    expect(hook).toMatch(/requestWidgetUpdate/);
    expect(hook).toMatch(/useElementStore\.subscribe/);
    expect(hook).toMatch(/useEventStore\.subscribe/);
    expect(hook).toMatch(/useTodoStore\.subscribe/);
    expect(hook).not.toMatch(/use(Element|Event|Todo)Store\(\(/);
  });

  it('the module JS never reaches the database', () => {
    const index = read('modules/life-widget/src/index.ts');
    expect(index).not.toMatch(/from 'expo-sqlite'|src\/db/);
  });
});

describe('shouldSyncWidget', () => {
  it('runs only on Android with the native module present', () => {
    expect(shouldSyncWidget('android', true)).toBe(true);
    expect(shouldSyncWidget('android', false)).toBe(false);
    expect(shouldSyncWidget('ios', true)).toBe(false);
    expect(shouldSyncWidget('web', true)).toBe(false);
  });
});

describe('createDebouncedRequest', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('coalesces a burst into one trailing request', () => {
    const request = jest.fn();
    const debounced = createDebouncedRequest(request);
    debounced.schedule();
    jest.advanceTimersByTime(WIDGET_SYNC_DEBOUNCE_MS - 1);
    debounced.schedule();
    jest.advanceTimersByTime(WIDGET_SYNC_DEBOUNCE_MS - 1);
    expect(request).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('flush fires a pending request at once, and only a pending one', () => {
    const request = jest.fn();
    const debounced = createDebouncedRequest(request);
    debounced.flush();
    expect(request).not.toHaveBeenCalled();
    debounced.schedule();
    debounced.flush();
    expect(request).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(WIDGET_SYNC_DEBOUNCE_MS * 2);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('cancel drops a pending request', () => {
    const request = jest.fn();
    const debounced = createDebouncedRequest(request);
    debounced.schedule();
    debounced.cancel();
    jest.advanceTimersByTime(WIDGET_SYNC_DEBOUNCE_MS * 2);
    expect(request).not.toHaveBeenCalled();
  });
});
