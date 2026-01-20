
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Tournament, Match, User, UserRole, MatchStatus, Team, TournamentPlayer, MatchScore, JoinRequest, RankingCriterion } from '../types';
import { store } from '../services/mockStore';
import html2canvas from 'https://esm.sh/html2canvas';
import { jsPDF } from 'https://esm.sh/jspdf';

interface Props {
  tournament: Tournament;
  user: User;
  onBack: () => void;
}

const TournamentDetails: React.FC<Props> = ({ tournament: initialTournament, user, onBack }) => {
  const [activeTab, setActiveTab] = useState<'matches' | 'players' | 'teams' | 'standings' | 'settings' | 'requests'>('matches');
  const [tournament, setTournament] = useState<Tournament>(initialTournament);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [standings, setStandings] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [isLocked, setIsLocked] = useState(initialTournament.isLocked);
  const [isJoining, setIsJoining] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const exportRef = useRef<HTMLDivElement>(null);
  
  // Scoring State
  const [scoringMatch, setScoringMatch] = useState<Match | null>(null);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [currentScores, setCurrentScores] = useState<MatchScore[]>([]);
  const [activeSetIndex, setActiveSetIndex] = useState(0);
  const [isSwapped, setIsSwapped] = useState(false);
  const [pinEntry, setPinEntry] = useState('');

  // Form State
  const [selectedT1, setSelectedT1] = useState('');
  const [selectedT2, setSelectedT2] = useState('');
  const [playerSearch, setPlayerSearch] = useState('');
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [bulkPlayerInput, setBulkPlayerInput] = useState('');
  const [showPlayerImport, setShowPlayerImport] = useState(false);

  // Teams Tab State
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedPoolPlayers, setSelectedPoolPlayers] = useState<string[]>([]);
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);

  // Match Form State
  const [matchConfig, setMatchConfig] = useState({ 
    points: 21, 
    customPoints: '',
    goldenPoint: 30,
    bestOf: 3, 
    court: 1, 
    umpire: '',
    scheduleDate: new Date().toISOString().split('T')[0],
    scheduleTime: '12:00'
  });
  
  const [tempPin, setTempPin] = useState(initialTournament.scorerPin || '0000');

  useEffect(() => { 
    if (initialTournament?.id) { loadData(); }
  }, [initialTournament?.id]);

  const loadData = async () => {
    if (!initialTournament?.id) return;
    try {
      const [m, t, s, u, tourneys, jr] = await Promise.all([
        store.getMatchesByTournament(initialTournament.id),
        store.getTeams(initialTournament.id),
        store.calculateStandings(initialTournament.id),
        store.getAllUsers(),
        store.getTournaments(),
        store.getJoinRequests(initialTournament.id)
      ]);
      const updatedTourney = tourneys.find(x => x.id === initialTournament.id);
      if (updatedTourney) {
        setTournament(updatedTourney);
        setIsLocked(updatedTourney.isLocked);
        setTempPin(updatedTourney.scorerPin);
      }
      setMatches(m.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));
      setTeams(t);
      setStandings(s);
      setAllUsers(u);
      setJoinRequests(jr);
    } catch (err) {
      console.error("Error loading tournament data:", err);
    }
  };

  const isMember = (tournament.participants || []).includes(user.username) || tournament.organizerId === user.id || user.role === UserRole.SUPERADMIN;
  const isOrganizer = user.id === tournament.organizerId || user.role === UserRole.SUPERADMIN;
  const filteredPool = useMemo(() => tournament.playerPool || [], [tournament.playerPool]);

  const format12h = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', { 
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true 
    });
  };

  const copyInviteLink = () => {
    const link = `${window.location.origin}${window.location.pathname}?join=${tournament.uniqueId}`;
    navigator.clipboard.writeText(link).then(() => {
      alert("Invite link copied to clipboard!");
    });
  };

  // --- SCORING HELPERS ---
  const getSetWinner = (s: MatchScore, points: number, golden: number) => {
    if ((s.s1 >= points && (s.s1 - s.s2) >= 2) || s.s1 >= golden) return 1;
    if ((s.s2 >= points && (s.s2 - s.s1) >= 2) || s.s2 >= golden) return 2;
    return 0;
  };

  const getMatchDecision = () => {
    if (!scoringMatch) return null;
    let p1Sets = 0;
    let p2Sets = 0;
    currentScores.forEach(s => {
      const winner = getSetWinner(s, scoringMatch.pointsOption, scoringMatch.goldenPoint);
      if (winner === 1) p1Sets++;
      else if (winner === 2) p2Sets++;
    });
    const required = Math.ceil((scoringMatch.bestOf + 1) / 2);
    if (p1Sets >= required) return 1;
    if (p2Sets >= required) return 2;
    return null;
  };

  // --- SCORING LOGIC ---
  const handleOpenScoreboard = (match: Match) => {
    setScoringMatch(match);
    setCurrentScores(match.scores.length > 0 ? [...match.scores] : Array.from({ length: match.bestOf }, () => ({ s1: 0, s2: 0 })));
    setActiveSetIndex(0);
    setShowScoreboard(true);
    setPinEntry('');
  };

  const handleUpdateScore = (setIdx: number, side: 1 | 2, delta: number) => {
    if (!scoringMatch) return;
    const currentSet = currentScores[setIdx];
    const setWinnerBefore = getSetWinner(currentSet, scoringMatch.pointsOption, scoringMatch.goldenPoint);
    if (setWinnerBefore !== 0 && delta > 0) return;

    const newScores = [...currentScores];
    if (side === 1) newScores[setIdx].s1 = Math.max(0, newScores[setIdx].s1 + delta);
    else newScores[setIdx].s2 = Math.max(0, newScores[setIdx].s2 + delta);
    
    setCurrentScores(newScores);
    
    const setWinnerAfter = getSetWinner(newScores[setIdx], scoringMatch.pointsOption, scoringMatch.goldenPoint);
    if (setWinnerAfter !== 0 && activeSetIndex < currentScores.length - 1) {
      setTimeout(() => setActiveSetIndex(prev => prev + 1), 500);
    }
  };

  const handleUndoScore = () => {
    alert("Undo action recorded.");
  };

  const handleSaveScore = async () => {
    if (!scoringMatch) return;
    const isOwner = user.id === tournament.organizerId || user.role === UserRole.SUPERADMIN;
    if (!isOwner && pinEntry !== tournament.scorerPin) {
      return alert("Invalid Scorer PIN. Access Denied.");
    }

    try {
      await store.updateMatchScore(scoringMatch.id, currentScores, scoringMatch.participants);
      setShowScoreboard(false);
      await loadData();
    } catch (err) { alert("Failed to save scores."); }
  };

  // --- PLAYER POOL LOGIC ---
  const handleAddToPool = async () => {
    if (!playerSearch) return;
    setIsAddingPlayer(true);
    try {
      const isSearchByUsername = playerSearch.startsWith('@');
      const searchTerm = isSearchByUsername ? playerSearch.substring(1) : playerSearch;
      
      const found = await store.getUserByUsername(searchTerm);
      const newEntry: TournamentPlayer = found 
        ? { id: found.id, name: found.name, username: found.username, isRegistered: true }
        : { name: playerSearch, isRegistered: false };
      
      const exists = (tournament.playerPool || []).some(p => {
        const nameMatch = p.name.toLowerCase() === newEntry.name.toLowerCase();
        const usernameMatch = (p.username && newEntry.username) && (p.username.toLowerCase() === newEntry.username.toLowerCase());
        return nameMatch || usernameMatch;
      });

      if (exists) {
        alert("Player is already in the list.");
        setPlayerSearch('');
        return;
      }

      const newPool = [...(tournament.playerPool || []), newEntry];
      await store.updateTournamentPool(tournament.id, newPool);
      setPlayerSearch('');
      await loadData();
    } catch (err) { alert("Failed to add player."); }
    finally { setIsAddingPlayer(false); }
  };

  const handleBulkPlayerImport = async () => {
    if (!bulkPlayerInput) return;
    setIsAddingPlayer(true);
    try {
      const lines = bulkPlayerInput.split('\n').filter(l => l.trim());
      const newPool = [...(tournament.playerPool || [])];
      for (const line of lines) {
        const parts = line.split(',').map(p => p.trim());
        const name = parts[0];
        const username = parts[1]?.replace('@', '').toLowerCase();
        
        const exists = newPool.some(p => (username && p.username?.toLowerCase() === username) || p.name.toLowerCase() === name.toLowerCase());
        if (exists) continue;

        let foundUser = username ? await store.getUserByUsername(username) : null;
        newPool.push(foundUser 
          ? { id: foundUser.id, name: foundUser.name, username: foundUser.username, isRegistered: true }
          : { name, username, isRegistered: false });
      }
      await store.updateTournamentPool(tournament.id, newPool);
      setBulkPlayerInput(''); setShowPlayerImport(false); await loadData();
    } catch (err) { alert("Import failed."); }
    finally { setIsAddingPlayer(false); }
  };

  const handleDeletePlayerFromPool = async (index: number) => {
    if (!window.confirm("Remove player from list?")) return;
    const newPool = [...(tournament.playerPool || [])];
    newPool.splice(index, 1);
    await store.updateTournamentPool(tournament.id, newPool);
    await loadData();
  };

  const exportRosterToCSV = () => {
    const headers = ['Name', 'Username', 'Status'];
    const rows = filteredPool.map(p => [p.name, p.username || 'Guest', p.isRegistered ? 'Registered' : 'Manual']);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${tournament.name}_Players.csv`; a.click();
  };

  const exportRosterToTXT = () => {
    const content = filteredPool.map(p => `${p.name} (@${p.username || 'guest'})`).join("\n");
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${tournament.name}_Players.txt`; a.click();
  };

  const generateCapture = async () => {
    if (!exportRef.current) return null;
    setIsExporting(true);
    // Temporarily hide buttons for capture
    const buttons = exportRef.current.querySelectorAll('button');
    buttons.forEach(b => (b.style.display = 'none'));
    
    const canvas = await html2canvas(exportRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff'
    });
    
    buttons.forEach(b => (b.style.display = ''));
    setIsExporting(false);
    return canvas;
  };

  const exportToPDF = async () => {
    const canvas = await generateCapture();
    if (!canvas) return;
    
    const imgData = canvas.toDataURL('image/jpeg', 1.0);
    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'px',
      format: [canvas.width, canvas.height]
    });
    
    pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
    pdf.save(`${tournament.name}_Results.pdf`);
    setShowExportMenu(false);
  };

  const exportToJPEG = async () => {
    const canvas = await generateCapture();
    if (!canvas) return;
    
    const link = document.createElement('a');
    link.download = `${tournament.name}_Results.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.9);
    link.click();
    setShowExportMenu(false);
  };

  // --- TEAM LOGIC ---
  const handleCreateTeam = async () => {
    if (!newTeamName) return alert("Team name required.");
    setIsCreatingTeam(true);
    try {
      await store.addTeam({ 
        tournamentId: tournament.id, 
        name: newTeamName, 
        playerIds: [], 
        customPlayerNames: selectedPoolPlayers 
      });
      setNewTeamName(''); setSelectedPoolPlayers([]); await loadData();
    } finally { setIsCreatingTeam(false); }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!window.confirm("Delete this team permanently?")) return;
    await store.deleteTeam(teamId);
    setActiveTeamId(null);
    await loadData();
  };

  const handleLock = async () => {
    if (!window.confirm("Locking the arena will allow match scheduling. Proceed?")) return;
    await store.lockTournament(tournament.id);
    setIsLocked(true); await loadData();
  };

  const handleStartMatch = async () => {
    if (!tournament.isLocked) return alert("Tournament must be LOCKED first.");
    if (!selectedT1 || !selectedT2 || selectedT1 === selectedT2) return alert("Select two different teams.");
    const finalPoints = matchConfig.points === 0 ? parseInt(matchConfig.customPoints) : matchConfig.points;
    if (isNaN(finalPoints)) return alert("Invalid points configuration.");

    const scheduledDateTime = new Date(`${matchConfig.scheduleDate}T${matchConfig.scheduleTime}`).toISOString();
    try {
      await store.createMatch({
        tournamentId: tournament.id,
        participants: [selectedT1, selectedT2],
        scores: Array.from({ length: matchConfig.bestOf }, () => ({ s1: 0, s2: 0 })),
        status: MatchStatus.SCHEDULED,
        court: matchConfig.court,
        startTime: scheduledDateTime,
        pointsOption: finalPoints,
        goldenPoint: matchConfig.goldenPoint,
        bestOf: matchConfig.bestOf,
        umpireName: matchConfig.umpire
      });
      alert("Match Posted to Schedule!");
      setSelectedT1('');
      setSelectedT2('');
      await loadData();
    } catch (e: any) { alert(e.message); }
  };

  const handleUpdatePin = async () => {
    if (tempPin.length !== 4) return alert("PIN must be 4 digits.");
    await store.updateTournamentSettings(tournament.id, { scorerPin: tempPin });
    alert("PIN updated successfully.");
    await loadData();
  };

  const handleReorderCriteria = async (index: number, direction: 'up' | 'down') => {
    const newCriteria = [...(tournament.rankingCriteriaOrder || ['MATCHES_WON', 'SETS_WON', 'POINTS_DIFF', 'HEAD_TO_HEAD'])];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newCriteria.length) return;
    
    [newCriteria[index], newCriteria[targetIndex]] = [newCriteria[targetIndex], newCriteria[index]];
    await store.updateTournamentSettings(tournament.id, { rankingCriteriaOrder: newCriteria as RankingCriterion[] });
    await loadData();
  };

  const handleDeleteArena = async () => {
    if (!window.confirm("PERMANENT ACTION: Delete this tournament and all its data?")) return;
    await store.deleteTournament(tournament.id);
    onBack();
  };

  const handleResolveJoinRequest = async (id: string, username: string, approved: boolean) => {
    setProcessingRequestId(id);
    try {
      await store.resolveJoinRequest(id, tournament.id, username, approved);
      await loadData();
    } catch (err) {
      alert("Action failed. Try again.");
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleJoinAction = async () => {
    setIsJoining(true);
    try {
      if (tournament.isPublic) { 
        await store.joinTournament(tournament.id, user); 
        alert("Joined Arena!"); 
      }
      else { 
        await store.requestJoinTournament(tournament.id, user); 
        alert("Join Request Sent!"); 
      }
      await loadData();
    } catch (e: any) {
      alert(e.message);
    } finally { 
      setIsJoining(false); 
    }
  };

  const matchWinner = getMatchDecision();

  if (!isMember) {
    return (
      <div className="flex flex-col items-center justify-center py-12 animate-in fade-in zoom-in bg-white rounded-[3rem] shadow-sm border border-slate-200 overflow-hidden relative">
        {tournament.poster && (
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <img src={tournament.poster} className="w-full h-full object-cover blur-2xl" alt="" />
          </div>
        )}
        <div className="w-40 h-40 bg-rose-50 rounded-[3rem] flex items-center justify-center mb-10 shadow-inner border border-rose-100 relative z-10">
           <svg className="w-20 h-20 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        </div>
        <h3 className="text-5xl font-black text-slate-800 uppercase italic tracking-tighter mb-4 text-center px-4 relative z-10">Arena Protected</h3>
        <p className="max-w-md text-center text-slate-400 font-bold leading-relaxed mb-12 px-8 text-lg relative z-10">Join this arena to see match results and standings.</p>
        <button onClick={handleJoinAction} disabled={isJoining} className="relative z-10 bg-indigo-600 text-white px-12 py-6 rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-2xl hover:scale-[1.03] transition-all">
          {isJoining ? 'Processing...' : (tournament.isPublic ? 'Join Arena' : 'Request Entry')}
        </button>
        <button onClick={onBack} className="relative z-10 mt-6 text-slate-400 font-black uppercase tracking-widest text-[11px]">Back to Lobby</button>
      </div>
    );
  }

  const selectedTeam = teams.find(t => t.id === activeTeamId);
  const selectedTeamMatches = activeTeamId ? matches.filter(m => m.participants.includes(activeTeamId)) : [];
  const selectedTeamUpcoming = selectedTeamMatches.filter(m => m.status !== MatchStatus.COMPLETED);
  const selectedTeamHistory = selectedTeamMatches.filter(m => m.status === MatchStatus.COMPLETED);

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <button onClick={onBack} className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm border border-slate-200 bg-white hover:scale-110 active:scale-90"><svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg></button>
          <div className="flex items-center space-x-4">
            {tournament.poster && <img src={tournament.poster} className="w-16 h-16 rounded-2xl object-cover shadow-lg border-2 border-white" alt="" />}
            <div>
              <h2 className="text-4xl font-black text-slate-800 tracking-tight italic uppercase leading-none">{tournament.name}</h2>
              <p className="text-slate-400 font-black uppercase tracking-widest text-[10px] mt-2 italic">ID: {tournament.uniqueId} • {tournament.venue}</p>
            </div>
          </div>
        </div>
        <div className="flex space-x-3">
          <button onClick={copyInviteLink} className="bg-white text-indigo-600 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-indigo-100 shadow-lg hover:bg-indigo-50 transition-all flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
            Invite Members
          </button>
          {isOrganizer && !isLocked && <button onClick={handleLock} className="bg-slate-950 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl">Lock Arena</button>}
          <div className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg italic">{tournament.status}</div>
        </div>
      </div>

      <div className="flex space-x-2 overflow-x-auto pb-2 no-scrollbar scroll-smooth">
        <TabButton active={activeTab === 'matches'} onClick={() => setActiveTab('matches')} label="Matches" />
        <TabButton active={activeTab === 'players'} onClick={() => setActiveTab('players')} label="Players" />
        <TabButton active={activeTab === 'teams'} onClick={() => setActiveTab('teams')} label="Teams" />
        <TabButton active={activeTab === 'standings'} onClick={() => setActiveTab('standings')} label="Standings" />
        {isOrganizer && <TabButton active={activeTab === 'requests'} onClick={() => setActiveTab('requests')} label="Requests" />}
        {isOrganizer && <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} label="Settings" />}
      </div>

      {activeTab === 'matches' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4">
          <div ref={exportRef} className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-indigo-50/30 border-l-4 border-indigo-600">
              <div>
                <h4 className="text-xl font-black text-indigo-900 uppercase italic tracking-tighter">Match Schedule</h4>
                {isExporting && <p className="text-[9px] font-black text-indigo-400 animate-pulse mt-1">GENERATING DOCUMENT...</p>}
              </div>
              <div className="relative w-full sm:w-auto">
                <button 
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="w-full sm:w-auto bg-white text-slate-500 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Export Results
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-full sm:w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-50 animate-in zoom-in duration-100">
                     <button onClick={exportToPDF} className="w-full text-left px-4 py-3 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50 rounded-xl flex items-center gap-3">
                        <span className="text-lg">📄</span> Professional PDF
                     </button>
                     <button onClick={exportToJPEG} className="w-full text-left px-4 py-3 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50 rounded-xl flex items-center gap-3">
                        <span className="text-lg">🖼️</span> High Quality JPEG
                     </button>
                  </div>
                )}
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left min-w-[700px]">
                <thead className="bg-slate-950 text-white">
                  <tr className="text-[9px] font-black uppercase tracking-[0.2em]">
                    <th className="px-8 py-5">#</th>
                    <th className="px-8 py-5">Schedule</th>
                    <th className="px-8 py-5">Tie-Up</th>
                    <th className="px-8 py-5">Umpire</th>
                    <th className="px-8 py-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {matches.map((m, idx) => (
                    <tr key={m.id} className="hover:bg-indigo-50/40 transition-colors group">
                      <td className="px-8 py-6 font-black text-slate-300 group-hover:text-indigo-600 transition-colors">#{idx+1}</td>
                      <td className="px-8 py-6 font-bold text-slate-600 text-[11px] whitespace-nowrap">{format12h(m.startTime)}</td>
                      <td className="px-8 py-6 font-black text-slate-800 uppercase italic text-sm">
                        {teams.find(t => t.id === m.participants[0])?.name} vs {teams.find(t => t.id === m.participants[1])?.name}
                        <div className="text-[9px] text-indigo-500 mt-1 font-bold">
                          {m.status === MatchStatus.COMPLETED ? m.scores.map(s => `${s.s1}-${s.s2}`).join(' / ') : 'SCHEDULED'}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-xs font-bold text-slate-500">{m.umpireName || '---'}</td>
                      <td className="px-8 py-6 text-right">
                         {m.status !== MatchStatus.COMPLETED ? (
                           <button onClick={() => handleOpenScoreboard(m)} className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-[9px] font-black uppercase shadow-lg active:scale-95 transition-all">Score</button>
                         ) : (
                           <span className="text-emerald-500 font-black text-[9px] uppercase italic">Finished</span>
                         )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-slate-100">
              {matches.map((m, idx) => {
                const team1 = teams.find(t => t.id === m.participants[0]);
                const team2 = teams.find(t => t.id === m.participants[1]);
                return (
                  <div key={m.id} className="p-6 bg-white space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-300 uppercase italic">Match #{idx+1}</span>
                      <span className="text-[10px] font-bold text-indigo-600 uppercase">{format12h(m.startTime)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                       <div className="flex-1">
                          <h5 className="font-black text-slate-800 uppercase italic text-sm tracking-tight truncate">{team1?.name}</h5>
                          <h5 className="font-black text-slate-800 uppercase italic text-sm tracking-tight truncate mt-1">{team2?.name}</h5>
                       </div>
                       <div className="flex flex-col items-center justify-center bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Status</span>
                          <span className={`text-[9px] font-black uppercase italic ${m.status === MatchStatus.COMPLETED ? 'text-emerald-500' : 'text-indigo-500'}`}>
                            {m.status === MatchStatus.COMPLETED ? 'Done' : 'Live'}
                          </span>
                       </div>
                    </div>
                    {m.status === MatchStatus.COMPLETED && (
                      <div className="bg-indigo-50 p-2 rounded-lg text-center">
                         <span className="text-[10px] font-black text-indigo-700 font-mono">
                            {m.scores.map(s => `${s.s1}-${s.s2}`).join(' / ')}
                         </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-2">
                       <div className="text-[9px] font-bold text-slate-400">
                          Court {m.court} {m.umpireName && `• Ump: ${m.umpireName}`}
                       </div>
                       {m.status !== MatchStatus.COMPLETED ? (
                         <button onClick={() => handleOpenScoreboard(m)} className="bg-indigo-600 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all">
                           Score Match
                         </button>
                       ) : (
                         <span className="text-emerald-500 font-black text-[10px] uppercase italic">Match Finished</span>
                       )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {isOrganizer && (
            <div className="bg-indigo-600 p-6 md:p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden border border-indigo-500">
              {!isLocked && <div className="absolute inset-0 bg-indigo-950/80 backdrop-blur-md z-10 flex items-center justify-center p-8 text-center"><p className="font-black uppercase tracking-widest text-sm italic text-center">Arena Lockdown Required to Schedule</p></div>}
              <h4 className="text-xl font-black uppercase italic tracking-tighter mb-8 border-b border-indigo-500 pb-4">Schedule Tie-Up</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-indigo-200 uppercase tracking-widest ml-1">Select Teams</label>
                  <select value={selectedT1} onChange={e => setSelectedT1(e.target.value)} className="w-full p-4 bg-indigo-500 rounded-2xl font-black text-xs uppercase outline-none border border-indigo-400">
                    <option value="">Select Team 1</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <select value={selectedT2} onChange={e => setSelectedT2(e.target.value)} className="w-full p-4 bg-indigo-500 rounded-2xl font-black text-xs uppercase outline-none border border-indigo-400">
                    <option value="">Select Team 2</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-indigo-200 uppercase tracking-widest ml-1">Official Details</label>
                  <input placeholder="Umpire Name" className="w-full p-4 bg-indigo-500 rounded-2xl font-black text-xs uppercase outline-none placeholder:text-indigo-300 border border-indigo-400" value={matchConfig.umpire} onChange={e => setMatchConfig({...matchConfig, umpire: e.target.value})} />
                  <div className="flex items-center space-x-3"><span className="text-[10px] font-black uppercase text-indigo-200">Court (1-6)</span><input type="number" min="1" max="6" className="w-20 bg-indigo-500 rounded-xl p-3 text-center font-black outline-none border border-indigo-400" value={matchConfig.court} onChange={e => setMatchConfig({...matchConfig, court: parseInt(e.target.value) || 1})} /></div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-indigo-200 uppercase tracking-widest ml-1">Time Slots</label>
                  <input type="date" className="w-full p-4 bg-indigo-500 rounded-2xl font-black text-xs outline-none border border-indigo-400" value={matchConfig.scheduleDate} onChange={e => setMatchConfig({...matchConfig, scheduleDate: e.target.value})} />
                  <input type="time" className="w-full p-4 bg-indigo-500 rounded-2xl font-black text-xs outline-none border border-indigo-400" value={matchConfig.scheduleTime} onChange={e => setMatchConfig({...matchConfig, scheduleTime: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mt-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-indigo-200 uppercase tracking-widest ml-1">Format (Best of)</label>
                  <div className="flex space-x-2">
                    {[1, 3, 5].map(v => (
                      <button key={v} onClick={() => setMatchConfig({...matchConfig, bestOf: v})} className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${matchConfig.bestOf === v ? 'bg-white text-indigo-600 shadow-lg' : 'bg-indigo-500 text-indigo-200 hover:bg-indigo-400'}`}>{v}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-indigo-200 uppercase tracking-widest ml-1">Points per Set</label>
                  <div className="flex space-x-2">
                    {[21, 30].map(v => (
                      <button key={v} onClick={() => setMatchConfig({...matchConfig, points: v, customPoints: '', goldenPoint: v === 21 ? 30 : v + 5})} className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${matchConfig.points === v ? 'bg-white text-indigo-600 shadow-lg' : 'bg-indigo-500 text-indigo-200 hover:bg-indigo-400'}`}>{v}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-indigo-200 uppercase tracking-widest ml-1">Golden Point Cap</label>
                  <input type="number" className="w-full p-3 bg-indigo-500 rounded-xl font-black text-xs outline-none text-white focus:bg-white focus:text-indigo-600 transition-all border border-indigo-400" value={matchConfig.goldenPoint} onChange={e => setMatchConfig({...matchConfig, goldenPoint: parseInt(e.target.value) || 30})} />
                </div>
              </div>

              <button onClick={handleStartMatch} disabled={!isLocked} className="mt-8 w-full bg-white text-indigo-600 p-4 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all">Post to Schedule</button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'players' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-slate-950 rounded-[2rem] text-white">
             <h4 className="text-xl font-black uppercase italic tracking-tighter">Official Tournament Players</h4>
             <div className="flex space-x-2">
                <button onClick={exportRosterToCSV} className="bg-slate-800 border border-slate-700 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase text-slate-300">CSV</button>
                <button onClick={exportRosterToTXT} className="bg-slate-800 border border-slate-700 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase text-slate-300">TXT</button>
                {isOrganizer && <button onClick={() => setShowPlayerImport(true)} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-lg">Matrix Import</button>}
             </div>
          </div>
          
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
             <table className="w-full text-left min-w-[600px]">
                <thead className="bg-slate-950 text-white">
                   <tr className="text-[9px] font-black uppercase tracking-[0.2em]">
                      <th className="px-8 py-5">Player Details</th>
                      <th className="px-8 py-5">Identity</th>
                      <th className="px-8 py-5">Status</th>
                      <th className="px-8 py-5 text-right">Actions</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                   {filteredPool.map((p, i) => (
                     <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-8 py-5 flex items-center space-x-4">
                           <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center font-black text-indigo-600 border border-indigo-100">{p.name[0]}</div>
                           <span className="font-black text-slate-800 uppercase italic text-sm">{p.name}</span>
                        </td>
                        <td className="px-8 py-5">
                           {p.username ? <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">@{p.username}</span> : <span className="text-[9px] text-slate-300 uppercase font-black italic">Guest Entry</span>}
                        </td>
                        <td className="px-8 py-5">
                           <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${p.isRegistered ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                              {p.isRegistered ? 'Registered' : 'Manual'}
                           </span>
                        </td>
                        <td className="px-8 py-5 text-right">
                           {isOrganizer && <button onClick={() => handleDeletePlayerFromPool(i)} className="text-rose-500 font-black text-[9px] uppercase tracking-[0.2em] hover:underline">Delete</button>}
                        </td>
                     </tr>
                   ))}
                </tbody>
             </table>
          </div>

          {showPlayerImport && (
            <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-2xl animate-in zoom-in space-y-4 border border-indigo-400">
               <div className="flex justify-between items-center mb-2">
                 <h5 className="font-black uppercase italic tracking-tighter text-lg">Matrix Bulk Player Import</h5>
                 <button onClick={() => setShowPlayerImport(false)} className="text-indigo-200 hover:text-white uppercase font-black text-[10px]">Close</button>
               </div>
               <textarea className="w-full h-32 bg-indigo-500 rounded-2xl p-5 font-black text-[11px] outline-none border border-indigo-400 placeholder:text-indigo-200" placeholder="Format: Name, @username (one player per line)" value={bulkPlayerInput} onChange={e => setBulkPlayerInput(e.target.value)} />
               <button onClick={handleBulkPlayerImport} className="w-full bg-white text-indigo-600 font-black py-4 rounded-2xl uppercase text-[11px] shadow-xl hover:bg-indigo-50 transition-all">Import All to Player List</button>
            </div>
          )}

          {isOrganizer && !isLocked && (
            <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4">
              <input type="text" placeholder="Add player (name or @username)" className="flex-1 p-4 bg-slate-50 rounded-2xl font-black outline-none focus:bg-white border-2 border-transparent focus:border-indigo-500 transition-all" value={playerSearch} onChange={e => setPlayerSearch(e.target.value)} />
              <button onClick={handleAddToPool} disabled={isAddingPlayer || !playerSearch} className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black uppercase text-[10px] shadow-xl hover:bg-indigo-600 transition-all">Add Player</button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'teams' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4">
          {isOrganizer && !isLocked && !activeTeamId && (
            <div className="bg-white p-6 md:p-10 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8">
              <div className="bg-indigo-50/50 p-4 rounded-2xl border-l-4 border-indigo-600 mb-6">
                 <h4 className="text-[10px] font-black text-indigo-900 uppercase italic tracking-widest leading-none">Draft New Team</h4>
              </div>
              <div>
                 <label className="text-[10px] font-black text-slate-400 uppercase italic mb-2 ml-1 block">Team Identity</label>
                 <input type="text" placeholder="Unique Team Name" className="w-full p-5 bg-slate-50 rounded-2xl font-black text-xl outline-none border-2 border-transparent focus:border-indigo-500" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} />
              </div>
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase italic tracking-widest">Select Draft Lineup (Check to Draft)</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-4 bg-slate-50 rounded-2xl no-scrollbar border border-slate-200">
                  {filteredPool.map(p => (
                    <label key={p.name} className={`flex items-center p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedPoolPlayers.includes(p.name) ? 'bg-indigo-600 border-indigo-700 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-500 hover:border-indigo-200'}`}>
                      <input type="checkbox" className="hidden" checked={selectedPoolPlayers.includes(p.name)} onChange={() => setSelectedPoolPlayers(prev => prev.includes(p.name) ? prev.filter(x => x !== p.name) : [...prev, p.name])} />
                      <span className="text-[10px] font-black uppercase truncate">{p.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button onClick={handleCreateTeam} disabled={isCreatingTeam || !newTeamName} className="w-full bg-slate-950 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[10px] shadow-xl hover:bg-indigo-600 transition-all active:scale-95 disabled:opacity-50">Confirm Team Draft</button>
            </div>
          )}

          {activeTeamId && selectedTeam ? (
            <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm p-8 md:p-12 space-y-12 animate-in zoom-in">
               <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 pb-8 gap-4">
                  <div>
                     <button onClick={() => setActiveTeamId(null)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 hover:text-slate-800 transition-colors">← All Teams</button>
                     <h3 className="text-4xl md:text-5xl font-black text-slate-800 uppercase italic tracking-tighter leading-none">{selectedTeam.name}</h3>
                  </div>
                  {isOrganizer && <button onClick={() => handleDeleteTeam(selectedTeam.id)} className="bg-rose-50 text-rose-500 px-6 py-3 rounded-xl text-[10px] font-black uppercase shadow-sm hover:bg-rose-500 hover:text-white transition-all">Delete Team</button>}
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-slate-50 p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-inner">
                     <h5 className="text-[10px] font-black text-slate-500 uppercase mb-6 tracking-widest border-b border-slate-200 pb-2">Active Lineup</h5>
                     <div className="space-y-3">
                        {selectedTeam.customPlayerNames?.map(p => (
                          <div key={p} className="bg-white p-5 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm">
                             <span className="font-black text-slate-800 uppercase italic text-xs leading-none">{p}</span>
                             <span className="text-[8px] font-black text-slate-300 uppercase italic tracking-widest">Player</span>
                          </div>
                        ))}
                     </div>
                  </div>
                  <div className="bg-indigo-600 p-6 md:p-8 rounded-[2rem] border border-indigo-500 shadow-xl text-white">
                     <h5 className="text-[10px] font-black text-indigo-200 uppercase mb-6 tracking-widest border-b border-indigo-500 pb-2">Performance Metrics</h5>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="bg-indigo-700/50 p-6 rounded-3xl text-center"><p className="text-3xl font-black italic">{selectedTeamHistory.length}</p><p className="text-[9px] font-black text-indigo-300 uppercase mt-1">Played</p></div>
                        <div className="bg-indigo-700/50 p-6 rounded-3xl text-center"><p className="text-3xl font-black italic">{selectedTeamHistory.filter(m => m.winnerId === activeTeamId).length}</p><p className="text-[9px] font-black text-indigo-300 uppercase mt-1">Wins</p></div>
                        <div className="bg-indigo-700/50 p-6 rounded-3xl text-center"><p className="text-3xl font-black italic">{standings.find(s => s.id === activeTeamId)?.pointsScored - standings.find(s => s.id === activeTeamId)?.pointsConceded || 0}</p><p className="text-[9px] font-black text-indigo-300 uppercase mt-1">Net Points</p></div>
                        <div className="bg-indigo-700/50 p-6 rounded-3xl text-center"><p className="text-3xl font-black italic">{selectedTeamHistory.length > 0 ? Math.round((selectedTeamHistory.filter(m => m.winnerId === activeTeamId).length / selectedTeamHistory.length) * 100) : 0}%</p><p className="text-[9px] font-black text-indigo-300 uppercase mt-1">Efficiency</p></div>
                     </div>
                  </div>
               </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              {teams.map(t => (
                <button key={t.id} onClick={() => setActiveTeamId(t.id)} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm group hover:border-indigo-400 hover:shadow-2xl transition-all text-left transform hover:-translate-y-1">
                   <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center font-black text-indigo-400 mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all">{t.name[0]}</div>
                   <h5 className="font-black text-slate-800 uppercase italic text-2xl tracking-tighter mb-2 leading-none">{t.name}</h5>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">{t.customPlayerNames?.length || 0} Drafted Players</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'standings' && (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden animate-in zoom-in overflow-x-auto">
           <div className="p-8 bg-slate-950 text-white border-l-4 border-indigo-600">
              <h4 className="text-xl font-black uppercase italic tracking-tighter leading-none">Global Rankings</h4>
           </div>
           <table className="w-full text-left min-w-[500px]">
            <thead className="bg-slate-900 text-white">
              <tr className="text-[9px] font-black uppercase tracking-[0.2em]">
                <th className="px-10 py-6">Rank</th>
                <th className="px-4 py-6">Team</th>
                <th className="px-4 py-6 text-center">Played</th>
                <th className="px-4 py-6 text-center">W-L</th>
                <th className="px-4 py-6 text-center">Net Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {standings.map((s, idx) => (
                <tr key={s.id} className="hover:bg-indigo-50 transition-colors">
                  <td className="px-10 py-6 font-black text-slate-800 text-2xl italic leading-none tabular-nums">#{idx+1}</td>
                  <td className="px-4 py-6 font-black text-slate-800 uppercase italic text-sm tracking-tight">{s.name}</td>
                  <td className="px-4 py-6 text-center font-black text-slate-400 text-xs tabular-nums">{s.played}</td>
                  <td className="px-4 py-6 text-center font-black text-emerald-600 text-xs tabular-nums">{s.matchesWon} - {s.played - s.matchesWon}</td>
                  <td className="px-4 py-6 text-center font-black text-indigo-600 text-sm tabular-nums">{s.pointsScored - s.pointsConceded}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm divide-y divide-slate-100 animate-in fade-in overflow-hidden">
          <div className="p-6 bg-slate-950 text-white text-[10px] font-black uppercase tracking-widest">Entry Authorization Queue</div>
          {joinRequests.map(req => (
            <div key={req.id} className="p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between hover:bg-slate-50 transition-colors gap-4">
              <div><p className="font-black text-slate-800 italic uppercase leading-none text-sm">{req.name}</p><p className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-widest">@{req.username}</p></div>
              <div className="flex space-x-3 w-full sm:w-auto">
                <button onClick={() => handleResolveJoinRequest(req.id, req.username, true)} disabled={processingRequestId === req.id} className="flex-1 sm:flex-none bg-indigo-600 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase shadow-lg active:scale-95 disabled:opacity-50 transition-all">Accept</button>
                <button onClick={() => handleResolveJoinRequest(req.id, req.username, false)} disabled={processingRequestId === req.id} className="flex-1 sm:flex-none bg-slate-100 text-slate-400 px-8 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-rose-50 transition-all">Decline</button>
              </div>
            </div>
          ))}
          {joinRequests.length === 0 && <p className="p-20 text-center text-[10px] font-black uppercase text-slate-300 italic">No pending admission requests.</p>}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-bottom-4">
          <div className="bg-white p-6 md:p-10 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8">
            <div className="bg-slate-900 p-4 rounded-2xl text-white mb-6">
                 <h4 className="text-[10px] font-black uppercase tracking-widest italic leading-none">Arena Core Configuration</h4>
            </div>
            <div className="space-y-6">
              <div>
                 <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1 block italic">Security Access PIN</label>
                 <div className="flex gap-2">
                   <input type="text" maxLength={4} placeholder="####" className="flex-1 p-4 bg-slate-50 rounded-2xl text-center text-2xl font-black outline-none border-2 border-transparent focus:border-indigo-500" value={tempPin} onChange={e => setTempPin(e.target.value)} />
                   <button onClick={handleUpdatePin} className="bg-slate-950 text-white px-6 md:px-8 rounded-2xl font-black uppercase text-[10px] shadow-xl hover:bg-indigo-600 transition-all">Save</button>
                 </div>
              </div>
              <div className="pt-4">
                 <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1 block italic">Ranking Criteria Hierarchy</label>
                 <div className="space-y-2">
                   {(tournament.rankingCriteriaOrder || ['MATCHES_WON', 'SETS_WON', 'POINTS_DIFF', 'HEAD_TO_HEAD']).map((criterion, idx) => (
                     <div key={criterion} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">{idx + 1}. {criterion.replace(/_/g, ' ')}</span>
                        {isOrganizer && (
                          <div className="flex space-x-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleReorderCriteria(idx, 'up')} disabled={idx === 0} className="p-2 hover:bg-slate-200 rounded-lg text-slate-400 disabled:opacity-30">↑</button>
                            <button onClick={() => handleReorderCriteria(idx, 'down')} disabled={idx === 3} className="p-2 hover:bg-slate-200 rounded-lg text-slate-400 disabled:opacity-30">↓</button>
                          </div>
                        )}
                     </div>
                   ))}
                 </div>
              </div>
            </div>
          </div>
          {isOrganizer && (
            <div className="bg-rose-50 p-6 md:p-10 rounded-[2.5rem] border border-rose-100 flex flex-col justify-between shadow-xl">
              <div><h4 className="text-[10px] font-black text-rose-500 uppercase italic tracking-widest mb-4">Danger Zone</h4><p className="text-[10px] font-bold text-rose-400 uppercase leading-relaxed tracking-tight">Permanently delete this arena and all associated matches, teams, and data. This action is irreversible.</p></div>
              <button onClick={handleDeleteArena} className="w-full bg-rose-500 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[11px] shadow-2xl hover:bg-rose-600 mt-12 transition-all">Delete Arena Permanently</button>
            </div>
          )}
        </div>
      )}

      {showScoreboard && scoringMatch && (
        <div className="fixed inset-0 bg-[#0c1221] z-[999] flex flex-col animate-in fade-in duration-300 font-sans overflow-hidden">
          <div className="flex flex-col sm:flex-row items-center justify-between px-6 sm:px-10 py-6 sm:py-8 gap-4 sm:gap-0">
            <button onClick={() => setShowScoreboard(false)} className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-[#1a2333] hover:bg-slate-700 text-slate-300 px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg><span>Exit</span></button>
            <div className="text-center order-first sm:order-none">
                {matchWinner ? ( <div className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-6 sm:px-10 py-2 rounded-full mb-2 animate-pulse"><span className="text-xs font-black uppercase tracking-[0.4em] italic text-[8px] sm:text-xs">MATCH DECIDED</span></div> ) : ( <span className="text-[8px] sm:text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4 block italic">Match Progression</span> )}
                <div className="flex items-center justify-center space-x-2">
                  {currentScores.map((_, idx) => {
                    const winner = getSetWinner(currentScores[idx], scoringMatch.pointsOption, scoringMatch.goldenPoint);
                    const isActive = activeSetIndex === idx;
                    return (
                      <button key={idx} onClick={() => setActiveSetIndex(idx)} className="flex flex-col items-center transition-all">
                         <div className={`w-12 sm:w-20 h-1.5 sm:h-2 rounded-full mb-2 ${winner === 1 ? 'bg-indigo-500' : winner === 2 ? 'bg-emerald-500' : isActive ? 'bg-white' : 'bg-slate-700'}`}></div>
                         <span className={`text-[8px] sm:text-[9px] font-black italic transition-all ${isActive ? 'text-white' : 'text-slate-500'}`}>SET {idx + 1} {winner !== 0 && '✔'}</span>
                      </button>
                    );
                  })}
                </div>
            </div>
            <button onClick={handleUndoScore} className="hidden sm:block bg-[#1a2333] text-slate-400 px-8 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all">Undo</button>
          </div>
          <div className="flex-grow flex flex-col md:flex-row items-center justify-center gap-6 md:gap-10 p-6 sm:p-10 overflow-y-auto sm:overflow-hidden">
            {/* T1 Scoring Card */}
            {(() => {
              const displaySide = isSwapped ? 2 : 1;
              const tId = scoringMatch.participants[displaySide - 1];
              const team = teams.find(t => t.id === tId);
              const score = currentScores[activeSetIndex][`s${displaySide}` as keyof MatchScore];
              const isSetWon = getSetWinner(currentScores[activeSetIndex], scoringMatch.pointsOption, scoringMatch.goldenPoint) === displaySide;
              const isOtherWon = getSetWinner(currentScores[activeSetIndex], scoringMatch.pointsOption, scoringMatch.goldenPoint) !== 0 && !isSetWon;
              const sideColor = displaySide === 1 ? 'bg-[#121931] border-[#4f46e5]/20' : 'bg-[#0a1f1a] border-[#10b981]/20';
              const btnColor = displaySide === 1 ? 'bg-[#4f46e5]' : 'bg-[#10b981]';
              return (
                <div key="side-1" className={`w-full md:flex-1 h-1/2 md:h-full rounded-[2rem] sm:rounded-[4rem] border-2 flex flex-col items-center justify-center relative transition-all duration-700 ${sideColor} p-4 sm:p-0`}>
                  {isSetWon && <div className="absolute top-4 sm:top-12 bg-white text-indigo-900 px-4 sm:px-6 py-1 rounded-full font-black text-[8px] sm:text-[10px] uppercase tracking-widest animate-bounce">Set Winner</div>}
                  <div className="text-center w-full px-6 sm:px-10">
                    <h2 className={`text-2xl sm:text-5xl font-black text-white uppercase italic tracking-tighter mb-4 sm:mb-8 ${isOtherWon ? 'opacity-30' : 'opacity-100'} truncate`}>{team?.name}</h2>
                    <div className="flex items-center justify-center space-x-4 sm:space-x-12">
                       <button onClick={() => handleUpdateScore(activeSetIndex, displaySide as 1|2, -1)} className="w-12 h-12 sm:w-32 sm:h-32 rounded-full bg-white/5 border border-white/10 text-slate-400 text-xl sm:text-5xl active:scale-90 transition-all">—</button>
                       <span className={`text-[100px] sm:text-[280px] font-black text-white leading-none italic tabular-nums tracking-tighter ${isOtherWon ? 'opacity-20 scale-90' : 'opacity-100'}`}>{score}</span>
                       <button disabled={isSetWon || isOtherWon} onClick={() => handleUpdateScore(activeSetIndex, displaySide as 1|2, 1)} className={`w-12 h-12 sm:w-32 sm:h-32 rounded-full flex items-center justify-center text-2xl sm:text-6xl text-white ${btnColor} active:scale-90 transition-all disabled:opacity-20`}>+</button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* T2 Scoring Card */}
            {(() => {
              const displaySide = isSwapped ? 1 : 2;
              const tId = scoringMatch.participants[displaySide - 1];
              const team = teams.find(t => t.id === tId);
              const score = currentScores[activeSetIndex][`s${displaySide}` as keyof MatchScore];
              const isSetWon = getSetWinner(currentScores[activeSetIndex], scoringMatch.pointsOption, scoringMatch.goldenPoint) === displaySide;
              const isOtherWon = getSetWinner(currentScores[activeSetIndex], scoringMatch.pointsOption, scoringMatch.goldenPoint) !== 0 && !isSetWon;
              const sideColor = displaySide === 1 ? 'bg-[#121931] border-[#4f46e5]/20' : 'bg-[#0a1f1a] border-[#10b981]/20';
              const btnColor = displaySide === 1 ? 'bg-[#4f46e5]' : 'bg-[#10b981]';
              return (
                <div key="side-2" className={`w-full md:flex-1 h-1/2 md:h-full rounded-[2rem] sm:rounded-[4rem] border-2 flex flex-col items-center justify-center relative transition-all duration-700 ${sideColor} p-4 sm:p-0`}>
                  {isSetWon && <div className="absolute top-4 sm:top-12 bg-white text-emerald-900 px-4 sm:px-6 py-1 rounded-full font-black text-[8px] sm:text-[10px] uppercase tracking-widest animate-bounce">Set Winner</div>}
                  <div className="text-center w-full px-6 sm:px-10">
                    <h2 className={`text-2xl sm:text-5xl font-black text-white uppercase italic tracking-tighter mb-4 sm:mb-8 ${isOtherWon ? 'opacity-30' : 'opacity-100'} truncate`}>{team?.name}</h2>
                    <div className="flex items-center justify-center space-x-4 sm:space-x-12">
                       <button onClick={() => handleUpdateScore(activeSetIndex, displaySide as 1|2, -1)} className="w-12 h-12 sm:w-32 sm:h-32 rounded-full bg-white/5 border border-white/10 text-slate-400 text-xl sm:text-5xl active:scale-90 transition-all">—</button>
                       <span className={`text-[100px] sm:text-[280px] font-black text-white leading-none italic tabular-nums tracking-tighter ${isOtherWon ? 'opacity-20 scale-90' : 'opacity-100'}`}>{score}</span>
                       <button disabled={isSetWon || isOtherWon} onClick={() => handleUpdateScore(activeSetIndex, displaySide as 1|2, 1)} className={`w-12 h-12 sm:w-32 sm:h-32 rounded-full flex items-center justify-center text-2xl sm:text-6xl text-white ${btnColor} active:scale-90 transition-all disabled:opacity-20`}>+</button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
          <div className="px-6 sm:px-10 py-6 sm:py-10 flex flex-col sm:flex-row items-center justify-between gap-6 sm:gap-0">
            <button onClick={() => setIsSwapped(!isSwapped)} className="w-12 h-12 sm:w-20 sm:h-20 rounded-full bg-[#1a2333] border border-white/5 flex items-center justify-center text-slate-400 rotate-90 active:scale-90">
               <svg className="w-6 h-6 sm:w-10 sm:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
            <div className="flex-1 w-full sm:max-w-2xl sm:mx-10">
               <div className="bg-[#121931]/80 border border-white/5 rounded-2xl sm:rounded-[2.5rem] py-3 sm:py-6 flex items-center justify-center shadow-inner">
                  <span className="text-[10px] sm:text-[12px] font-black text-slate-400 uppercase tracking-[0.3em] sm:tracking-[0.5em] italic">Target: {scoringMatch.pointsOption} (Cap: {scoringMatch.goldenPoint})</span>
               </div>
            </div>
            <div className="flex items-center space-x-4 w-full sm:w-auto">
               <input type="password" placeholder="PIN" className="w-20 sm:w-32 bg-[#1a2333] border border-white/5 rounded-xl sm:rounded-2xl p-4 sm:p-5 text-center font-black text-white outline-none focus:border-indigo-500 text-xs sm:text-base" value={pinEntry} onChange={e => setPinEntry(e.target.value)} />
               <button onClick={handleSaveScore} className={`flex-1 sm:flex-none px-6 sm:px-12 py-4 sm:py-5 rounded-[1.5rem] sm:rounded-[2rem] font-black uppercase text-[10px] sm:text-xs tracking-[0.2em] transition-all active:scale-95 ${matchWinner ? 'bg-emerald-500 text-white' : 'bg-[#4f46e5] text-white'}`}>{matchWinner ? 'Finalize Match' : 'Submit Update'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const TabButton = ({ active, onClick, label }: any) => (
  <button onClick={onClick} className={`px-6 sm:px-10 py-3 sm:py-4 rounded-2xl sm:rounded-[1.5rem] text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${active ? 'bg-indigo-600 text-white shadow-2xl scale-105' : 'text-slate-400 hover:text-slate-600 bg-white shadow-sm border border-slate-100 hover:bg-slate-50'}`}>{label}</button>
);

export default TournamentDetails;
