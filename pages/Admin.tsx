
import React, { useState, useEffect } from 'react';
import { User, UserRole, CreditRequest, Tournament } from '../types';
import { store } from '../services/mockStore';

interface AdminProps {
  user: User;
}

const Admin: React.FC<AdminProps> = ({ user: currentUser }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [requests, setRequests] = useState<CreditRequest[]>([]);
  const [resetRequests, setResetRequests] = useState<User[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [view, setView] = useState<'users' | 'requests' | 'tournaments' | 'resets'>('users');
  
  const [isAdjusting, setIsAdjusting] = useState<User | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('0');
  const [adjustReason, setAdjustReason] = useState('Manual adjustment by Admin');

  const [isResetting, setIsResetting] = useState<User | null>(null);
  const [tempPassword, setTempPassword] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [allUsers, allRequests, allTourneys, allResets] = await Promise.all([
      store.getAllUsers(), 
      store.getCreditRequests(),
      store.getTournaments(),
      store.getResetRequests()
    ]);
    setUsers(allUsers);
    setRequests(allRequests);
    setTournaments(allTourneys);
    setResetRequests(allResets);
  }

  const handleResolveRequest = async (id: string, approved: boolean) => {
    await store.resolveCreditRequest(id, approved);
    await loadData();
  };

  const handleManualAdjust = async () => {
    if (!isAdjusting) return;
    const amount = parseInt(adjustAmount);
    if (isNaN(amount)) return alert("Invalid amount");
    
    try {
      await store.adjustCredits(isAdjusting.id, amount, adjustReason);
      setIsAdjusting(null);
      setAdjustAmount('0');
      setAdjustReason('Manual adjustment by Admin');
      await loadData();
      alert("Credits adjusted successfully.");
    } catch (err) {
      console.error(err);
      alert("Adjustment failed. You may need to re-login to sync security permissions.");
    }
  };

  const handleCompleteReset = async () => {
    if (!isResetting || !tempPassword) return;
    try {
      await store.completeReset(isResetting.id, tempPassword);
      setIsResetting(null);
      setTempPassword('');
      alert("Password reset completed.");
      await loadData();
    } catch (err) {
      alert("Failed to complete reset.");
    }
  };

  const handleDeleteUser = async (userToDelete: User) => {
    if (userToDelete.id === currentUser.id) return alert("Critical Error: You cannot delete your own profile.");
    if (!window.confirm(`SUPERADMIN ACTION: Permanently delete user profile "${userToDelete.name}" (@${userToDelete.username})?`)) return;
    
    try {
      await store.deleteUser(userToDelete.id);
      await loadData();
    } catch (err) {
      alert("Failed to delete user profile.");
    }
  };

  const handleDeleteTournament = async (id: string, name: string) => {
    if (!window.confirm(`SUPERADMIN ACTION: Permanently delete "${name}"?`)) return;
    try {
      await store.deleteTournament(id);
      await loadData();
    } catch (err) {
      alert("Failed to delete tournament.");
    }
  };

  const isSuperAdmin = currentUser.role === UserRole.SUPERADMIN;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex space-x-2 overflow-x-auto pb-2 no-scrollbar">
        <TabButton active={view === 'users'} onClick={() => setView('users')} label="User Database" />
        <TabButton active={view === 'requests'} onClick={() => setView('requests')} label="Credit Queue" count={requests.length} />
        <TabButton active={view === 'resets'} onClick={() => setView('resets')} label="Reset Tasks" count={resetRequests.length} />
        <TabButton active={view === 'tournaments'} onClick={() => setView('tournaments')} label="Arenas" count={tournaments.length} />
      </div>

      {view === 'users' && (
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
           <div className="bg-slate-900 p-6 text-white text-[10px] font-black uppercase tracking-widest">Master User Ledger</div>
           <table className="w-full text-left">
              <thead className="bg-slate-800 text-white">
                 <tr className="text-[9px] font-black uppercase tracking-[0.2em]">
                    <th className="px-8 py-5">Full Profile</th>
                    <th className="px-8 py-5">Role</th>
                    <th className="px-8 py-5 text-center">Credit Balance</th>
                    <th className="px-8 py-5 text-right">Actions</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                 {users.map(u => (
                   <tr key={u.id} className="hover:bg-indigo-50/50 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="flex items-center space-x-3">
                           <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center font-black text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">{u.name[0]}</div>
                           <div>
                              <p className="font-black text-slate-800 uppercase italic text-sm leading-none">{u.name}</p>
                              <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mt-1">@{u.username}</p>
                           </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                         <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${u.role === UserRole.SUPERADMIN ? 'bg-purple-50 text-purple-600 border border-purple-100' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}>
                           {u.role}
                         </span>
                      </td>
                      <td className="px-8 py-5 text-center font-black text-indigo-600 tabular-nums text-sm">{u.credits} CR</td>
                      <td className="px-8 py-5 text-right">
                         <div className="flex justify-end space-x-2">
                           <button 
                             onClick={() => setIsAdjusting(u)}
                             className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                           >Top Up</button>
                           {isSuperAdmin && u.id !== currentUser.id && (
                             <button 
                               onClick={() => handleDeleteUser(u)}
                               className="bg-rose-50 text-rose-500 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                             >Delete</button>
                           )}
                         </div>
                      </td>
                   </tr>
                 ))}
              </tbody>
           </table>
        </div>
      )}

      {view === 'resets' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4">
           {resetRequests.map(u => (
             <div key={u.id} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-rose-500"></div>
                <div className="flex items-center space-x-4 mb-6">
                   <div className="w-12 h-12 bg-rose-50 text-rose-500 border border-rose-100 rounded-2xl flex items-center justify-center font-black text-xl italic">!</div>
                   <div>
                      <h4 className="font-black text-slate-800 uppercase tracking-tighter italic">{u.name}</h4>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">@{u.username}</p>
                   </div>
                </div>
                <button 
                  onClick={() => setIsResetting(u)} 
                  className="w-full bg-slate-900 text-white font-black py-4 rounded-xl uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-all"
                >Override Access</button>
             </div>
           ))}
           {resetRequests.length === 0 && <div className="col-span-full py-24 text-center bg-white rounded-[3rem] border border-dashed border-slate-200"><p className="text-slate-300 font-black uppercase tracking-widest text-xs italic">Clear: No pending reset tasks.</p></div>}
        </div>
      )}

      {view === 'requests' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4">
           {requests.map(req => (
             <div key={req.id} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl transition-all">
                <div className="flex justify-between items-start mb-6">
                   <div>
                      <h4 className="font-black text-slate-800 uppercase tracking-tighter italic text-lg leading-none">@{req.username}</h4>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">{new Date(req.timestamp).toLocaleString()}</p>
                   </div>
                   <div className="text-2xl font-black text-indigo-600 italic tracking-tighter">+{req.amount} CR</div>
                </div>
                <div className="flex space-x-3">
                   <button onClick={() => handleResolveRequest(req.id, true)} className="flex-1 bg-emerald-500 text-white font-black py-4 rounded-xl uppercase tracking-widest text-[9px] shadow-lg shadow-emerald-100 active:scale-95 transition-all">Approve</button>
                   <button onClick={() => handleResolveRequest(req.id, false)} className="flex-1 bg-rose-50 text-rose-500 font-black py-4 rounded-xl uppercase tracking-widest text-[9px] hover:bg-rose-500 hover:text-white transition-all">Reject</button>
                </div>
             </div>
           ))}
           {requests.length === 0 && <div className="col-span-full py-24 text-center bg-white rounded-[3rem] border border-dashed border-slate-200"><p className="text-slate-300 font-black uppercase tracking-widest text-xs italic">Clear: No credit top-up requests.</p></div>}
        </div>
      )}

      {view === 'tournaments' && (
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
           <div className="bg-slate-900 p-6 text-white text-[10px] font-black uppercase tracking-widest">Active Arena Index</div>
           <table className="w-full text-left">
              <thead className="bg-slate-800 text-white">
                 <tr className="text-[9px] font-black uppercase tracking-[0.2em]">
                    <th className="px-8 py-5">Arena Profile</th>
                    <th className="px-8 py-5">Organizer</th>
                    <th className="px-8 py-5">Access Mode</th>
                    <th className="px-8 py-5 text-right">Action</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                 {tournaments.map(t => (
                   <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-8 py-5">
                         <p className="font-black text-slate-800 uppercase italic text-sm leading-none">{t.name}</p>
                         <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">ID: {t.uniqueId}</p>
                      </td>
                      <td className="px-8 py-5">
                         <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{users.find(u => u.id === t.organizerId)?.name || 'Unknown'}</p>
                      </td>
                      <td className="px-8 py-5">
                         <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${t.isPublic ? 'bg-indigo-50 text-indigo-500 border border-indigo-100' : 'bg-slate-100 text-slate-400'}`}>
                           {t.isPublic ? 'Open Access' : 'Protected'}
                         </span>
                      </td>
                      <td className="px-8 py-5 text-right">
                         <button 
                           onClick={() => handleDeleteTournament(t.id, t.name)}
                           className="bg-rose-50 text-rose-500 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all"
                         >Dismantle</button>
                      </td>
                   </tr>
                 ))}
              </tbody>
           </table>
        </div>
      )}

      {/* Top Up Modal */}
      {isAdjusting && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl animate-in zoom-in">
            <h4 className="text-2xl font-black text-slate-800 uppercase italic mb-6">Manual Top Up</h4>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Credits Amount</label>
                <input 
                  type="number" 
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 outline-none font-bold"
                  value={adjustAmount} 
                  onChange={e => setAdjustAmount(e.target.value)} 
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reason / Note</label>
                <input 
                  type="text" 
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 outline-none font-bold"
                  value={adjustReason} 
                  onChange={e => setAdjustReason(e.target.value)} 
                />
              </div>
            </div>
            <div className="flex space-x-3 mt-8">
              <button onClick={() => setIsAdjusting(null)} className="flex-1 py-4 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
              <button onClick={handleManualAdjust} className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase shadow-xl hover:bg-indigo-700 transition-all">Confirm Top Up</button>
            </div>
          </div>
        </div>
      )}

      {/* Override Access Modal */}
      {isResetting && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl animate-in zoom-in">
            <h4 className="text-2xl font-black text-slate-800 uppercase italic mb-6">Override Access</h4>
            <p className="text-[11px] text-slate-400 font-bold uppercase mb-6 tracking-tight">Assign a temporary password for @{isResetting.username}</p>
            <input 
              type="text" 
              placeholder="New Temp Password"
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 outline-none font-bold"
              value={tempPassword} 
              onChange={e => setTempPassword(e.target.value)} 
            />
            <div className="flex space-x-3 mt-8">
              <button onClick={() => setIsResetting(null)} className="flex-1 py-4 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
              <button onClick={handleCompleteReset} className="flex-1 bg-slate-900 text-white py-4 rounded-2xl text-[10px] font-black uppercase shadow-xl hover:bg-slate-800 transition-all">Complete Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const TabButton = ({ active, onClick, label, count }: any) => (
  <button 
    onClick={onClick} 
    className={`px-10 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all flex items-center space-x-3 shrink-0 ${active ? 'bg-indigo-600 text-white shadow-2xl scale-105' : 'text-slate-400 hover:text-slate-900 bg-white border border-slate-200'}`}
  >
    <span>{label}</span>
    {count !== undefined && <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black ${active ? 'bg-white text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>{count}</span>}
  </button>
);

export default Admin;
