'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useHouseholdStore } from '@/stores/householdStore';

export default function ProfilePage() {
  const router = useRouter();
  const { profile, signOut } = useAuthStore();
  const { household, members, renameHousehold } = useHouseholdStore();

  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [copied, setCopied] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const handleRename = async () => {
    if (!newName.trim()) return;
    await renameHousehold(newName.trim());
    setEditingName(false);
  };

  const handleCopyCode = () => {
    if (household?.invite_code) {
      navigator.clipboard.writeText(household.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Profil</h2>

      {/* Info utilisateur */}
      <section className="rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 p-5 text-white shadow-md">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-2xl font-bold">
            {profile?.display_name?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          <div>
            <p className="text-xl font-bold">{profile?.display_name}</p>
            <p className="text-sm text-indigo-200">
              {profile?.role === 'admin' ? 'Administrateur' : 'Membre'}
            </p>
          </div>
        </div>
      </section>

      {/* Info foyer */}
      {household && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
              Foyer
            </h3>
            {profile?.role === 'admin' && (
              <button
                onClick={() => { setEditingName(true); setNewName(household.name); }}
                className="text-xs text-indigo-600 font-medium hover:underline"
              >
                Renommer
              </button>
            )}
          </div>

          {editingName ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                autoFocus
              />
              <button
                onClick={handleRename}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white"
              >
                OK
              </button>
              <button
                onClick={() => setEditingName(false)}
                className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600"
              >
                Annuler
              </button>
            </div>
          ) : (
            <p className="text-lg font-bold text-slate-900">{household.name}</p>
          )}

          {/* Code d'invitation */}
          <div
            onClick={handleCopyCode}
            className="cursor-pointer rounded-xl bg-gradient-to-r from-indigo-50 to-violet-50 p-4 border border-indigo-100 hover:border-indigo-200 transition-colors"
          >
            <p className="text-xs text-indigo-500 font-medium mb-1">
              Code d&apos;invitation — {copied ? 'Copié !' : 'cliquez pour copier'}
            </p>
            <p className="text-2xl font-mono font-bold tracking-[0.3em] text-indigo-700">
              {household.invite_code}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Partagez ce code pour inviter quelqu&apos;un dans votre foyer
            </p>
          </div>

          {/* Membres */}
          <div>
            <p className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Membres ({members.length})
            </p>
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3"
                >
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white ${
                    member.role === 'admin' ? 'bg-indigo-500' : 'bg-emerald-500'
                  }`}>
                    {member.display_name?.charAt(0)?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-semibold text-slate-900">
                      {member.display_name}
                    </span>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    member.role === 'admin'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    {member.role === 'admin' ? 'Admin' : 'Membre'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Déconnexion */}
      <button
        onClick={handleSignOut}
        className="w-full rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors"
      >
        Se déconnecter
      </button>
    </div>
  );
}
