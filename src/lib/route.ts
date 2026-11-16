import { useEffect, useState } from 'react';
import type { CityId, Tier } from './types';
import type { Who } from './cost';

export interface Route { path: string; query: URLSearchParams }

function parse(): Route {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, q = ''] = raw.split('?');
  return { path: path || '', query: new URLSearchParams(q) };
}

/** Tiny hash router: #/costs, #/workings?city=boston */
export function useRoute(): Route {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => { setRoute(parse()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

/** Link to the build-up of one total. Extra fields pin the scenario (used by the matrix). */
export function workingsHref(city: CityId, who: Who, cell?: { tier: Tier; nights: number; group: number }): string {
  const q = new URLSearchParams({ city, who });
  if (cell) { q.set('tier', cell.tier); q.set('nights', String(cell.nights)); q.set('group', String(cell.group)); }
  return `#/workings?${q}`;
}
