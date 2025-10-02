import { bold, green, red, yellow, cyan, magenta, bgGreen, bgRed } from './colors.ts';

let QUIET = false;
export function setLoggerQuiet(q: boolean) { QUIET = q; }
export function isLoggerQuiet() { return QUIET; }

function stamp(type: 'SUCCESS' | 'FAIL' | 'ERROR' | 'WARN' | 'INFO') {
  switch (type) {
    case 'SUCCESS': return bgGreen(bold(' SUCCESS '));
    case 'FAIL':
    case 'ERROR': return bgRed(bold(' FAIL '));
    case 'WARN': return yellow(bold(' WARN '));
    case 'INFO': return cyan(bold(' INFO '));
  }
}

export function info(msg: string) {
  if (QUIET) return; console.log(cyan(msg));
}
export function step(msg: string) {
  if (QUIET) return; console.log(cyan(`➜ ${msg}`));
}
export function success(msg: string) {
  if (QUIET) return; console.log(stamp('SUCCESS') + ' ' + green(msg));
}
export function error(msg: string) {
  console.error(stamp('ERROR') + ' ' + red(msg));
}
export function warn(msg: string) {
  if (QUIET) return; console.warn(stamp('WARN') + ' ' + yellow(msg));
}
export function raw(msg: string) { console.log(msg); }

// Validation errors object: { field: [messages] }
export function validationErrors(errors: Record<string, unknown>) {
  Object.entries(errors).forEach(([field, messages]) => {
    if (Array.isArray(messages)) {
      messages.forEach(m => console.error(yellow(`  • [${field}] `) + red(String(m))));
    } else {
      console.error(yellow(`  • [${field}] `) + red(String(messages)));
    }
  });
}

