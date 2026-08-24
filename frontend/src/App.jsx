import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import {
  Ticket,
  User,
  Calendar,
  Lock,
  Plus,
  Compass,
  LayoutDashboard,
  CheckCircle,
  Clock,
  LogOut,
  AlertCircle
} from 'lucide-react';
import SeatMap from './components/SeatMap';
import WaitlistModal from './components/WaitlistModal';
import AdminPanel from './components/AdminPanel';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [shows, setShows] = useState([]);
  const [selectedShow, setSelectedShow] = useState(null);
  const [seats, setSeats] = useState([]);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [waitlists, setWaitlists] = useState([]);
  const [error, setError] = useState(null);

  // Timer state
  const [holdExpiresAt, setHoldExpiresAt] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);

  // Modal State
  const [isWaitlistOpen, setIsWaitlistOpen] = useState(false);

  // Login inputs
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Quick roles shortcut login
  const handleQuickLogin = async (email) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'password123' }),
      });
      const data = await response.json();
      if (response.ok) {
        setToken(data.token);
        localStorage.setItem('token', data.token);
        setCurrentUser(data);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Could not connect to authentication service.');
    } finally {
      setLoading(false);
    }
  };

  // Regular login
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await response.json();
      if (response.ok) {
        setToken(data.token);
        localStorage.setItem('token', data.token);
        setCurrentUser(data);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Could not connect to authentication service.');
    } finally {
      setLoading(false);
    }
  };

  // Google Login Callback handler
  const handleGoogleCredentialResponse = async (response) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: response.credential }),
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        localStorage.setItem('token', data.token);
        setCurrentUser(data);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Could not connect to Google authentication service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser && window.google) {
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '294318417502-8im081nbm235m8egr3bu361gueoara09.apps.googleusercontent.com',
        callback: handleGoogleCredentialResponse,
      });
      window.google.accounts.id.renderButton(
        document.getElementById('googleBtn'),
        { theme: 'filled_black', size: 'large', shape: 'pill', width: 384 }
      );
    }
  }, [currentUser]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
    setCurrentUser(null);
    setSelectedShow(null);
    setSeats([]);
    setSelectedSeats([]);
  };

  // Fetch current user details
  useEffect(() => {
    if (token) {
      fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (!res.ok) throw new Error('Session expired');
          return res.json();
        })
        .then((data) => setCurrentUser(data))
        .catch(() => handleLogout());
    }
  }, [token]);

  // Fetch Shows
  const fetchShows = () => {
    fetch(`${API_BASE}/api/seats/shows`)
      .then((res) => res.json())
      .then((data) => setShows(data))
      .catch((err) => console.error('Error fetching shows:', err));
  };

  useEffect(() => {
    fetchShows();
  }, []);

  // Fetch Seats when show is selected
  useEffect(() => {
    if (selectedShow) {
      fetch(`${API_BASE}/api/seats/show/${selectedShow._id}`)
        .then((res) => res.json())
        .then((data) => setSeats(data))
        .catch((err) => console.error('Error fetching seats:', err));

      // Fetch bookings & waitlists if customer is logged in
      if (currentUser && currentUser.role === 'customer') {
        fetchBookings();
        fetchWaitlists();
      }
    }
  }, [selectedShow, currentUser]);

  const fetchBookings = () => {
    fetch(`${API_BASE}/api/bookings/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setBookings(data))
      .catch((err) => console.error(err));
  };

  const fetchWaitlists = () => {
    fetch(`${API_BASE}/api/waitlist/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setWaitlists(data))
      .catch((err) => console.error(err));
  };

  // Countdown timer logic
  useEffect(() => {
    if (!holdExpiresAt) {
      setTimeLeft(0);
      return;
    }

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(holdExpiresAt) - new Date()) / 1000));
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        setHoldExpiresAt(null);
        setSelectedSeats([]);
        alert('Hold session has expired. Selected seats have been auto-released.');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [holdExpiresAt]);

  // Request holds
  const handleHoldSeats = async () => {
    if (selectedSeats.length === 0) return;
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/seats/hold`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          showId: selectedShow._id,
          seatIds: selectedSeats,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setHoldExpiresAt(data.holdExpiresAt);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Hold failed due to network error.');
    }
  };

  // Confirm booking (Checkout)
  const handleConfirmCheckout = async () => {
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/bookings/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          showId: selectedShow._id,
          seatIds: selectedSeats,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setHoldExpiresAt(null);
        setSelectedSeats([]);
        fetchBookings();
        // Refresh seats local state
        fetch(`${API_BASE}/api/seats/show/${selectedShow._id}`)
          .then((res) => res.json())
          .then((d) => setSeats(d));
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Checkout failed.');
    }
  };

  // Join Waitlist
  const handleJoinWaitlist = async (showId, category) => {
    try {
      const response = await fetch(`${API_BASE}/api/waitlist/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ showId, category }),
      });
      if (response.ok) {
        fetchWaitlists();
        alert('Joined waitlist successfully!');
      } else {
        const data = await response.json();
        alert(data.message);
      }
    } catch (err) {
      alert('Network error joining waitlist.');
    }
  };

  // Format countdown time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (!currentUser) {
    return (
      <div className="relative min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 overflow-hidden">
        {/* Ambient Glowing Background Elements */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[8s]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-fuchsia-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[12s]" />

        <div className="relative w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] space-y-8 transition-all hover:border-slate-700/50">
          <div className="text-center space-y-3">
            <div className="inline-flex p-3 bg-violet-500/10 rounded-2xl border border-violet-500/20 mb-1">
              <Ticket className="text-violet-400 w-8 h-8 animate-bounce duration-[3s]" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-violet-400 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent">
              TicketBooking
            </h1>
            <p className="text-xs text-slate-400 uppercase tracking-widest font-medium">
              Secure Real-Time Reservation
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2.5 p-3.5 bg-rose-500/10 text-rose-300 border border-rose-500/20 rounded-xl text-sm animate-shake">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Email</label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full bg-slate-950/40 border border-slate-800 rounded-xl p-3.5 text-slate-200 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 text-sm transition-all placeholder:text-slate-600"
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Password</label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full bg-slate-950/40 border border-slate-800 rounded-xl p-3.5 text-slate-200 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 text-sm transition-all placeholder:text-slate-600"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-xl font-bold shadow-lg shadow-violet-600/20 hover:shadow-violet-600/30 transition-all text-sm disabled:opacity-50 cursor-pointer active:scale-[0.98]"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-800/80"></div>
            <span className="flex-shrink mx-4 text-slate-500 text-[10px] font-bold uppercase tracking-wider">Or</span>
            <div className="flex-grow border-t border-slate-800/80"></div>
          </div>

          <div className="flex justify-center">
            <div id="googleBtn" className="w-full max-w-sm flex justify-center"></div>
          </div>

          {/* Quick roles switcher */}
          <div className="border-t border-slate-800/80 pt-6 space-y-4">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block text-center">
              Quick Sign In (Simulation)
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleQuickLogin('customer@example.com')}
                className="py-2.5 bg-slate-950/20 hover:bg-violet-600/10 border border-slate-800 hover:border-violet-500/30 text-xs font-bold rounded-xl text-slate-300 hover:text-violet-300 transition-all cursor-pointer"
              >
                Customer
              </button>
              <button
                onClick={() => handleQuickLogin('organizer@example.com')}
                className="py-2.5 bg-slate-950/20 hover:bg-fuchsia-600/10 border border-slate-800 hover:border-fuchsia-500/30 text-xs font-bold rounded-xl text-slate-300 hover:text-fuchsia-300 transition-all cursor-pointer"
              >
                Organizer
              </button>
              <button
                onClick={() => handleQuickLogin('admin@example.com')}
                className="py-2.5 bg-slate-950/20 hover:bg-pink-600/10 border border-slate-800 hover:border-pink-500/30 text-xs font-bold rounded-xl text-slate-300 hover:text-pink-300 transition-all cursor-pointer"
              >
                Admin
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col overflow-hidden">
      {/* Background patterns and glow */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-35" />
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-[500px] h-[500px] bg-fuchsia-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="relative bg-slate-900/40 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-40 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-tr from-violet-600 to-fuchsia-600 rounded-xl shadow-lg shadow-violet-500/20">
            <Ticket className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-black bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-500 bg-clip-text text-transparent tracking-tight">
            TicketBooking
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5 bg-slate-900/60 border border-slate-800/80 px-3.5 py-1.5 rounded-full text-xs shadow-inner">
            <User size={13} className="text-fuchsia-400" />
            <span className="font-semibold text-slate-200">{currentUser.name}</span>
            <span className="bg-violet-500/10 border border-violet-500/20 text-violet-400 px-2.5 py-0.5 rounded-full uppercase text-[9px] font-extrabold tracking-wider">
              {currentUser.role}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-slate-400 hover:text-rose-400 text-xs font-bold transition-all duration-200 cursor-pointer"
          >
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="relative flex-1 max-w-7xl w-full mx-auto p-6 space-y-8 z-10">
        {/* Organizer / Admin View */}
        {(currentUser.role === 'admin' || currentUser.role === 'organizer') && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-fuchsia-500/10 rounded-lg border border-fuchsia-500/20">
                <LayoutDashboard className="text-fuchsia-400 w-5 h-5" />
              </div>
              <h2 className="text-xl font-extrabold text-white tracking-tight">Management Console</h2>
            </div>
            <AdminPanel onShowCreated={fetchShows} />
          </div>
        )}

        {/* Customer / Main View */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Show List */}
          <div className="space-y-4 lg:col-span-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-violet-500/10 rounded-lg border border-violet-500/20">
                <Compass className="text-violet-400 w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-200 uppercase tracking-wider">Active Shows</h3>
            </div>

            <div className="space-y-3">
              {shows.map((show) => (
                <button
                  key={show._id}
                  onClick={() => {
                    setSelectedShow(show);
                    setSelectedSeats([]);
                    setHoldExpiresAt(null);
                  }}
                  className={`w-full text-left p-5 rounded-2xl border transition-all duration-300 transform hover:translate-y-[-2px] cursor-pointer ${
                    selectedShow?._id === show._id
                      ? 'bg-gradient-to-br from-violet-600/10 to-fuchsia-600/5 border-violet-500/80 shadow-[0_4px_20px_rgba(139,92,246,0.15)]'
                      : 'bg-slate-900/40 backdrop-blur-sm border-slate-800/80 hover:border-slate-700/60 hover:bg-slate-900/60'
                  }`}
                >
                  <h4 className="font-extrabold text-white text-base leading-snug">{show.title}</h4>
                  <p className="text-slate-400 text-xs mt-1.5 truncate leading-relaxed">{show.description}</p>
                  <div className="flex items-center gap-1.5 text-slate-500 text-xs mt-4 pt-3 border-t border-slate-800/60">
                    <Calendar size={12} className="text-violet-400" />
                    <span className="font-medium">{new Date(show.showTime).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Seat map / Detail view */}
          <div className="lg:col-span-2 space-y-6">
            {selectedShow ? (
              <div className="space-y-6">
                <div className="bg-slate-900/40 backdrop-blur-sm border border-slate-800/80 rounded-3xl p-6 space-y-6">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h3 className="text-2xl font-black text-white tracking-tight">{selectedShow.title}</h3>
                      <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold mt-1">{selectedShow.venue}</p>
                    </div>

                    <button
                      onClick={() => setIsWaitlistOpen(true)}
                      className="px-4 py-2 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600 text-xs font-bold rounded-xl text-slate-300 transition-all cursor-pointer shadow-sm active:scale-95"
                    >
                      Join Waitlist
                    </button>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 p-4 bg-rose-500/10 text-rose-300 border border-rose-500/20 rounded-2xl text-sm animate-shake">
                      <AlertCircle size={16} className="shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Seat Map component */}
                  <SeatMap
                    showId={selectedShow._id}
                    seats={seats}
                    setSeats={setSeats}
                    selectedSeats={selectedSeats}
                    setSelectedSeats={setSelectedSeats}
                    userId={currentUser._id}
                  />

                  {/* Hold control / Expiration timer */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-800/60 pt-5">
                    <div>
                      {selectedSeats.length > 0 ? (
                        <p className="text-sm font-bold text-slate-300">
                          Selected Seats: <span className="text-violet-400 px-2 py-0.5 bg-violet-400/10 rounded-md border border-violet-400/20 ml-1">{selectedSeats.length}</span>
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500">Select available seats from the map to reserve holds.</p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {timeLeft > 0 && (
                        <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl text-xs text-amber-400 font-extrabold animate-pulse">
                          <Clock size={14} />
                          <span>Hold Expires: {formatTime(timeLeft)}</span>
                        </div>
                      )}

                      {holdExpiresAt ? (
                        <button
                          onClick={handleConfirmCheckout}
                          className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/20 hover:shadow-emerald-500/30 transition-all text-sm cursor-pointer active:scale-95"
                        >
                          Confirm & Book
                        </button>
                      ) : (
                        <button
                          onClick={handleHoldSeats}
                          disabled={selectedSeats.length === 0}
                          className="px-6 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all text-sm flex items-center gap-2 cursor-pointer shadow-lg shadow-violet-600/20 hover:shadow-violet-600/30 active:scale-95"
                        >
                          <Lock size={14} />
                          <span>Hold Seats (5m)</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tickets Box - Ticket Stub design */}
                {currentUser.role === 'customer' && bookings.length > 0 && (
                  <div className="bg-slate-900/40 backdrop-blur-sm border border-slate-800/80 rounded-3xl p-6 space-y-5">
                    <h3 className="text-lg font-bold text-white border-b border-slate-800/60 pb-3.5 flex items-center gap-2">
                      <Ticket size={18} className="text-emerald-400" />
                      <span>Your Booked Tickets</span>
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {bookings.map((booking) => (
                        <div key={booking._id} className="relative bg-slate-950/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-row">
                          {/* Left ticket stub side */}
                          <div className="flex-1 p-5 space-y-2.5">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Booking Ref</span>
                              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">{booking.status}</span>
                            </div>
                            <h4 className="font-extrabold text-white text-base tracking-wider font-mono">#{booking._id.slice(-6).toUpperCase()}</h4>
                            <div className="flex justify-between items-baseline pt-2">
                              <span className="text-xs text-slate-400">Total Charged</span>
                              <span className="text-sm font-black text-white">${booking.totalPrice}</span>
                            </div>
                          </div>

                          {/* Ticket Stub Divider */}
                          <div className="relative flex flex-col justify-between py-1 bg-slate-950/60">
                            <div className="w-4 h-4 bg-slate-900 border-b border-r border-slate-800 rounded-full -mt-2 -ml-2 shrink-0" />
                            <div className="border-l border-dashed border-slate-800 h-full w-[1px] shrink-0" />
                            <div className="w-4 h-4 bg-slate-900 border-t border-r border-slate-800 rounded-full -mb-2 -ml-2 shrink-0" />
                          </div>

                          {/* Right ticket QR stub side */}
                          <div className="p-4 bg-slate-950/30 flex items-center justify-center border-l border-slate-900 shrink-0">
                            {booking.qrCodeUrl ? (
                              <img
                                src={booking.qrCodeUrl}
                                alt="Booking Ticket QR"
                                className="w-18 h-18 bg-white p-1.5 rounded-xl border border-slate-800 shadow-md transition-transform hover:scale-105"
                              />
                            ) : (
                              <div className="w-18 h-18 bg-slate-900 rounded-xl flex items-center justify-center">
                                <Ticket className="text-slate-700 w-8 h-8" />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full min-h-[400px] bg-slate-900/40 border border-slate-800/80 rounded-3xl flex flex-col overflow-hidden shadow-xl animate-fade-in duration-500">
                <div className="relative flex-1 min-h-[280px] overflow-hidden">
                  <img
                    src="/ad.png"
                    alt="Live Concert Tickets Booking Advertisement"
                    className="w-full h-full object-cover object-center opacity-85 transition-transform duration-700 hover:scale-102"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                  <div className="absolute bottom-6 left-6 right-6 text-left space-y-2">
                    <span className="px-3 py-1 bg-violet-600/25 border border-violet-500/30 text-violet-300 rounded-full text-[10px] font-black uppercase tracking-widest">
                      Featured Events
                    </span>
                    <h3 className="text-2xl font-black text-white leading-tight">
                      Experience the Magic of Live Music
                    </h3>
                  </div>
                </div>
                <div className="p-6 bg-slate-950/60 border-t border-slate-800/60 flex flex-col items-center justify-center text-center space-y-2">
                  <h4 className="text-sm font-bold text-slate-400">No Show Selected</h4>
                  <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                    Please select an active show from the sidebar to inspect the real-time seat map, reserve holds, and book your tickets.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <WaitlistModal
        show={selectedShow}
        isOpen={isWaitlistOpen}
        onClose={() => setIsWaitlistOpen(false)}
        onJoinWaitlist={handleJoinWaitlist}
      />
    </div>
  );
}
