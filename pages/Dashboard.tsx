
import React, { useState, useEffect } from 'react';
import { Tournament, Match, User } from '../types';
import { store } from '../services/mockStore';

const Dashboard: React.FC<{ user: User }> = ({ user }) => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [topUsers, setTopUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCopyMsg, setShowCopyMsg] = useState(false);
  
  // Credit Request State
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestAmount, setRequestAmount] = useState('500');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const WHATSAPP_NUM = "+91 72599 04829";

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [t, m, u] = await Promise.all([
          store.getTournaments(),
          store.getMatchesForUser(user.id),
          store.getAllUsers()
        ]);
        setTournaments(t);
        setMatches(m);
        setTopUsers(u.sort((a, b) => b.credits - a.credits).slice(0, 5));
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user.id]);

  const copyNumber = () => {
    navigator.clipboard.writeText(WHATSAPP_NUM);
    setShowCopyMsg(true);
    setTimeout(() => setShowCopyMsg(false), 2000);
  };

  const handleSendRequest = async () => {
    const amount = parseInt(requestAmount);
    if (isNaN(amount) || amount <= 0) return alert("Please enter a valid amount.");
    
    setIsSubmitting(true);
    try {
      await store.requestCredits(user.id, user.username, amount);
      alert("Credit request submitted to Admin queue!");
      setShowRequestModal(false);
    } catch (err) {
      alert("Failed to submit request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Win Rate" value={`${matches.length > 0 ? Math.round((matches.filter(m => m.winnerId === user.id).length / matches.length) * 100) : 0}%`} trend="Overall" icon="🎯" />
        <StatCard title="Tournaments" value={tournaments.length.toString()} trend="Active" icon="🏆" />
        <StatCard title="Credits Earned" value={user.credits.toString()} trend="Live Balance" icon="💎" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-600 text-white border-l-4 border-indigo-800">
              <h3 className="font-black uppercase tracking-widest text-sm italic">Recent Match History</h3>
              <button className="text-white text-xs font-black hover:underline uppercase tracking-widest">History →</button>
            </div>
            <div className="divide-y divide-slate-100">
              {matches.length > 0 ? matches.map(match => (
                <div key={match.id} className="p-6 flex items-center justify-between hover:bg-indigo-50/50 transition-colors border-l-4 border-transparent hover:border-indigo-600">
                  <div className="flex items-center space-x-4">
                    <div className="flex -space-x-3">
                      {match.participants.map(pId => (
                        <div key={pId} className="w-12 h-12 rounded-full border-4 border-white bg-slate-200 flex items-center justify-center text-sm font-black text-slate-600 shadow-sm">
                          {pId[0].toUpperCase()}
                        </div>
                      ))}
                    </div>
                    <div>
                      <p className="font-black text-slate-800 uppercase italic">Match #{match.id.slice(-4)}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(match.startTime).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-black uppercase tracking-widest ${match.winnerId === user.id ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {match.winnerId === user.id ? 'Victory' : 'Defeat'}
                    </p>
                    <p className="text-xl font-black text-slate-700 font-mono tracking-tighter">
                      {match.scores.map(s => `${s.s1}-${s.s2}`).join(' / ')}
                    </p>
                  </div>
                </div>
              )) : (
                <div className="p-16 text-center">
                  <div className="text-4xl mb-4">🏸</div>
                  <p className="text-slate-400 font-black uppercase tracking-widest text-xs italic">No matches recorded in the database yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-indigo-700 rounded-3xl p-8 text-white shadow-xl shadow-indigo-200 relative overflow-hidden group border border-indigo-500">
            <div className="relative z-10">
              <h3 className="font-black text-2xl mb-2 italic tracking-tighter">Top Up Credits</h3>
              <p className="text-indigo-100 text-[11px] font-bold uppercase tracking-widest mb-6 leading-relaxed">Request credits directly via app or WhatsApp support:</p>
              
              <button 
                onClick={() => setShowRequestModal(true)}
                className="w-full bg-white text-indigo-700 font-black py-4 rounded-2xl mb-4 hover:bg-indigo-50 transition-all shadow-lg transform active:scale-95 uppercase tracking-widest text-xs flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 0v4m0-4h4m-4 0H8m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                In-App Request
              </button>

              <div className="bg-indigo-800/50 p-4 rounded-2xl border border-indigo-400/30 mb-6 flex items-center justify-between group/number hover:bg-indigo-800 transition-all">
                 <span className="font-black text-lg tracking-tighter italic">{WHATSAPP_NUM}</span>
                 <button onClick={copyNumber} className="bg-white text-indigo-700 p-2 rounded-xl shadow-lg active:scale-90 transition-all hover:bg-indigo-50">
                   {showCopyMsg ? (
                     <span className="text-[9px] font-black uppercase px-2">Copied!</span>
                   ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                   )}
                 </button>
              </div>

              <a 
                href={`https://wa.me/${WHATSAPP_NUM.replace(/[^0-9]/g, '')}`} 
                target="_blank" 
                className="block text-center w-full bg-emerald-500 text-white font-black py-4 rounded-2xl hover:bg-emerald-600 transition-all shadow-lg transform active:scale-95 uppercase tracking-widest text-xs"
              >
                Contact Support
              </a>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-0 shadow-sm border border-slate-200 overflow-hidden">
            <h3 className="font-black text-white bg-slate-800 uppercase tracking-widest text-[10px] p-5">Cloud Leaderboard</h3>
            <div className="p-4 space-y-3">
              {topUsers.map((u, idx) => (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                  <div className="flex items-center space-x-4">
                    <span className={`text-[10px] font-black w-7 h-7 flex items-center justify-center rounded-xl ${idx === 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                      {idx + 1}
                    </span>
                    <div>
                      <span className="font-black text-slate-800 block text-xs uppercase italic tracking-tighter">{u.name}</span>
                      <span className="text-[9px] text-slate-400 uppercase font-bold tracking-[0.2em]">@{u.username}</span>
                    </div>
                  </div>
                  <span className="text-indigo-600 font-black text-xs tabular-nums">{u.credits} CR</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Credit Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl animate-in zoom-in">
            <h4 className="text-2xl font-black text-slate-800 uppercase italic mb-6">Request Credits</h4>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Credits Amount</label>
                <input 
                  type="number" 
                  step="50"
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 outline-none font-black text-xl"
                  value={requestAmount} 
                  onChange={e => setRequestAmount(e.target.value)} 
                />
                <p className="text-[9px] text-slate-400 font-bold uppercase mt-2 ml-1">Credits will be added once approved by Admin.</p>
              </div>
            </div>
            <div className="flex space-x-3 mt-8">
              <button 
                onClick={() => setShowRequestModal(false)} 
                className="flex-1 py-4 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSendRequest} 
                disabled={isSubmitting}
                className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase shadow-xl hover:bg-indigo-700 transition-all disabled:opacity-50"
              >
                {isSubmitting ? 'Sending...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ title, value, trend, icon }: any) => (
  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex items-center justify-between hover:shadow-xl transition-all group">
    <div>
      <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">{title}</p>
      <div className="flex items-baseline space-x-2">
        <h4 className="text-3xl font-black text-slate-800 tracking-tighter italic">{value}</h4>
        <span className="text-emerald-500 text-[9px] font-black bg-emerald-50 px-2 py-1 rounded-lg uppercase tracking-widest">{trend}</span>
      </div>
    </div>
    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-3xl shadow-inner group-hover:scale-110 transition-transform">{icon}</div>
  </div>
);

export default Dashboard;
