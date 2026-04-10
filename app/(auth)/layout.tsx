/**
 * Layout pour les pages d'authentification (login, register, household).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-50 px-4">
      <div className="w-full max-w-md space-y-6">{children}</div>
    </div>
  );
}
