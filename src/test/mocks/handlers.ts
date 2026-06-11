import { http, HttpResponse } from 'msw';

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321';

const REST = `${SUPABASE_URL}/rest/v1`;
const AUTH = `${SUPABASE_URL}/auth/v1`;
const STORAGE = `${SUPABASE_URL}/storage/v1`;

type Row = Record<string, unknown>;

const tables: Record<string, Row[]> = {
  skills: [],
  projects: [],
  project_screenshots: [],
  project_technologies: [],
};

export function resetMockData(seed?: Partial<Record<string, Row[]>>) {
  for (const key of Object.keys(tables)) {
    tables[key] = seed?.[key] ? [...(seed[key] as Row[])] : [];
  }
}

function getTable(name: string): Row[] {
  if (!(name in tables)) tables[name] = [];
  return tables[name]!;
}

export const handlers = [
  http.get(`${REST}/:table`, ({ params }) => {
    const rows = getTable(params.table as string);
    return HttpResponse.json(rows);
  }),

  http.post(`${REST}/:table`, async ({ params, request }) => {
    const body = (await request.json()) as Row | Row[];
    const incoming = Array.isArray(body) ? body : [body];
    const rows = getTable(params.table as string);
    rows.push(...incoming);
    return HttpResponse.json(incoming, { status: 201 });
  }),

  http.patch(`${REST}/:table`, async ({ params, request }) => {
    const body = (await request.json()) as Row;
    const rows = getTable(params.table as string);
    const updated = rows.map((row) => ({ ...row, ...body }));
    tables[params.table as string] = updated;
    return HttpResponse.json(updated);
  }),

  http.delete(`${REST}/:table`, ({ params }) => {
    tables[params.table as string] = [];
    return HttpResponse.json([]);
  }),

  http.get(`${AUTH}/user`, () =>
    HttpResponse.json({
      id: '00000000-0000-0000-0000-000000000000',
      email: 'admin@example.com',
    }),
  ),

  http.post(`${STORAGE}/object/:bucket/*`, () =>
    HttpResponse.json({ Key: 'mocked-key' }),
  ),

  http.delete(`${STORAGE}/object/:bucket/*`, () =>
    HttpResponse.json({ message: 'deleted' }),
  ),
];
