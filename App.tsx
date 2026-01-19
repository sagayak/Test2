
import React, { useState, useEffect } from 'react';
import { User, UserRole, Tournament } from './types';
import { store } from './services/mockStore';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Tournaments from './pages/Tournaments';
import Admin from './pages/Admin';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAuth, setIsAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [loading, setLoading] = useState(false);
  const [pendingJoinId, setPendingJoinId] = useState<string | null>(null);
  const [invitedTournament, setInvitedTournament] = useState<Tournament | null>(null);
  
  // Auth Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.PLAYER);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Password Update State
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passUpdateMsg, setPassUpdateMsg] = useState<{ type: 'err' | 'ok', txt: string } | null>(null);
  const [showPassFields, setShowPassFields] = useState(false);

  // Handle Join Link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get('join');
    if (joinId) {
      setPendingJoinId(joinId);
      store.searchTournamentById(joinId).then(t => {
        if (t) setInvitedTournament(t);
      });
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await store.login(username, password);
      if (user) {
        setCurrentUser(user);
        setIsAuth(true);
        if (pendingJoinId) setActiveTab('tournaments');
      } else {
        setError('User profile not found.');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const newUser = await store.signup({
        username,
        password,
        name,
        email: `${username}@smashpro.local`,
        role
      });
      if (newUser) {
        const user = await store.login(username, password);
        if (user) {
          setCurrentUser(user);
          setIsAuth(true);
          if (pendingJoinId) setActiveTab('tournaments');
        } else {
          setAuthMode('login');
          setSuccess('Signup successful! Please login.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Signup failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentUser) return;
    if (newPass !== confirmPass) return setPassUpdateMsg({ type: 'err', txt: "Passwords don't match!" });
    if (newPass.length < 6) return setPassUpdateMsg({ type: 'err', txt: "Minimum 6 characters required." });
    
    setLoading(true);
    try {
      await store.changePassword(currentUser.id, newPass);
      setPassUpdateMsg({ type: 'ok', txt: "Password updated successfully!" });
      setNewPass(''); setConfirmPass('');
      setTimeout(() => setPassUpdateMsg(null), 3000);
    } catch (err) {
      setPassUpdateMsg({ type: 'err', txt: "System error. Try again later." });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await store.logout();
    setCurrentUser(null);
    setIsAuth(false);
    setUsername('');
    setPassword('');
  };

  if (!isAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-[2rem] p-10 shadow-2xl relative overflow-hidden">
          {invitedTournament && (
            <div className="absolute top-0 left-0 right-0 bg-indigo-600 p-4 text-center">
               <p className="text-white text-[10px] font-black uppercase tracking-widest leading-none">Invited to join:</p>
               <h4 className="text-white font-black text-sm uppercase italic tracking-tighter mt-1">{invitedTournament.name}</h4>
            </div>
          )}
          <div className={`text-center mb-8 ${invitedTournament ? 'mt-12' : ''}`}>
            <h1 className="text-4xl font-black text-slate-800 tracking-tighter uppercase italic">SmashPro</h1>
            <p className="text-slate-400 mt-2 font-black text-[10px] uppercase tracking-widest">Tournament Ecosystem</p>
          </div>
          {error && <div className="mb-4 p-3 bg-rose-50 text-rose-500 text-[10px] font-black rounded-xl text-center border border-rose-100 uppercase">{error}</div>}
          {success && <div className="mb-4 p-3 bg-emerald-50 text-emerald-500 text-[10px] font-black rounded-xl text-center border border-emerald-100 uppercase">{success}</div>}
          {authMode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <Input label="Username" value={username} onChange={setUsername} placeholder="your_username" disabled={loading} />
              <Input label="Password" value={password} onChange={setPassword} placeholder="••••••••" type="password" disabled={loading} />
              <button disabled={loading} type="submit" className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl hover:bg-indigo-700 transition-all uppercase tracking-widest text-xs">
                {loading ? 'Entering...' : 'Sign In'}
              </button>
              <div className="flex justify-between text-[10px] font-black uppercase pt-2">
                <button type="button" onClick={() => setAuthMode('signup')} className="text-indigo-500">New Account</button>
              </div>
            </form>
          )}
          {authMode === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-4">
              <Input label="Full Name" value={name} onChange={setName} placeholder="John Doe" disabled={loading} />
              <Input label="Username" value={username} onChange={setUsername} placeholder="johndoe" disabled={loading} />
              <Input label="Password" value={password} onChange={setPassword} placeholder="••••••••" type="password" disabled={loading} />
              <button disabled={loading} type="submit" className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl hover:bg-indigo-700 uppercase tracking-widest text-xs">Sign Up</button>
              <button type="button" onClick={() => setAuthMode('login')} className="w-full text-[10px] font-black text-slate-400 uppercase py-2">Back to Login</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <Layout user={currentUser} onLogout={handleLogout} activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'dashboard' && currentUser && <Dashboard user={currentUser} />}
      {activeTab === 'tournaments' && currentUser && <Tournaments user={currentUser} initialJoinId={pendingJoinId} />}
      {activeTab === 'admin' && currentUser && <Admin user={currentUser} />}
      {activeTab === 'profile' && (
        <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
           <div className="bg-white p-12 rounded-[3rem] shadow-sm border border-slate-200 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-indigo-500 to-slate-900 opacity-10"></div>
            <div className="w-40 h-40 bg-white rounded-full mx-auto flex items-center justify-center text-6xl mb-6 shadow-2xl relative z-10 border-8 border-slate-50">👤</div>
            <h3 className="text-4xl font-black text-slate-800 tracking-tighter uppercase italic">{currentUser?.name}</h3>
            <p className="text-slate-400 font-black uppercase tracking-[0.3em] mb-8 text-xs">@{currentUser?.username}</p>
            <div className="max-w-md mx-auto space-y-4 text-left bg-slate-50 p-8 rounded-[2.5rem]">
              <ProfileRow label="Role" value={currentUser?.role || ''} isHighlight />
              <ProfileRow label="Credits Balance" value={`${currentUser?.credits || 0} CR`} />
            </div>
          </div>

          <div className="bg-white p-12 rounded-[3rem] shadow-sm border border-slate-200">
             <div className="flex items-center justify-between mb-8 bg-indigo-50/50 p-4 rounded-2xl border-l-4 border-indigo-600">
                <h4 className="text-xl font-black text-indigo-900 uppercase italic tracking-tighter">Security & Protection</h4>
                <button onClick={() => setShowPassFields(!showPassFields)} className="bg-white border border-indigo-100 text-indigo-600 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm">
                  {showPassFields ? 'Cancel' : 'Change Password'}
                </button>
             </div>
             {showPassFields && (
               <div className="max-w-md space-y-6">
                  {passUpdateMsg && <div className={`p-4 rounded-2xl text-[10px] font-black uppercase text-center border ${passUpdateMsg.type === 'err' ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-600'}`}>{passUpdateMsg.txt}</div>}
                  <Input label="New Password" type="password" value={newPass} onChange={setNewPass} placeholder="••••••••" />
                  <Input label="Confirm Password" type="password" value={confirmPass} onChange={setConfirmPass} placeholder="••••••••" />
                  <button onClick={handleUpdatePassword} disabled={loading} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-xl disabled:opacity-50">
                    {loading ? 'Processing...' : 'Secure Account'}
                  </button>
               </div>
             )}
          </div>
        </div>
      )}
    </Layout>
  );
};

const Input = ({ label, value, onChange, placeholder, type = "text", disabled = false }: any) => (
  <div className="space-y-1">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
    <input type={type} placeholder={placeholder} disabled={disabled} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 outline-none font-bold" value={value} onChange={(e) => onChange(e.target.value)} />
  </div>
);

const ProfileRow = ({ label, value, isHighlight = false }: any) => (
  <div className="flex justify-between items-center py-4 border-b border-slate-200/50 last:border-0">
    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
    <span className={`font-black uppercase italic tracking-tighter ${isHighlight ? 'text-indigo-600 text-sm' : 'text-slate-700 text-xs'}`}>{value}</span>
  </div>
);

export default App;
