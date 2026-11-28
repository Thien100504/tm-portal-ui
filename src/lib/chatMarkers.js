import { toast } from 'sonner';

// Markers in the assistant's reply stream:
//   [toast:kind]{"key","params"}[/toast]  -> a toast in the user's language
//   [error:<i18n key>]                     -> an inline, translated error
const TOAST_MARKER = /\[toast:(success|error|warning|info)\]([\s\S]*?)\[\/toast\]/g;
const ERROR_MARKER = /\[error:([\w.]+)\]/g;

function toastText(t, raw) {
  try {
    const { key, params } = JSON.parse(raw);
    return t(key, params);
  } catch {
    return raw.trim(); // older servers sent plain text
  }
}

// [confirm]{"token","kind","titles"}[/confirm] -> a confirmation card (server-made only)
const CONFIRM_MARKER = /\[confirm\]([\s\S]*?)\[\/confirm\]/g;

/** Pull confirmation cards out of the reply: { text, confirms }. */
export function extractConfirms(text) {
  const confirms = [];
  const rest = text.replace(CONFIRM_MARKER, (_, raw) => {
    try {
      const card = JSON.parse(raw);
      if (card?.token) confirms.push(card);
    } catch {
      // malformed: drop it rather than show raw markup
    }
    return '';
  });
  return { text: rest, confirms };
}

/** Show toasts and translate errors found in the reply; return the text left to display. */
export function renderMarkers(t, text) {
  return text
    .replace(TOAST_MARKER, (_, kind, raw) => {
      toast[kind](toastText(t, raw));
      return '';
    })
    .replace(ERROR_MARKER, (_, key) => `\n\n${t(key)}`);
}
