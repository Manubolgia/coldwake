/**
 * The MNBG tape library runs its games in a frame named "mnbglibrary". Inside
 * it, the home screen offers a way back, which asks the library to eject us.
 */
export const inLibrary = typeof window !== 'undefined' && window.parent !== window && window.name === 'mnbglibrary';

// Tell the library we have our own way back, so it can hide its eject tab.
if (inLibrary) window.parent.postMessage({ type: 'mnbglibrary:hello', exit: true }, location.origin);

export function backToLibrary(): void {
  window.parent.postMessage({ type: 'mnbglibrary:eject' }, location.origin);
}
