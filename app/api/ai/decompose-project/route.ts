import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { checkAndIncrementAiUsage } from '@/utils/aiRateLimit';
import { decomposeProjectCore } from '@/lib/decomposeProjectCore';

/**
 * POST /api/ai/decompose-project — Sprint 12 (M3).
 * Body : { prompt: string, householdId?: string }
 * Response 200 : { ok: true, project_decomposed?: {...}, pending_question?: string }
 */

export const maxDuration = 30;

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const admin = serviceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const rate = await checkAndIncrementAiUsage(supabase, user.id);
  if (!rate.allowed) {
    return NextResponse.json({
      error: 'Limite IA atteinte', code: 'AI_LIMIT_REACHED',
      remaining: rate.remaining,
    }, { status: 429 });
  }

  let body: { prompt?: unknown; householdId?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (prompt.length < 5 || prompt.length > 1000) {
    return NextResponse.json({ error: 'Prompt requis (5 à 1000 caractères)' }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('household_id, display_name, ai_journal_consent_at')
    .eq('id', user.id).maybeSingle();

  if (!profile?.ai_journal_consent_at) {
    return NextResponse.json({ error: 'Consentement requis', code: 'CONSENT_REQUIRED' }, { status: 403 });
  }

  const householdId = (typeof body.householdId === 'string' && body.householdId)
    ? body.householdId
    : profile?.household_id;
  if (!householdId) return NextResponse.json({ error: 'Pas de foyer associé' }, { status: 400 });

  const result = await decomposeProjectCore({
    prompt,
    userId: user.id,
    userName: profile?.display_name ?? 'l\'utilisateur',
    householdId,
    supabase,
    admin,
  });

  if (result.kind === 'error') {
    return NextResponse.json({
      error: result.error,
      message: result.user_message,
    }, { status: result.http_status });
  }

  if (result.kind === 'pending') {
    return NextResponse.json({
      ok: true,
      pending_question: result.question,
      pending_missing: result.missing,
      project_decomposed: null,
    });
  }

  if (result.kind === 'duplicate') {
    return NextResponse.json({
      ok: true,
      pending_question: result.question,
      pending_duplicate: {
        existing_title: result.existing_title,
        existing_date: result.existing_date,
      },
      project_decomposed: null,
    });
  }

  if (result.kind === 'overlap_question') {
    return NextResponse.json({
      ok: true,
      pending_question: result.question,
      pending_overlap: {
        parent_task_id: result.parent_task_id,
        title: result.title,
        target_date: result.target_date,
        inserted_subtask_count: result.inserted_subtask_count,
        pending_overlap_count: result.pending_overlap_count,
      },
      project_decomposed: null,
    });
  }

  return NextResponse.json({
    ok: true,
    pending_question: null,
    project_decomposed: {
      parent_task_id: result.parent_task_id,
      title: result.title,
      description: result.description,
      target_date: result.target_date,
      subtask_count: result.subtask_count,
      subtasks: result.subtasks,
    },
    duration_ms: result.duration_ms,
  });
}
