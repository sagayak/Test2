
import React, { useState } from 'react';
import { MatchScore, User } from '../types';
import { store } from '../services/mockStore';

interface QuickScoreProps {
  user: User;
  onUpdateUser: (updatedUser: User) => void;
}

const QuickScore: React.FC<QuickScoreProps> = ({ user, onUpdateUser }) => {
  const [gameState, setGameState] = useState<'setup' | 'scoring'>('setup');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Setup State
  const [team1, setTeam1] = useState('Team Alpha');
  const [team2, setTeam2] = useState('Team Bravo');
  const [format, setFormat] = useState(3); // 1, 3, 5
  const [pointsPerSet, setPointsPerSet] = useState(21);
  const [customPoints, setCustomPoints] = useState('');
  const [goldenPoint, setGoldenPoint] = useState(30);
  const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().split('T')[0]);
  const [scheduleTime, setScheduleTime] = useState('12:00');

  // Scoring State
  const [currentScores, setCurrentScores] = useState<MatchScore[]>([]);
  const [activeSetIndex, setActiveSetIndex] = useState(0);
  const [isSwapped, setIsSwapped] = useState(false);
  const [matchWinner, setMatchWinner] = useState<number | null>(null);

  const startMatch = async () => {
    if (user.credits < 10) {
      return alert("Insufficient Credits! Starting a Quick Match costs 10 CR. Please top up in the Dashboard.");
    }

    const finalPoints = pointsPerSet === 0 ? parseInt(customPoints) : pointsPerSet;
    if (isNaN(finalPoints)) return alert("Invalid points configuration.");

    setIsProcessing(true);
    try {
      // Deduct 10 Credits
      await store.adjustCredits(user.id, -10, "Quick Match Fee");
      
      // Update local state for immediate feedback
      onUpdateUser({ ...user, credits: user.credits - 10 });
      
      setCurrentScores(Array.from({ length: format }, () => ({ s1: 0, s2: 0 })));
      setActiveSetIndex(0);
      setMatchWinner(null);
      setGameState('scoring');
    } catch (err) {
      alert("Failed to initiate match. Connection to arena lost.");
    } finally {
      setIsProcessing(false);
    }
  };

  const getSetWinner = (s: MatchScore, targetPoints: number, cap: number) => {
    const diff = Math.abs(s.s1 - s.s2);
    if ((s.s1 >= targetPoints && diff >= 2) || s.s1 >= cap) return 1;
    if ((s.s2 >= targetPoints && diff >= 2) || s.s2 >= cap) return 2;
    return 0;
  };

  const checkMatchWinner = (scores: MatchScore[]) => {
    const targetPoints = pointsPerSet === 0 ? parseInt(customPoints) : pointsPerSet;
    let t1Wins = 0;
    let t2Wins = 0;
    scores.forEach(s => {
      const winner = getSetWinner(s, targetPoints, goldenPoint);
      if (winner === 1) t1Wins++;
      else if (winner === 2) t2Wins++;
    });

    const needed = Math.ceil((format + 1) / 2);
    if (t1Wins >= needed) return 1;
    if (t2Wins >= needed) return 2;
    return null;
  };

  const handleUpdateScore = (side: 1 | 2, delta: number) => {
    if (matchWinner) return;

    const targetPoints = pointsPerSet === 0 ? parseInt(customPoints) : pointsPerSet;
    const newScores = [...currentScores];
    const currentSet = newScores[activeSetIndex];
    
    // Check if set is already finished
    if (getSetWinner(currentSet, targetPoints, goldenPoint) !== 0 && delta > 0) return;

    if (side === 1) currentSet.s1 = Math.max(0, currentSet.s1 + delta);
    else currentSet.s2 = Math.max(0, currentSet.s2 + delta);

    setCurrentScores(newScores);

    // Check for set finish
    const winnerAfter = getSetWinner(currentSet, targetPoints, goldenPoint);
    if (winnerAfter !== 0) {
      const globalWinner = checkMatchWinner(newScores);
      if (globalWinner) {
        setMatchWinner(globalWinner);
      } else if (activeSetIndex < format - 1) {
        // Auto advance to next set after short delay
        setTimeout(() => setActiveSetIndex(prev => prev + 1), 1000);
      }
    }
  };

  if (gameState === 'setup') {
    return (
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500 pb-20">
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-8 md:p-12 space-y-10">
          <div className="bg-indigo-50/50 p-6 rounded-3xl border-l-4 border-indigo-600 flex justify-between items-center">
             <div>
               <h3 className="text-xl font-black text-indigo-900 uppercase italic tracking-tighter">⚡ Quick Match Setup</h3>
               <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mt-1">Configure freestyle badminton tie-ups.</p>
             </div>
             <div className="bg-indigo-600 text-white px-6 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg">
                Cost: 10 CR
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic border-b pb-2">Lineup Configuration</h4>
              <div className="space-y-4">
                <Input label="Team 1 Identity" value={team1} onChange={setTeam1} placeholder="Custom Team A" />
                <Input label="Team 2 Identity" value={team2} onChange={setTeam2} placeholder="Custom Team B" />
              </div>
            </div>

            <div className="space-y-6">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic border-b pb-2">Optional Scheduling</h4>
              <div className="grid grid-cols-2 gap-4">
                <Input type="date" label="Match Date" value={scheduleDate} onChange={setScheduleDate} />
                <Input type="time" label="Kick-off Time" value={scheduleTime} onChange={setScheduleTime} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
            <div className="space-y-4">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Format (Best of)</label>
               <div className="flex space-x-2">
                 {[1, 3, 5].map(v => (
                   <button key={v} onClick={() => setFormat(v)} className={`flex-1 py-4 rounded-2xl font-black text-xs transition-all ${format === v ? 'bg-indigo-600 text-white shadow-xl scale-105' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>{v}</button>
                 ))}
               </div>
            </div>

            <div className="space-y-4">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Points per Set</label>
               <div className="flex flex-wrap gap-2">
                 {[11, 15, 21].map(v => (
                   <button key={v} onClick={() => {setPointsPerSet(v); setCustomPoints('');}} className={`flex-1 py-4 px-4 rounded-2xl font-black text-xs transition-all ${pointsPerSet === v ? 'bg-indigo-600 text-white shadow-xl scale-105' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>{v}</button>
                 ))}
                 <button onClick={() => setPointsPerSet(0)} className={`flex-1 py-4 px-4 rounded-2xl font-black text-xs transition-all ${pointsPerSet === 0 ? 'bg-indigo-600 text-white shadow-xl scale-105' : 'bg-slate-50 text-slate-400'}`}>Custom</button>
               </div>
               {pointsPerSet === 0 && <input type="number" placeholder="Enter target score" className="w-full p-4 bg-slate-50 border-2 border-indigo-100 rounded-2xl focus:border-indigo-600 outline-none font-black text-center" value={customPoints} onChange={e => setCustomPoints(e.target.value)} />}
            </div>

            <div className="space-y-4">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Golden Point Cap</label>
               <input type="number" className="w-full p-4 bg-slate-50 border-2 border-slate-50 rounded-2xl focus:border-indigo-600 outline-none font-black text-center" value={goldenPoint} onChange={e => setGoldenPoint(parseInt(e.target.value) || 30)} />
               <p className="text-[8px] font-black text-slate-400 uppercase text-center italic tracking-widest">Tie-break ceiling point</p>
            </div>
          </div>

          <button 
            onClick={startMatch} 
            disabled={isProcessing}
            className="w-full bg-slate-950 text-white py-6 rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-2xl hover:bg-indigo-600 transition-all transform active:scale-95 disabled:opacity-50"
          >
            {isProcessing ? 'Processing Transaction...' : 'Launch Scoreboard (-10 CR) →'}
          </button>
        </div>
      </div>
    );
  }

  const targetPoints = pointsPerSet === 0 ? parseInt(customPoints) : pointsPerSet;

  return (
    <div className="fixed inset-0 bg-[#0c1221] z-[999] flex flex-col animate-in fade-in duration-300 font-sans overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between px-6 sm:px-10 py-6 sm:py-8 gap-4 sm:gap-0">
        <button onClick={() => setGameState('setup')} className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-[#1a2333] hover:bg-slate-700 text-slate-300 px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
          <span>End Session</span>
        </button>
        
        <div className="text-center order-first sm:order-none">
            {matchWinner ? (
              <div className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-6 sm:px-10 py-2 rounded-full mb-2 animate-pulse">
                <span className="text-xs font-black uppercase tracking-[0.4em] italic text-[8px] sm:text-xs">
                  {matchWinner === 1 ? team1 : team2} WINS MATCH!
                </span>
              </div>
            ) : (
              <span className="text-[8px] sm:text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4 block italic">Match Progress</span>
            )}
            <div className="flex items-center justify-center space-x-2">
              {currentScores.map((s, idx) => {
                const winner = getSetWinner(s, targetPoints, goldenPoint);
                const isActive = activeSetIndex === idx;
                return (
                  <button key={idx} onClick={() => !matchWinner && setActiveSetIndex(idx)} className="flex flex-col items-center transition-all group">
                     <div className={`w-12 sm:w-20 h-1.5 sm:h-2 rounded-full mb-2 ${winner === 1 ? 'bg-indigo-500' : winner === 2 ? 'bg-emerald-500' : isActive ? 'bg-white' : 'bg-slate-700'}`}></div>
                     <span className={`text-[8px] sm:text-[9px] font-black italic transition-all ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`}>SET {idx + 1} {winner !== 0 && (winner === 1 ? 'L' : 'R')}</span>
                  </button>
                );
              })}
            </div>
        </div>
        
        <div className="hidden sm:block text-right">
           <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{scheduleDate}</p>
           <p className="text-sm font-black text-slate-300 uppercase italic tracking-tighter">{scheduleTime}</p>
        </div>
      </div>

      {/* Main Scoring View */}
      <div className="flex-grow flex flex-col md:flex-row items-center justify-center gap-6 md:gap-10 p-6 sm:p-10 overflow-y-auto sm:overflow-hidden">
        {/* T1 Scoring Card */}
        {(() => {
          const displaySide = isSwapped ? 2 : 1;
          const name = displaySide === 1 ? team1 : team2;
          const score = currentScores[activeSetIndex][`s${displaySide}` as keyof MatchScore];
          const winner = getSetWinner(currentScores[activeSetIndex], targetPoints, goldenPoint);
          const isSetWon = winner === displaySide;
          const isOtherWon = winner !== 0 && !isSetWon;
          
          const sideColor = displaySide === 1 ? 'bg-[#121931] border-[#4f46e5]/20' : 'bg-[#0a1f1a] border-[#10b981]/20';
          const btnColor = displaySide === 1 ? 'bg-[#4f46e5]' : 'bg-[#10b981]';
          
          return (
            <div key="side-1" className={`w-full md:flex-1 h-1/2 md:h-full rounded-[2rem] sm:rounded-[4rem] border-2 flex flex-col items-center justify-center relative transition-all duration-700 ${sideColor} p-4 sm:p-0 ${matchWinner && matchWinner !== displaySide ? 'grayscale opacity-30' : ''}`}>
              {isSetWon && <div className="absolute top-4 sm:top-12 bg-white text-indigo-900 px-4 sm:px-6 py-1 rounded-full font-black text-[8px] sm:text-[10px] uppercase tracking-widest animate-bounce">SET WINNER</div>}
              <div className="text-center w-full px-6 sm:px-10">
                <h2 className={`text-2xl sm:text-5xl font-black text-white uppercase italic tracking-tighter mb-4 sm:mb-8 ${isOtherWon ? 'opacity-30' : 'opacity-100'} truncate`}>{name}</h2>
                <div className="flex items-center justify-center space-x-4 sm:space-x-12">
                   <button onClick={() => handleUpdateScore(displaySide as 1|2, -1)} className="w-12 h-12 sm:w-32 sm:h-32 rounded-full bg-white/5 border border-white/10 text-slate-400 text-xl sm:text-5xl active:scale-90 transition-all">—</button>
                   <span className={`text-[100px] sm:text-[280px] font-black text-white leading-none italic tabular-nums tracking-tighter ${isOtherWon ? 'opacity-20 scale-90' : 'opacity-100'}`}>{score}</span>
                   <button disabled={isSetWon || isOtherWon || !!matchWinner} onClick={() => handleUpdateScore(displaySide as 1|2, 1)} className={`w-12 h-12 sm:w-32 sm:h-32 rounded-full flex items-center justify-center text-2xl sm:text-6xl text-white ${btnColor} active:scale-90 transition-all disabled:opacity-20 shadow-2xl`}>+</button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* T2 Scoring Card */}
        {(() => {
          const displaySide = isSwapped ? 1 : 2;
          const name = displaySide === 1 ? team1 : team2;
          const score = currentScores[activeSetIndex][`s${displaySide}` as keyof MatchScore];
          const winner = getSetWinner(currentScores[activeSetIndex], targetPoints, goldenPoint);
          const isSetWon = winner === displaySide;
          const isOtherWon = winner !== 0 && !isSetWon;
          
          const sideColor = displaySide === 1 ? 'bg-[#121931] border-[#4f46e5]/20' : 'bg-[#0a1f1a] border-[#10b981]/20';
          const btnColor = displaySide === 1 ? 'bg-[#4f46e5]' : 'bg-[#10b981]';
          
          return (
            <div key="side-2" className={`w-full md:flex-1 h-1/2 md:h-full rounded-[2rem] sm:rounded-[4rem] border-2 flex flex-col items-center justify-center relative transition-all duration-700 ${sideColor} p-4 sm:p-0 ${matchWinner && matchWinner !== displaySide ? 'grayscale opacity-30' : ''}`}>
              {isSetWon && <div className="absolute top-4 sm:top-12 bg-white text-indigo-900 px-4 sm:px-6 py-1 rounded-full font-black text-[8px] sm:text-[10px] uppercase tracking-widest animate-bounce">SET WINNER</div>}
              <div className="text-center w-full px-6 sm:px-10">
                <h2 className={`text-2xl sm:text-5xl font-black text-white uppercase italic tracking-tighter mb-4 sm:mb-8 ${isOtherWon ? 'opacity-30' : 'opacity-100'} truncate`}>{name}</h2>
                <div className="flex items-center justify-center space-x-4 sm:space-x-12">
                   <button onClick={() => handleUpdateScore(displaySide as 1|2, -1)} className="w-12 h-12 sm:w-32 sm:h-32 rounded-full bg-white/5 border border-white/10 text-slate-400 text-xl sm:text-5xl active:scale-90 transition-all">—</button>
                   <span className={`text-[100px] sm:text-[280px] font-black text-white leading-none italic tabular-nums tracking-tighter ${isOtherWon ? 'opacity-20 scale-90' : 'opacity-100'}`}>{score}</span>
                   <button disabled={isSetWon || isOtherWon || !!matchWinner} onClick={() => handleUpdateScore(displaySide as 1|2, 1)} className={`w-12 h-12 sm:w-32 sm:h-32 rounded-full flex items-center justify-center text-2xl sm:text-6xl text-white ${btnColor} active:scale-90 transition-all disabled:opacity-20 shadow-2xl`}>+</button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Footer Controls */}
      <div className="px-6 sm:px-10 py-6 sm:py-10 flex flex-col sm:flex-row items-center justify-between gap-6 sm:gap-0">
        <button onClick={() => setIsSwapped(!isSwapped)} className="w-12 h-12 sm:w-20 sm:h-20 rounded-full bg-[#1a2333] border border-white/5 flex items-center justify-center text-slate-400 rotate-90 active:scale-90 transition-transform">
           <svg className="w-6 h-6 sm:w-10 sm:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        </button>
        
        <div className="flex-1 w-full sm:max-w-2xl sm:mx-10">
           <div className="bg-[#121931]/80 border border-white/5 rounded-2xl sm:rounded-[2.5rem] py-3 sm:py-6 flex flex-col items-center justify-center shadow-inner">
              <span className="text-[10px] sm:text-[12px] font-black text-slate-400 uppercase tracking-[0.3em] sm:tracking-[0.5em] italic leading-none">Rules: {targetPoints}pts Set • {goldenPoint}pts Golden Cap</span>
              {matchWinner && (
                <span className="text-[10px] font-black text-emerald-500 uppercase italic mt-2 animate-pulse">Match Concluded</span>
              )}
           </div>
        </div>
        
        <div className="flex items-center space-x-4 w-full sm:w-auto">
           <button onClick={() => setGameState('setup')} className="flex-1 sm:flex-none px-12 py-5 rounded-[2rem] bg-rose-500/10 text-rose-500 border border-rose-500/20 font-black uppercase text-xs tracking-widest active:scale-95 transition-all">
             Abort Match
           </button>
        </div>
      </div>

      {/* Winner Announcement Overlay */}
      {matchWinner && (
        <div className="absolute inset-0 z-[1000] bg-indigo-600/90 backdrop-blur-xl flex flex-col items-center justify-center p-10 text-center animate-in zoom-in duration-500">
           <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center text-6xl mb-8 animate-bounce shadow-2xl">🏆</div>
           <h2 className="text-[10px] font-black text-white uppercase tracking-[1em] mb-4 italic opacity-80">Official Announcement</h2>
           <h1 className="text-6xl md:text-8xl font-black text-white uppercase italic tracking-tighter leading-none mb-6">
             {matchWinner === 1 ? team1 : team2}
           </h1>
           <p className="text-2xl font-black text-white uppercase tracking-widest italic mb-12 border-y-2 border-white/20 py-4 px-10">
             Match Victory
           </p>
           <button onClick={() => setGameState('setup')} className="bg-white text-indigo-600 px-12 py-5 rounded-full font-black uppercase tracking-widest text-sm shadow-2xl hover:scale-110 active:scale-95 transition-all">
             Exit to Setup
           </button>
        </div>
      )}
    </div>
  );
};

const Input = ({ label, value, onChange, placeholder, type = "text" }: any) => (
  <div className="space-y-1">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
    <input type={type} placeholder={placeholder} className="w-full p-4 bg-slate-50 border-2 border-slate-50 rounded-2xl focus:border-indigo-600 outline-none font-black text-slate-700 placeholder:text-slate-300" value={value} onChange={(e) => onChange(e.target.value)} />
  </div>
);

export default QuickScore;
