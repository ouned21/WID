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

  const handleSignOut = async () => { await signOut(); router.push('/login'); };
  const handleRename = async () => { if (!newName.trim()) return; await renameHousehold(newName.trim()); setEditingName(false); };
  const handleCopyCode = () => {
    if (household?.invite_code) {
      navigator.clipboard.writeText(household.invite_code);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="pt-4 space-y-6">
      <h2 className="text-[28px] font-bold text-[#1c1c1e] px-4">Profil</h2>

      {/* Carte utilisateur */}
      <div className="mx-4 rounded-2xl bg-white p-5 flex items-center gap-4" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
        <div className="flex h-14 w-14 items-center justify-center rounded-full text-[22px] font-bold text-white" style={{ background: '#007aff' }}>
          {profile?.display_name?.charAt(0)?.toUpperCase() ?? '?'}
        </div>
        <div>
          <p className="text-[20px] font-bold text-[#1c1c1e]">{profile?.display_name}</p>
          <p className="text-[14px] text-[#8e8e93]">
            {profile?.role === 'admin' ? 'Administrateur' : 'Membre'}
          </p>
        </div>
      </div>

      {/* Foyer */}
      {household && (
        <>
          {/* Nom du foyer */}
          <div className="mx-4">
            <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-2 px-1">Foyer</p>
            <div className="rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
              {editingName ? (
                <div className="px-4 py-3 flex gap-2">
                  <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                    className="flex-1 text-[17px] text-[#1c1c1e] bg-transparent outline-none" autoFocus />
                  <button onClick={handleRename} className="text-[15px] font-semibold" style={{ color: '#007aff' }}>OK</button>
                  <button onClick={() => setEditingName(false)} className="text-[15px] text-[#8e8e93]">Annuler</button>
                </div>
              ) : (
                <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
                  <span className="text-[17px] text-[#1c1c1e] font-medium">{household.name}</span>
                  {profile?.role === 'admin' && (
                    <button onClick={() => { setEditingName(true); setNewName(household.name); }}
                      className="text-[15px] font-medium" style={{ color: '#007aff' }}>Modifier</button>
                  )}
                </div>
              )}

              {/* Code d'invitation */}
              <button onClick={handleCopyCode} className="w-full px-4 py-3 text-left">
                <p className="text-[13px] text-[#8e8e93] mb-1">
                  Code d&apos;invitation {copied && <span style={{ color: '#34c759' }}>— Copié !</span>}
                </p>
                <p className="text-[22px] font-mono font-bold tracking-[0.3em]" style={{ color: '#007aff' }}>
                  {household.invite_code}
                </p>
              </button>
            </div>
          </div>

          {/* Membres */}
          <div className="mx-4">
            <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-2 px-1">
              Membres ({members.length})
            </p>
            <div className="rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
              {members.map((member, i) => (
                <div key={member.id}
                  className="flex items-center gap-3 px-4 py-3"
                  style={i < members.length - 1 ? { borderBottom: '0.5px solid var(--ios-separator)' } : {}}>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full text-[14px] font-semibold text-white"
                    style={{ background: member.role === 'admin' ? '#007aff' : '#34c759' }}>
                    {member.display_name?.charAt(0)?.toUpperCase() ?? '?'}
                  </div>
                  <span className="flex-1 text-[17px] text-[#1c1c1e]">{member.display_name}</span>
                  <span className="text-[13px] text-[#8e8e93]">
                    {member.role === 'admin' ? 'Admin' : 'Membre'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Déconnexion */}
      <div className="mx-4">
        <button onClick={handleSignOut}
          className="w-full rounded-xl bg-white py-3 text-[17px] font-medium"
          style={{ color: '#ff3b30', boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
