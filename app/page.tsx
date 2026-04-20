// DIAGNOSTIC TEMPORAIRE : prouver si Vercel sert bien notre code.
// Si curl /  affiche "HELLO-FROM-A28-NO-REDIRECT" → notre code est pris en compte.
// Si curl /  renvoie 307 /login → le problème est une règle Vercel externe.
// À remettre à redirect('/landing') dès diagnostic fait.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DiagnosticHome() {
  return (
    <div style={{ padding: 40, fontFamily: 'monospace', fontSize: 24 }}>
      HELLO-FROM-A28-NO-REDIRECT
    </div>
  );
}
