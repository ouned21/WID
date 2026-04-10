'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useHouseholdStore } from '@/stores/householdStore';

export default function ProfilePage() {
  const router = useRouter();
  const { profile, signOut } = useAuthStore();
  const { household, members } = useHouseholdStore();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Profil</h2>

      {/* Info utilisateur */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
          Compte
        </h3>
        <p className="text-lg font-medium text-slate-900">{profile?.display_name}</p>
        <p className="text-sm text-slate-500">
          Role : {profile?.role === 'admin' ? 'Administrateur' : 'Membre'}
        </p>
      </section>

      {/* Info foyer */}
      {household && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
            Foyer
          </h3>
          <p className="text-lg font-medium text-slate-900">{household.name}</p>

          {/* Code d'invitation */}
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500 mb-1">Code d&apos;invitation</p>
            <p className="text-xl font-mono font-bold tracking-widest text-slate-900">
              {household.invite_code}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Partagez ce code pour inviter quelqu&apos;un dans votre foyer
            </p>
          </div>

          {/* Membres */}
          <div>
            <p className="text-xs text-slate-500 mb-2">
              Membres ({members.length})
            </p>
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                >
                  <span className="text-sm font-medium text-slate-900">
                    {member.display_name}
                  </span>
                  <span className="text-xs text-slate-400">
                    {member.role === 'admin' ? 'Admin' : 'Membre'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Deconnexion */}
      <button
        onClick={handleSignOut}
        className="w-full rounded-lg border border-red-200 bg-red-50 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100"
      >
        Se déconnecter
      </button>
    </div>
  );
}
