/**
 * Renders the small subset of Markdown the assistant writes: **bold**, *italic*,
 * ~~strike~~, `code`, headings, bullet / numbered lists, quotes, rules, code
 * blocks, tables and http(s) links. Everything becomes React elements (no HTML
 * injection), and half-written syntax while streaming simply shows as text.
 */

// `code` | **bold** / __bold__ | ~~strike~~ | *italic* / _italic_ | [text](http…)
// _italic_ needs non-word characters around it so snake_case (in_progress) stays text
const INLINE_SOURCE =
  '(`[^`]+`)|(\\*\\*[^*]+?\\*\\*|__[^_]+?__)|(~~[^~]+?~~)|(\\*[^*\\s][^*]*?\\*|(?<![\\w])_[^_\\s][^_]*?_(?![\\w]))|(\\[[^\\]]+\\]\\((https?:\\/\\/[^)\\s]+)\\))';

function inline(text, keyPrefix) {
  const pattern = new RegExp(INLINE_SOURCE, 'g'); // a fresh one per call: this recurses
  const out = [];
  let last = 0;
  let match;
  let n = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}.${n++}`;
    if (match[1]) {
      out.push(
        <code key={key} className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
          {token.slice(1, -1)}
        </code>
      );
    } else if (match[2]) {
      out.push(
        <strong key={key} className="font-semibold">
          {inline(token.slice(2, -2), key)}
        </strong>
      );
    } else if (match[3]) {
      out.push(<del key={key}>{inline(token.slice(2, -2), key)}</del>);
    } else if (match[4]) {
      out.push(<em key={key}>{inline(token.slice(1, -1), key)}</em>);
    } else if (match[5]) {
      const label = token.slice(1, token.indexOf(']('));
      out.push(
        <a
          key={key}
          href={match[6]}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 text-[color:var(--color-ai)]"
        >
          {inline(label, key)}
        </a>
      );
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const FENCE = /^\s*```/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^(\s*)[-*+]\s+(.*)$/;
const ORDERED = /^(\s*)(\d+)[.)]\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function cells(row) {
  return row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

/** Split the text into blocks: paragraph, heading, list, quote, rule, code, table. */
function parseBlocks(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (FENCE.test(line)) {
      const body = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i])) body.push(lines[i++]);
      i++; // closing fence (absent while streaming)
      blocks.push({ type: 'code', text: body.join('\n') });
      continue;
    }
    if (RULE.test(line)) {
      blocks.push({ type: 'rule' });
      i++;
      continue;
    }
    const heading = line.match(HEADING);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
      i++;
      continue;
    }
    if (line.includes('|') && i + 1 < lines.length && TABLE_SEPARATOR.test(lines[i + 1])) {
      const head = cells(line);
      const rows = [];
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim())
        rows.push(cells(lines[i++]));
      blocks.push({ type: 'table', head, rows });
      continue;
    }
    if (BULLET.test(line) || ORDERED.test(line)) {
      const ordered = ORDERED.test(line);
      const items = [];
      while (i < lines.length) {
        const num = lines[i].match(ORDERED);
        const dot = num ? null : lines[i].match(BULLET);
        const m = num || dot;
        // the list's own kind at any depth; the other kind only nested under it
        if (m && ((ordered ? num : dot) || m[1].length >= 2)) {
          items.push({
            depth: Math.floor(m[1].length / 2),
            text: num ? num[3] : dot[2],
            number: num ? Number(num[2]) : null,
          });
          i++;
        } else if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length) {
          // a wrapped continuation of the previous item
          items[items.length - 1].text += ` ${lines[i].trim()}`;
          i++;
        } else {
          break;
        }
      }
      const start = ordered ? Number(line.match(ORDERED)[2]) : 1;
      blocks.push({ type: ordered ? 'ol' : 'ul', start, items });
      continue;
    }
    if (QUOTE.test(line)) {
      const body = [];
      while (i < lines.length && QUOTE.test(lines[i])) body.push(lines[i++].match(QUOTE)[1]);
      blocks.push({ type: 'quote', text: body.join('\n') });
      continue;
    }
    const body = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !FENCE.test(lines[i]) &&
      !HEADING.test(lines[i]) &&
      !BULLET.test(lines[i]) &&
      !ORDERED.test(lines[i]) &&
      !QUOTE.test(lines[i]) &&
      !RULE.test(lines[i])
    ) {
      body.push(lines[i++]);
    }
    blocks.push({ type: 'p', lines: body });
  }
  return blocks;
}

function withBreaks(lines, key) {
  return lines.flatMap((l, n) =>
    n === 0 ? inline(l, `${key}.${n}`) : [<br key={`${key}.br${n}`} />, ...inline(l, `${key}.${n}`)]
  );
}

export default function ChatMarkdown({ text }) {
  const blocks = parseBlocks(text || '');
  return (
    <div className="space-y-1.5 break-words">
      {blocks.map((b, n) => {
        const key = `b${n}`;
        switch (b.type) {
          case 'heading':
            return (
              <p key={key} className={`font-semibold ${b.level <= 2 ? 'text-[13px]' : ''}`}>
                {inline(b.text, key)}
              </p>
            );
          case 'ul':
          case 'ol': {
            const List = b.type;
            return (
              <List
                key={key}
                start={b.type === 'ol' ? b.start : undefined}
                className={`${b.type === 'ol' ? 'list-decimal pl-5' : 'list-disc pl-4'} space-y-0.5`}
              >
                {b.items.map((item, m) => (
                  <li
                    key={`${key}.${m}`}
                    // nested items keep their own marker: a bullet under a number and vice versa
                    value={b.type === 'ol' && item.number !== null ? item.number : undefined}
                    style={{
                      marginLeft: item.depth * 12,
                      listStyleType:
                        item.number === null ? 'disc' : b.type === 'ul' ? 'decimal' : undefined,
                    }}
                  >
                    {inline(item.text, `${key}.${m}`)}
                  </li>
                ))}
              </List>
            );
          }
          case 'quote':
            return (
              <blockquote
                key={key}
                className="border-l-2 border-[color:var(--color-ai)]/40 pl-2 text-muted-foreground"
              >
                {withBreaks(b.text.split('\n'), key)}
              </blockquote>
            );
          case 'rule':
            return <hr key={key} className="border-border" />;
          case 'code':
            return (
              <pre
                key={key}
                className="overflow-x-auto rounded-md bg-muted px-2 py-1.5 font-mono text-[11px] whitespace-pre"
              >
                <code>{b.text}</code>
              </pre>
            );
          case 'table':
            return (
              <div key={key} className="overflow-x-auto">
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr>
                      {b.head.map((c, m) => (
                        <th
                          key={m}
                          className="border border-border bg-muted/60 px-1.5 py-1 text-left font-semibold"
                        >
                          {inline(c, `${key}.h${m}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row, r) => (
                      <tr key={r}>
                        {row.map((c, m) => (
                          <td key={m} className="border border-border px-1.5 py-1 align-top">
                            {inline(c, `${key}.${r}.${m}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default:
            return <p key={key}>{withBreaks(b.lines, key)}</p>;
        }
      })}
    </div>
  );
}
