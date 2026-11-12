/**
 * The kit gallery is a development tool: it is reachable in a development
 * build and absent from a release one, both from the route table and from
 * the Settings row that leads to it.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

type DevRoutes = typeof import('../src/navigation/devRoutes');

function routesWhen(dev: boolean): DevRoutes['DEV_SETTINGS_SCREENS'] {
  const global = globalThis as { __DEV__?: boolean };
  const before = global.__DEV__;
  global.__DEV__ = dev;
  let routes: DevRoutes['DEV_SETTINGS_SCREENS'] = [];
  jest.isolateModules(() => {
    routes = (jest.requireActual('../src/navigation/devRoutes') as DevRoutes).DEV_SETTINGS_SCREENS;
  });
  global.__DEV__ = before;
  return routes;
}

describe('development routes', () => {
  it('registers the kit gallery in a development build', () => {
    expect(routesWhen(true).map((route) => route.name)).toEqual(['KitGallery']);
  });

  it('leaves it out of the production route table', () => {
    expect(routesWhen(false)).toEqual([]);
  });

  it('opens the gallery from Settings only behind the development flag', () => {
    const settings = readFileSync(join(__dirname, '../src/screens/settings/AppSettingsScreen.tsx'), 'utf8');
    const opens = [...settings.matchAll(/navigate\('KitGallery'\)/g)];
    expect(opens).toHaveLength(1);
    const before = settings.slice(0, opens[0]!.index);
    const guard = before.lastIndexOf('{__DEV__ ? (');
    expect(guard).toBeGreaterThan(-1);
    // Still inside that guard: it has not been closed yet.
    expect(before.slice(guard)).not.toContain(') : null}');
  });
});
