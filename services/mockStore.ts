
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  updateDoc, 
  query, 
  where,
  increment,
  limit,
  deleteDoc,
  orderBy,
  arrayUnion,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  updatePassword
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { db, auth } from './firebase.ts';
import { User, Tournament, Match, UserRole, TournamentType, MatchFormat, MatchStatus, Team, CreditRequest, TournamentPlayer, MatchScore, JoinRequest, RankingCriterion } from '../types.ts';

const SHADOW_DOMAIN = "@smashpro.local";

class DataService {
  async login(username: string, password: string): Promise<User | null> {
    const normalizedUsername = username.toLowerCase().trim();
    
    // Emergency Reset / Bypass for SuperAdmin
    if (normalizedUsername === 'superadmin' && password === 'Pinky@123') {
      const q = query(collection(db, "users"), where("username", "==", "superadmin"));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs[0].data() as User;
      }
    }

    try {
      const email = normalizedUsername + SHADOW_DOMAIN;
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
        return userDoc.exists() ? (userDoc.data() as User) : null;
      } catch (authError) {
        // Fallback for Firestore-only records or bypassed accounts
        const q = query(collection(db, "users"), where("username", "==", normalizedUsername));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const userData = snapshot.docs[0].data() as User;
          if (userData.password === password) {
            return userData;
          }
        }
        throw authError;
      }
    } catch (error) { throw error; }
  }

  async signup(userData: Omit<User, 'id' | 'credits'>): Promise<User | null> {
    try {
      const email = userData.username.toLowerCase().trim() + SHADOW_DOMAIN;
      const userCredential = await createUserWithEmailAndPassword(auth, email, userData.password || "");
      const uid = userCredential.user.uid;
      const usersSnap = await getDocs(query(collection(db, "users"), limit(1)));
      const isFirstUser = usersSnap.empty;

      const newUser: User = {
        name: userData.name,
        username: userData.username.toLowerCase().trim(),
        email: email,
        id: uid,
        credits: 0, 
        role: isFirstUser ? UserRole.SUPERADMIN : userData.role,
        password: userData.password
      };
      await setDoc(doc(db, "users", uid), newUser);
      return newUser;
    } catch (error) { throw error; }
  }

  async changePassword(userId: string, newPassword: string) {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, { password: newPassword });
    if (auth.currentUser && auth.currentUser.uid === userId) {
      await updatePassword(auth.currentUser, newPassword);
    }
  }

  async logout() { await signOut(auth); }

  async getAllUsers(): Promise<User[]> {
    const snapshot = await getDocs(collection(db, "users"));
    return snapshot.docs.map(doc => doc.data() as User);
  }

  async deleteUser(userId: string) {
    await deleteDoc(doc(db, "users", userId));
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const q = query(collection(db, "users"), where("username", "==", username.toLowerCase().trim()));
    const snapshot = await getDocs(q);
    return snapshot.empty ? null : (snapshot.docs[0].data() as User);
  }

  async requestReset(username: string): Promise<boolean> {
    const user = await this.getUserByUsername(username);
    if (!user) return false;
    await updateDoc(doc(db, "users", user.id), { resetRequested: true });
    return true;
  }

  async getResetRequests(): Promise<User[]> {
    const q = query(collection(db, "users"), where("resetRequested", "==", true));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as User);
  }

  async completeReset(userId: string, newPassword: string) {
    await updateDoc(doc(db, "users", userId), { 
      password: newPassword, 
      resetRequested: false 
    });
  }

  async requestCredits(userId: string, username: string, amount: number) {
    await addDoc(collection(db, "creditRequests"), {
      userId, username, amount, status: 'PENDING', timestamp: new Date().toISOString()
    });
  }

  async getCreditRequests(): Promise<CreditRequest[]> {
    const q = query(collection(db, "creditRequests"), where("status", "==", "PENDING"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as CreditRequest));
  }

  async resolveCreditRequest(requestId: string, approved: boolean) {
    const reqDoc = await getDoc(doc(db, "creditRequests", requestId));
    if (!reqDoc.exists()) return;
    const reqData = reqDoc.data();
    if (approved) await this.adjustCredits(reqData.userId, reqData.amount, "Approved Credit Request");
    await updateDoc(doc(db, "creditRequests", requestId), { status: approved ? 'APPROVED' : 'REJECTED' });
  }

  async adjustCredits(userId: string, amount: number, reason: string) {
    await updateDoc(doc(db, "users", userId), { credits: increment(amount) });
  }

  async getTournaments(): Promise<Tournament[]> {
    const snapshot = await getDocs(collection(db, "tournaments"));
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Tournament));
  }

  async addTournament(data: Omit<Tournament, 'id' | 'uniqueId'>): Promise<Tournament> {
    const uniqueId = `T-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const docRef = await addDoc(collection(db, "tournaments"), { 
      ...data, 
      uniqueId, 
      isLocked: false,
      rankingCriteriaOrder: ['MATCHES_WON', 'SETS_WON', 'POINTS_DIFF', 'HEAD_TO_HEAD']
    });
    await this.adjustCredits(data.organizerId, -200, "Tournament Creation");
    return { ...data, id: docRef.id, uniqueId, isLocked: false } as Tournament;
  }

  async updateTournamentSettings(id: string, updates: Partial<Tournament>) {
    await updateDoc(doc(db, "tournaments", id), updates);
  }

  async deleteTournament(tournamentId: string) {
    const batch = writeBatch(db);
    batch.delete(doc(db, "tournaments", tournamentId));
    const [matchesSnap, teamsSnap, joinReqSnap] = await Promise.all([
      getDocs(query(collection(db, "matches"), where("tournamentId", "==", tournamentId))),
      getDocs(query(collection(db, "teams"), where("tournamentId", "==", tournamentId))),
      getDocs(query(collection(db, "joinRequests"), where("tournamentId", "==", tournamentId)))
    ]);
    matchesSnap.forEach(d => batch.delete(d.ref));
    teamsSnap.forEach(d => batch.delete(d.ref));
    joinReqSnap.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }

  async searchTournamentById(uniqueId: string): Promise<Tournament | null> {
    const q = query(collection(db, "tournaments"), where("uniqueId", "==", uniqueId.toUpperCase()));
    const snapshot = await getDocs(q);
    return snapshot.empty ? null : ({ ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as Tournament);
  }

  async joinTournament(tournamentId: string, user: User) {
    const tDoc = await getDoc(doc(db, "tournaments", tournamentId));
    if (!tDoc.exists()) throw new Error("Arena not found");
    const tData = tDoc.data() as Tournament;
    if ((tData.participants || []).includes(user.username)) {
      throw new Error("player is already there");
    }
    
    const pool = tData.playerPool || [];
    const exists = pool.some(p => p.username === user.username);
    
    const updates: any = {
      participants: arrayUnion(user.username)
    };
    
    if (!exists) {
      updates.playerPool = arrayUnion({
        id: user.id,
        name: user.name,
        username: user.username,
        isRegistered: true
      });
    }

    await updateDoc(doc(db, "tournaments", tournamentId), updates);
  }

  async requestJoinTournament(tournamentId: string, user: User) {
    const tDoc = await getDoc(doc(db, "tournaments", tournamentId));
    if (!tDoc.exists()) throw new Error("Arena not found");
    const tData = tDoc.data() as Tournament;
    if ((tData.participants || []).includes(user.username)) {
      throw new Error("player is already there");
    }

    const q = query(collection(db, "joinRequests"), 
      where("tournamentId", "==", tournamentId), 
      where("username", "==", user.username), 
      where("status", "==", "PENDING")
    );
    const existing = await getDocs(q);
    if (!existing.empty) throw new Error("Join request already pending");

    await addDoc(collection(db, "joinRequests"), {
      tournamentId,
      userId: user.id,
      username: user.username,
      name: user.name,
      status: 'PENDING',
      timestamp: new Date().toISOString()
    });
  }

  async getJoinRequests(tournamentId: string): Promise<JoinRequest[]> {
    const q = query(collection(db, "joinRequests"), where("tournamentId", "==", tournamentId), where("status", "==", "PENDING"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as JoinRequest));
  }

  async resolveJoinRequest(requestId: string, tournamentId: string, username: string, approved: boolean) {
    const batch = writeBatch(db);
    const reqRef = doc(db, "joinRequests", requestId);
    const tourneyRef = doc(db, "tournaments", tournamentId);

    if (approved) {
      const user = await this.getUserByUsername(username);
      const tDoc = await getDoc(tourneyRef);
      if (tDoc.exists()) {
        const tData = tDoc.data();
        batch.update(tourneyRef, { participants: arrayUnion(username) });
        if (user) {
          const pool = tData.playerPool || [];
          const exists = pool.some((p: any) => p.username === username);
          if (!exists) {
            batch.update(tourneyRef, {
              playerPool: arrayUnion({
                id: user.id,
                name: user.name,
                username: user.username,
                isRegistered: true
              })
            });
          }
        }
      }
    }
    batch.update(reqRef, { status: approved ? 'APPROVED' : 'REJECTED' });
    await batch.commit();
  }

  async updateTournamentPool(id: string, pool: TournamentPlayer[]) {
    await updateDoc(doc(db, "tournaments", id), { playerPool: pool });
  }

  async lockTournament(id: string) {
    await updateDoc(doc(db, "tournaments", id), { isLocked: true });
  }

  async addTeam(data: Omit<Team, 'id'>): Promise<Team> {
    const docRef = await addDoc(collection(db, "teams"), data);
    return { ...data, id: docRef.id } as Team;
  }

  async getTeams(tournamentId: string): Promise<Team[]> {
    const q = query(collection(db, "teams"), where("tournamentId", "==", tournamentId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Team));
  }

  async deleteTeam(id: string) {
    await deleteDoc(doc(db, "teams", id));
  }

  async createMatch(data: Omit<Match, 'id'>): Promise<Match> {
    const docRef = await addDoc(collection(db, "matches"), data);
    return { ...data, id: docRef.id } as Match;
  }

  async getMatchesByTournament(tournamentId: string): Promise<Match[]> {
    const q = query(collection(db, "matches"), where("tournamentId", "==", tournamentId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Match));
  }

  async getMatchesForUser(userId: string): Promise<Match[]> {
    const snapshot = await getDocs(collection(db, "matches"));
    return snapshot.docs
      .map(doc => ({ ...doc.data(), id: doc.id } as Match))
      .filter(m => m.participants.includes(userId))
      .sort((a,b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, 10);
  }

  async updateMatchScore(matchId: string, scores: MatchScore[], participants: string[]) {
    const matchSnap = await getDoc(doc(db, "matches", matchId));
    if (!matchSnap.exists()) return;
    const match = matchSnap.data() as Match;
    const { pointsOption, goldenPoint, bestOf } = match;

    let p1Sets = 0;
    let p2Sets = 0;

    scores.forEach(s => {
      const s1Won = (s.s1 >= pointsOption && (s.s1 - s.s2) >= 2) || (s.s1 >= goldenPoint);
      const s2Won = (s.s2 >= pointsOption && (s.s2 - s.s1) >= 2) || (s.s2 >= goldenPoint);
      if (s1Won) p1Sets++;
      else if (s2Won) p2Sets++;
    });

    const setsRequired = Math.ceil((bestOf + 1) / 2);
    const isComplete = p1Sets >= setsRequired || p2Sets >= setsRequired;
    
    const updateData: any = { scores };
    
    if (isComplete) {
      updateData.status = MatchStatus.COMPLETED;
      updateData.winnerId = p1Sets > p2Sets ? participants[0] : participants[1];
    } else {
      updateData.status = MatchStatus.LIVE;
    }

    await updateDoc(doc(db, "matches", matchId), updateData);
  }

  async calculateStandings(tournamentId: string): Promise<any[]> {
    const tournamentDoc = await getDoc(doc(db, "tournaments", tournamentId));
    if (!tournamentDoc.exists()) return [];
    const tournament = tournamentDoc.data() as Tournament;
    const criteria = tournament.rankingCriteriaOrder || ['MATCHES_WON', 'SETS_WON', 'POINTS_DIFF', 'HEAD_TO_HEAD'];

    const teams = await this.getTeams(tournamentId);
    const matches = await this.getMatchesByTournament(tournamentId);
    
    const stats = teams.map(t => ({
      id: t.id,
      name: t.name,
      played: 0,
      matchesWon: 0,
      setsWon: 0,
      pointsScored: 0,
      pointsConceded: 0,
      headToHead: {} as Record<string, number> 
    }));

    matches.filter(m => m.status === MatchStatus.COMPLETED).forEach(m => {
      const t1 = stats.find(s => s.id === m.participants[0]);
      const t2 = stats.find(s => s.id === m.participants[1]);
      if (t1 && t2) {
        t1.played++;
        t2.played++;
        
        let t1Sets = 0, t2Sets = 0;
        m.scores.forEach(s => {
          t1.pointsScored += s.s1;
          t1.pointsConceded += s.s2;
          t2.pointsScored += s.s2;
          t2.pointsConceded += s.s1;
          
          const s1Won = (s.s1 >= m.pointsOption && (s.s1 - s.s2) >= 2) || (s.s1 >= m.goldenPoint);
          const s2Won = (s.s2 >= m.pointsOption && (s.s2 - s.s1) >= 2) || (s.s2 >= m.goldenPoint);
          if (s1Won) t1Sets++;
          else if (s2Won) t2Sets++;
        });
        
        t1.setsWon += t1Sets;
        t2.setsWon += t2Sets;

        if (m.winnerId === t1.id) {
          t1.matchesWon++;
          t1.headToHead[t2.id] = (t1.headToHead[t2.id] || 0) + 1;
        } else {
          t2.matchesWon++;
          t2.headToHead[t1.id] = (t2.headToHead[t1.id] || 0) + 1;
        }
      }
    });

    return stats.sort((a, b) => {
      for (const criterion of criteria) {
        if (criterion === 'MATCHES_WON') {
          if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon;
        } else if (criterion === 'SETS_WON') {
          if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon;
        } else if (criterion === 'POINTS_DIFF') {
          const diffA = a.pointsScored - a.pointsConceded;
          const diffB = b.pointsScored - b.pointsConceded;
          if (diffB !== diffA) return diffB - diffA;
        } else if (criterion === 'HEAD_TO_HEAD') {
          if (a.headToHead[b.id]) return -1;
          if (b.headToHead[a.id]) return 1;
        }
      }
      return 0;
    });
  }
}

export const store = new DataService();
