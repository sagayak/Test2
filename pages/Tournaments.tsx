import React, { useState, useEffect, useRef } from 'react';
import { Tournament, User, UserRole, TournamentType, MatchFormat } from '../types';
import { store } from '../services/mockStore';
import TournamentDetails from './TournamentDetails';

const Tournaments: React.FC<{ user: User, initialJoinId?: string | null }> = ({ user, initialJoinId }) => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [searchId, setSearchId] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [newTourney, setNewTourney] = useState<Partial<Tournament>>({
    name: '', venue: '', startDate: '', endDate: '',
    type: TournamentType.LEAGUE, format: MatchFormat.SINGLES,
    numCourts: 2, isPublic: true, playerLimit: 32, scorerPin: '0000',
    poster: ''
  });

  useEffect(() => { 
    loadData().then(() => {
      if (initialJoinId) {
        handleJoinFromLink(initialJoinId);
      }
    }); 
  }, []);

  async function loadData() {
    const [allTourneys, allUsers] = await Promise.all([
      store.getTournaments(),
      store.getAllUsers()
    ]);
    
    setUsers(allUsers);
    setTournaments(allTourneys.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()));
  }

  const handleJoinFromLink = async (uniqueId: string) => {
    const t = await store.searchTournamentById(uniqueId);
    if (t) {
      setSelectedTournament(t);
      // Clean up URL after successful redirect
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  const handleSearch = async () => {
    if (!searchId) return;
    const t = await store.searchTournamentById(searchId);
    if (t) {
       setSelectedTournament(t);
    } else {
      setError("Tournament ID not found");
    }
  };

  const handlePosterUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewTourney({ ...newTourney, poster: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreate = async () => {
    if (user.credits < 200) {
      setError("Insufficient credits! Cost: 200 Credits.");
      return;
    }
    
    setIsCreating(true);
    try {
      await store.addTournament({
        ...newTourney,
        organizerId: user.id,
        status: 'UPCOMING',
        participants: [user.username],
        playerPool: [],
        rankingCriteriaOrder: ['MATCHES_WON', 'SETS_WON', 'POINTS_DIFF', 'HEAD_TO_HEAD']
      } as any);
      setShowCreate(false);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  if (selectedTournament) {
    return <TournamentDetails tournament={selectedTournament} user={user} onBack={() => { setSelectedTournament(null); loadData(); }} />;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <input 
            type="text" placeholder="Enter ID (e.g. BWF-24)" 
            className="w-full p-4 pl-12 bg-white border border-slate-200 rounded-2xl shadow-sm outline-none focus:border-indigo-500 font-black uppercase tracking-widest text-sm"
            value={searchId} onChange={e => setSearchId(e.target.value)}
          />
          <button onClick={handleSearch} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </button>
        </div>

        <button 
          onClick={() => { setShowCreate(true); setError(''); }}
          className="w-full md:w-auto bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all flex items-center justify-center space-x-2"
        >
          <span>Create Tournament</span>
          <span className="bg-indigo-500 px-2 py-0.5 rounded-lg text-[10px]">-200 Credits</span>
        </button>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-8 md:p-12 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-8">
              <h4 className="text-3xl font-black text-slate-800 italic uppercase tracking-tighter">New Arena</h4>
              <button onClick={() => setShowCreate(false)} className="text-slate-300 hover:text-slate-500">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl mb-6 flex items-center justify-between">
                <p className="text-rose-500 font-black uppercase tracking-widest text-[10px]">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="col-span-full space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tournament Poster</label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-48 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 transition-all overflow-hidden relative"
                >
                  {newTourney.poster ? (
                    <img src={newTourney.poster} className="w-full h-full object-cover" alt="Poster Preview" />
                  ) : (
                    <>
                      <svg className="w-12 h-12 text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      <span className="text-[10px] font-black uppercase text-slate-400">Click to Upload Visual</span>
                    </>
                  )}
                  <input type="file" ref={fileInputRef} onChange={handlePosterUpload} className="hidden" accept="image/*" />
                </div>
              </div>
              <Input label="Tournament Name" value={newTourney.name} onChange={v => setNewTourney({...newTourney, name: v})} />
              <Input label="Venue" value={newTourney.venue} onChange={v => setNewTourney({...newTourney, venue: v})} />
              <Input label="Start Date" type="date" value={newTourney.startDate} onChange={v => setNewTourney({...newTourney, startDate: v})} />
              <Input label="End Date" type="date" value={newTourney.endDate} onChange={v => setNewTourney({...newTourney, endDate: v})} />
              <Input label="Player Limit" type="number" value={newTourney.playerLimit} onChange={v => setNewTourney({...newTourney, playerLimit: parseInt(v)})} />
              <Input label="Scorer Pin" maxLength={4} value={newTourney.scorerPin} onChange={v => setNewTourney({...newTourney, scorerPin: v})} />
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Access Level</label>
                <select 
                  className="w-full p-3 bg-slate-50 rounded-xl font-bold border-2 border-slate-50 focus:border-indigo-500 outline-none"
                  value={newTourney.isPublic ? 'true' : 'false'} 
                  onChange={e => setNewTourney({...newTourney, isPublic: e.target.value === 'true'})}
                >
                  <option value="true">Public (Open)</option>
                  <option value="false">Protected (Invite Only)</option>
                </select>
              </div>
            </div>

            <button 
              onClick={handleCreate} disabled={isCreating}
              className="w-full bg-indigo-600 text-white font-black py-5 rounded-3xl mt-10 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 uppercase tracking-widest text-sm"
            >
              {isCreating ? 'Creating Arena...' : 'Launch Tournament'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {tournaments.map(t => {
          const isMember = (t.participants || []).includes(user.username) || t.organizerId === user.id || user.role === UserRole.SUPERADMIN;
          const organizer = users.find(u => u.id === t.organizerId);
          return (
            <div key={t.id} className="bg-white p-0 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl transition-all group overflow-hidden relative">
              <div className="h-40 bg-slate-200 overflow-hidden relative">
                 {t.poster ? (
                   <img src={t.poster} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={t.name} />
                 ) : (
                   <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-indigo-900 flex items-center justify-center">
                     <svg className="w-16 h-16 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                   </div>
                 )}
                 <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                    <span className="text-[9px] font-black uppercase tracking-widest text-white bg-slate-900/40 backdrop-blur-md px-3 py-1 rounded-lg">ID: {t.uniqueId}</span>
                    <div className="flex space-x-1">
                        <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${t.isPublic ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                          {t.isPublic ? 'Public' : 'Protected'}
                        </span>
                    </div>
                 </div>
              </div>

              <div className="p-8">
                <h4 className="text-2xl font-black text-slate-800 tracking-tighter mb-1 uppercase italic leading-none">{t.name}</h4>
                <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">{t.venue}</p>
                <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-6 italic">Organized by: {organizer?.name || 'Loading...'}</p>
                
                <button 
                  onClick={() => setSelectedTournament(t)}
                  className={`w-full font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] transition-all flex items-center justify-center space-x-2 ${isMember ? 'bg-slate-900 text-white shadow-lg' : 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 hover:scale-[1.02]'}`}
                >
                  <span>{isMember ? 'Enter Arena' : 'Join Arena'}</span>
                  <span>→</span>
                </button>

                <div className="mt-6 pt-6 border-t border-slate-50 flex justify-between items-center text-[9px] font-black text-slate-400 uppercase tracking-widest">
                   <span>{t.format} • {t.type}</span>
                   <span>{(t.participants || []).length}/{t.playerLimit} Slots</span>
                </div>
              </div>
            </div>
          );
        })}
        {tournaments.length === 0 && (
          <div className="col-span-full py-20 text-center">
            <p className="text-slate-400 font-black uppercase tracking-widest text-xs">No arenas found in the cloud database.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const Input = ({ label, value, onChange, type = "text", placeholder = "", maxLength }: any) => (
  <div className="space-y-1">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
    <input 
      type={type} 
      maxLength={maxLength}
      placeholder={placeholder}
      className="w-full p-3 bg-slate-50 border-2 border-slate-50 rounded-xl focus:border-indigo-500 outline-none font-bold"
      value={value} onChange={e => onChange(e.target.value)}
    />
  </div>
);

export default Tournaments;