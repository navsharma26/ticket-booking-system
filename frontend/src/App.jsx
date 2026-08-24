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
      const response = await fetch('http://localhost:5001/api/auth/login', {
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
      const response = await fetch('http://localhost:5001/api/auth/login', {
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
      fetch('http://localhost:5001/api/auth/me', {
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
    fetch('http://localhost:5001/api/seats/shows')
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
      fetch(`http://localhost:5001/api/seats/show/${selectedShow._id}`)
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
    fetch('http://localhost:5001/api/bookings/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setBookings(data))
      .catch((err) => console.error(err));
  };

  const fetchWaitlists = () => {
    fetch('http://localhost:5001/api/waitlist/me', {
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
      const response = await fetch('http://localhost:5001/api/seats/hold', {
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
      const response = await fetch('http://localhost:5001/api/bookings/confirm', {
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
        fetch(`http://localhost:5001/api/seats/show/${selectedShow._id}`)
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
      const response = await fetch('http://localhost:5001/api/waitlist/join', {
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
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-violet-400 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent">
              Ticket Booking System
            </h1>
            <p className="text-sm text-slate-400">
              Sign in to secure real-time seat reservations.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-sm">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase">Email</label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full bg-slate-955 border border-slate-750 bg-slate-950/60 rounded-xl p-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase">Password</label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full bg-slate-955 border border-slate-750 bg-slate-955/60 bg-slate-950/60 rounded-xl p-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-xl font-bold shadow-lg shadow-violet-600/30 transition-all text-sm disabled:opacity-50"
            >
              {loading ? 'Logging in...' : 'Sign In'}
            </button>
          </form>

          {/* Quick roles switcher */}
          <div className="border-t border-slate-800 pt-6 space-y-3">
            <span className="text-xs font-semibold text-slate-500 uppercase block text-center">
              Quick Role Login (Simulated)
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleQuickLogin('customer@example.com')}
                className="py-2 bg-slate-800 hover:bg-slate-755 border border-slate-700 hover:border-slate-600 text-xs font-semibold rounded-lg text-slate-300 transition-colors"
              >
                Customer
              </button>
              <button
                onClick={() => handleQuickLogin('organizer@example.com')}
                className="py-2 bg-slate-800 hover:bg-slate-755 border border-slate-700 hover:border-slate-600 text-xs font-semibold rounded-lg text-slate-300 transition-colors"
              >
                Organizer
              </button>
              <button
                onClick={() => handleQuickLogin('admin@example.com')}
                className="py-2 bg-slate-800 hover:bg-slate-755 border border-slate-700 hover:border-slate-600 text-xs font-semibold rounded-lg text-slate-300 transition-colors"
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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Ticket className="text-violet-500" size={28} />
          <h1 className="text-xl font-extrabold bg-gradient-to-r from-violet-400 to-fuchsia-500 bg-clip-text text-transparent">
            TicketBooking
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-full text-xs">
            <User size={14} className="text-fuchsia-400" />
            <span className="font-semibold text-slate-200">{currentUser.name}</span>
            <span className="bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded-full uppercase text-[10px] font-bold">
              {currentUser.role}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-slate-400 hover:text-white text-xs font-semibold transition-colors"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-8">
        {/* Organizer / Admin View */}
        {(currentUser.role === 'admin' || currentUser.role === 'organizer') && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="text-fuchsia-400" size={24} />
              <h2 className="text-2xl font-bold text-white">Management Console</h2>
            </div>
            <AdminPanel onShowCreated={fetchShows} />
          </div>
        )}

        {/* Customer / Main View */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Show List */}
          <div className="space-y-4 lg:col-span-1">
            <div className="flex items-center gap-2">
              <Compass className="text-violet-400" size={20} />
              <h3 className="text-lg font-bold text-white">Active Shows</h3>
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
                  className={`w-full text-left p-4 rounded-xl border transition-all duration-300 transform hover:translate-y-[-2px] ${
                    selectedShow?._id === show._id
                      ? 'bg-violet-600/10 border-violet-500 shadow-lg shadow-violet-600/10'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <h4 className="font-bold text-white text-base">{show.title}</h4>
                  <p className="text-slate-400 text-xs mt-1 truncate">{show.description}</p>
                  <div className="flex items-center gap-1 text-slate-500 text-xs mt-3">
                    <Calendar size={12} />
                    <span>{new Date(show.showTime).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Seat map / Detail view */}
          <div className="lg:col-span-2 space-y-6">
            {selectedShow ? (
              <div className="space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-2xl font-extrabold text-white">{selectedShow.title}</h3>
                      <p className="text-slate-400 text-sm mt-1">{selectedShow.venue}</p>
                    </div>

                    <button
                      onClick={() => setIsWaitlistOpen(true)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-600 text-xs font-semibold rounded-lg text-slate-300 transition-colors"
                    >
                      Join Waitlist
                    </button>
                  </div>

                  {error && (
                    <div className="p-3 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-sm">
                      {error}
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
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-850 pt-4">
                    <div>
                      {selectedSeats.length > 0 ? (
                        <p className="text-sm font-semibold text-slate-300">
                          Selected Seats: <span className="text-violet-400">{selectedSeats.length}</span>
                        </p>
                      ) : (
                        <p className="text-sm text-slate-500">Select seats to begin hold session.</p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {timeLeft > 0 && (
                        <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg text-xs text-amber-400 font-semibold animate-pulse">
                          <Clock size={14} />
                          <span>Hold Expires: {formatTime(timeLeft)}</span>
                        </div>
                      )}

                      {holdExpiresAt ? (
                        <button
                          onClick={handleConfirmCheckout}
                          className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg font-bold shadow-lg shadow-emerald-600/30 transition-all text-sm"
                        >
                          Confirm & Book
                        </button>
                      ) : (
                        <button
                          onClick={handleHoldSeats}
                          disabled={selectedSeats.length === 0}
                          className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg font-semibold transition-colors text-sm flex items-center gap-2"
                        >
                          <Lock size={14} />
                          <span>Hold Seats (5m)</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tickets Box */}
                {currentUser.role === 'customer' && bookings.length > 0 && (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                    <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
                      <Ticket size={18} className="text-emerald-400" />
                      <span>Your Booked Tickets</span>
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {bookings.map((booking) => (
                        <div key={booking._id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex gap-4">
                          <div className="flex-1 space-y-2">
                            <h4 className="font-bold text-white text-sm">Booking Ref: {booking._id.slice(-6)}</h4>
                            <p className="text-xs text-slate-400">Total Price: ${booking.totalPrice}</p>
                            <p className="text-[10px] text-slate-500">Status: <span className="text-emerald-400 font-bold uppercase">{booking.status}</span></p>
                          </div>
                          {booking.qrCodeUrl && (
                            <img
                              src={booking.qrCodeUrl}
                              alt="Booking Ticket QR"
                              className="w-16 h-16 bg-white p-1 rounded border border-slate-600"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full bg-slate-900 border border-slate-800 border-dashed rounded-2xl flex flex-col items-center justify-center p-8 text-center text-slate-500">
                <Ticket className="w-12 h-12 mb-3 text-slate-700" />
                <h3 className="text-lg font-bold text-slate-400">No Show Selected</h3>
                <p className="text-sm max-w-xs mt-1">Please select an active show from the sidebar to inspect the real-time seat map.</p>
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
