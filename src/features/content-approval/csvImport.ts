import type { Content, ContentStatus } from './types';

const columnAliases: Record<string, keyof Content | 'theme'> = {
  tema: 'theme',
  title: 'title',
  titulo: 'title',
  data: 'date',
  date: 'date',
  canal: 'channel',
  channel: 'channel',
  formato: 'format',
  format: 'format',
  link: 'link',
  texto: 'caption',
  legenda: 'caption',
  caption: 'caption',
  apontamentos: 'note',
  comentario: 'note',
  coment\u00e1rio: 'note',
  note: 'note',
  status: 'status',
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error('O CSV tem aspas sem fechamento.');
  if (field || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows;
}

function normalizeHeader(value: string): string {
  return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

function normalizeStatus(value: string): ContentStatus {
  const status = normalizeHeader(value);
  if (status.includes('aprov')) return 'aprovado';
  if (status.includes('ajuste')) return 'ajustes';
  if (status.includes('revis')) return 'revisao';
  return 'rascunho';
}

function parseDateParts(value: string): { day: number; month: number; year?: number } | null {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
  if (!match) return null;
  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  return { day, month, year: yearText ? Number(yearText) : undefined };
}

function normalizeDate(value: string, defaultYear: number): string {
  const parts = parseDateParts(value);
  if (!parts) return '';
  const { day, month, year = defaultYear } = parts;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function inferCampaignYear(rows: string[][], start: number): number {
  const weekdayNames: Record<string, number> = {
    domingo: 0,
    segunda: 1,
    segundafeira: 1,
    terca: 2,
    tercafeira: 2,
    quarta: 3,
    quartafeira: 3,
    quinta: 4,
    quintafeira: 4,
    sexta: 5,
    sextafeira: 5,
    sabado: 6,
  };
  const pairs: Array<{ day: number; month: number; weekday: number }> = [];
  for (let index = start; index < rows.length; index += 1) {
    const row = rows[index];
    if (normalizeHeader(row[0] || '') !== 'tema' || !row[1]?.trim()) continue;
    const nearbyRows = rows.slice(index + 1, index + 6);
    const nearbyCells = nearbyRows.flat();
    const date = nearbyCells.map((value) => parseDateParts(value)).find((value) => value !== null);
    const weekday = nearbyCells
      .map((value) => weekdayNames[normalizeHeader(value).replace(/[^a-z]/g, '')])
      .find((value) => value !== undefined);
    if (date && weekday !== undefined && date.year === undefined) {
      pairs.push({ day: date.day, month: date.month, weekday });
    }
  }

  const currentYear = new Date().getFullYear();
  let bestYear = currentYear;
  let bestScore = 0;
  for (let year = currentYear - 15; year <= currentYear + 1; year += 1) {
    const score = pairs.filter(({ day, month, weekday }) =>
      new Date(year, month - 1, day).getDay() === weekday,
    ).length;
    if (score > bestScore || (score === bestScore && score > 0 && Math.abs(year - currentYear) < Math.abs(bestYear - currentYear))) {
      bestYear = year;
      bestScore = score;
    }
  }
  return bestYear;
}

function emptyContent(id: string): Content {
  return {
    id,
    title: '',
    date: '',
    channel: 'Instagram',
    format: 'Feed',
    link: '',
    caption: '',
    note: '',
    status: 'rascunho',
    coverData: '',
    history: [],
    updatedAt: new Date().toISOString(),
  };
}

export function importContentCsv(text: string): Content[] {
  const rows = parseCsv(text.replace(/^\uFEFF/, ''));
  const isCampaignTemplate = rows.some((row) => row.some((value) => normalizeHeader(value) === 'apontamentos'))
    && rows.some((row) => row.some((value) => normalizeHeader(value) === 'texto'));
  const headerIndex = isCampaignTemplate
    ? rows.findIndex((row) =>
        normalizeHeader(row[0] || '') === 'tema' && Boolean(row[1]?.trim()) && row.some((value, index) => index > 1 && value.trim()),
      )
    : rows.findIndex((row) =>
        row.some((value) => ['tema', 'titulo', 'title'].includes(normalizeHeader(value))),
      );
  if (headerIndex < 0) {
    throw new Error('Não encontrei cabeçalho com coluna Tema ou Título no CSV.');
  }

  const headers = rows[headerIndex].map((value) => columnAliases[normalizeHeader(value)]);
  const columnIndex = (key: keyof Content | 'theme') => headers.indexOf(key);
  const contents: Content[] = [];

  if (isCampaignTemplate) {
    const campaignYear = inferCampaignYear(rows, headerIndex);
    const hasMultipleChannels = rows
      .slice(0, headerIndex)
      .flat()
      .join(' ')
      .toLocaleLowerCase('pt-BR')
      .includes('instagram | facebook | linkedin');
    for (let index = headerIndex; index < rows.length; index += 1) {
      const row = rows[index];
      const theme = row[1]?.trim() || '';
      if (normalizeHeader(row[0] || '') !== 'tema' || !theme) continue;

      const content = emptyContent(`csv-${crypto.randomUUID()}`);
      content.title = theme;
      content.channel = hasMultipleChannels ? 'Multicanal' : content.channel;
      content.caption = row[3]?.trim() || '';
      content.note = row[4]?.trim() || '';
      if (hasMultipleChannels) {
        content.note = [
          'Canais indicados na planilha: Instagram, Facebook e LinkedIn.',
          content.note,
        ].filter(Boolean).join('\n\n');
      }

      const nearbyRows = rows.slice(index + 1, index + 6);
      for (const candidate of nearbyRows) {
        const dateValue = candidate.map((value) => normalizeDate(value, campaignYear)).find(Boolean);
        if (dateValue) {
          content.date = dateValue;
          break;
        }
      }
      content.history = [{ status: content.status, at: content.updatedAt }];
      if (content.date) contents.push(content);
    }
    if (contents.length === 0) {
      throw new Error('Encontrei a planilha, mas não achei posts com datas válidas.');
    }
    return contents;
  }

  for (const row of rows.slice(headerIndex + 1)) {
    const get = (key: keyof Content) => {
      const index = columnIndex(key);
      return index >= 0 ? row[index]?.trim() || '' : '';
    };
    const title = get('title');
    const date = normalizeDate(get('date'), new Date().getFullYear());
    if (!title || !date) continue;

    const content = emptyContent(`csv-${crypto.randomUUID()}`);
    content.title = title;
    content.date = date;
    content.channel = get('channel') || content.channel;
    content.format = get('format') || content.format;
    content.link = get('link');
    content.caption = get('caption');
    content.note = get('note');
    content.status = normalizeStatus(get('status'));
    content.history = [{ status: content.status, at: content.updatedAt }];
    contents.push(content);
  }

  if (contents.length === 0) {
    throw new Error('Nenhuma linha com título e data válida foi encontrada no CSV.');
  }
  return contents;
}
