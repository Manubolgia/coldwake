/** What story text can refer to. Built fresh from state each time text is rendered. */
export interface Ctx {
  ship: string;
  shipClass: string;
  you: string;
  creature: string;
  brood: string;
  broods: string;
  nest: string;
  mate: string;
  mateThey: string;
  room: string;
  clockKind: string;
}

export type Text = string | ((c: Ctx) => string);

export function render(t: Text, c: Ctx): string {
  return typeof t === 'function' ? t(c) : t;
}
