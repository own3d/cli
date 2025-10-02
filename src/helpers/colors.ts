import {
  bold as _bold,
  green as _green,
  red as _red,
  yellow as _yellow,
  cyan as _cyan,
  magenta as _magenta,
  bgRed as _bgRed,
  bgGreen as _bgGreen,
  bgYellow as _bgYellow,
  underline as _underline,
} from "https://deno.land/std@0.224.0/fmt/colors.ts";

let disabled = false;
export function setColorDisabled(d: boolean) { disabled = d; }
function wrap(fn: (s:string)=>string) { return (s: string) => disabled ? s : fn(s); }
export const bold = wrap(_bold);
export const green = wrap(_green);
export const red = wrap(_red);
export const yellow = wrap(_yellow);
export const cyan = wrap(_cyan);
export const magenta = wrap(_magenta);
export const bgRed = wrap(_bgRed);
export const bgGreen = wrap(_bgGreen);
export const bgYellow = wrap(_bgYellow);
export const underline = wrap(_underline);

// convenience no-color utility
export function isColorDisabled() { return disabled; }

