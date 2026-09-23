export function f(x: any): void {
  // @ts-ignore
  return x;
}
// @ts-expect-error
export const y = 1;
