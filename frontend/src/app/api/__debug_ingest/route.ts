import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEBUG_ENDPOINT =
  'http://127.0.0.1:7543/ingest/0e23547d-37f1-488d-8999-9cd629cca9d9';

export async function POST(req: NextRequest): Promise<Response> {
  // Nunca registrar o body aqui (pode conter dados sensíveis se instrumentação errar).
  const payload = await req.text();

  try {
    await fetch(DEBUG_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '7c6484',
      },
      body: payload,
    });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}

