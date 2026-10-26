// Fills {{name}} and {{company}}. Falls back to neutral words when a value is missing.
export const render = (text, recipient) =>
  text.replace(/\{\{\s*(name|company)\s*\}\}/gi, (_, key) =>
    key.toLowerCase() === 'name' ? recipient.name || 'there' : recipient.company || 'your company'
  );
