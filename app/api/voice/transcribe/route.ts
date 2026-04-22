/**
 * API Route : /api/voice/transcribe
 *
 * Proxy vers Deepgram STT — reçoit un blob audio (WebM/OGG) du frontend,
 * retourne la transcription en texte.
 *
 * Avantages vs Web Speech API :
 * - 10x plus précis sur le français (nombres, prénoms, noms propres)
 * - Pas limité au navigateur (fonctionne partout)
 * - Clé API côté serveur (jamais exposée au client)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

async function getAuthUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  if (!DEEPGRAM_API_KEY) {
    // Fallback gracieux si clé absente
    return NextResponse.json({ error: 'DEEPGRAM_API_KEY manquante', fallback: true }, { status: 503 });
  }

  try {
    const audioBuffer = await req.arrayBuffer();
    const contentType = req.headers.get('content-type') ?? 'audio/webm';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    const dgRes = await fetch(
      'https://api.deepgram.com/v1/listen?model=nova-2&language=fr&smart_format=true&numerals=true',
      {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Token ${DEEPGRAM_API_KEY}`,
          'Content-Type': contentType,
        },
        body: audioBuffer,
      },
    );
    clearTimeout(timeout);

    if (!dgRes.ok) {
      const errText = await dgRes.text();
      console.error('[voice/transcribe] Deepgram error:', errText);
      return NextResponse.json({ error: 'Erreur Deepgram', fallback: true }, { status: 502 });
    }

    const data = await dgRes.json() as {
      results?: { channels?: { alternatives?: { transcript?: string }[] }[] };
    };

    const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';
    return NextResponse.json({ transcript });

  } catch (err) {
    console.error('[voice/transcribe] Exception:', err);
    return NextResponse.json({ error: 'Erreur serveur', fallback: true }, { status: 500 });
  }
}
