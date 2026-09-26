// The application and native plugin validate the same data-only layout schema.
// @ts-expect-error The existing application intentionally uses dependency-free JS.
import shared from '../../deck-layout.js';
import type {Key} from './types.js';
export const layout=shared as {normalizeKey(value:unknown):Key|null;defaultKey(command?:string,overrides?:Partial<Key>):Key;label(key:Key):string};
