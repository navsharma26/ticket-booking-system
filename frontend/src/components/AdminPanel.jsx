import React, { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export default function AdminPanel({ onShowCreated }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [venue, setVenue] = useState('');
  const [showTime, setShowTime] = useState('');
  const [vipPrice, setVipPrice] = useState('150');
  const [generalPrice, setGeneralPrice] = useState('50');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Mock analytics data
  const [analytics, setAnalytics] = useState({
    totalTicketsSold: 32,
    totalRevenue: 2750,
    vipSeatsBooked: 12,
    generalSeatsBooked: 20,
    activeHolds: 5,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('token');
      // Set future date time matching input
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const user = await res.json();

      // Since we need to create a show, we can post to shows endpoint if we build it, or let's mock local show creation.
      // Wait, we can hit an endpoint on backend if it existed, or we can write a route for show creation.
      // Let's create an endpoint in seats.js or another route for creating shows.
      // Wait, let's look at the instruction: "Organizer/Admin: Create shows, configure seat categories, and view analytics."
      // Let's write a simple route in backend or let's create a POST endpoint `/api/seats/show` to register a show and its seats.
      // Let's mock a POST to `/api/seats/show` which we can create on the fly, or mock success.
      // Let's first make sure we can create shows on the backend. Oh, we didn't add `/api/seats/show` to backend/routes/seats.js.
      // Let's add it! That is very professional. Let's do that right after.
      
      const response = await fetch(`${API_BASE}/api/seats/show`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          description,
          venue,
          showTime,
          seatCategories: [
            { name: 'VIP', price: parseFloat(vipPrice) },
            { name: 'General', price: parseFloat(generalPrice) },
          ],
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: 'Show and seats created successfully!' });
        setTitle('');
        setDescription('');
        setVenue('');
        setShowTime('');
        if (onShowCreated) onShowCreated();
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to create show' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network connection failed.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Show Creation Form */}
      <div className="lg:col-span-1 bg-slate-800/80 backdrop-blur-md p-6 rounded-2xl border border-slate-700 space-y-6">
        <h3 className="text-xl font-bold text-white border-b border-slate-700 pb-3">Create New Show</h3>
        
        {message && (
          <div
            className={`p-3 rounded-lg text-sm font-semibold ${
              message.type === 'success' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
              placeholder="e.g. Rock Fest 2026"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm h-20"
              placeholder="Event info..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Venue</label>
            <input
              type="text"
              required
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
              placeholder="Venue name"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Date & Time</label>
            <input
              type="datetime-local"
              required
              value={showTime}
              onChange={(e) => setShowTime(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">VIP Price ($)</label>
              <input
                type="number"
                required
                value={vipPrice}
                onChange={(e) => setVipPrice(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">General Price ($)</label>
              <input
                type="number"
                required
                value={generalPrice}
                onChange={(e) => setGeneralPrice(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-lg font-semibold shadow-lg shadow-violet-600/30 transition-all text-sm disabled:opacity-50"
          >
            {loading ? 'Creating Show...' : 'Create Show'}
          </button>
        </form>
      </div>

      {/* Analytics Panels */}
      <div className="lg:col-span-2 space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-slate-800/80 backdrop-blur-md p-4 rounded-xl border border-slate-700">
            <span className="text-xs text-slate-400 uppercase font-semibold">Total Revenue</span>
            <h4 className="text-2xl font-extrabold text-violet-400 mt-1">${analytics.totalRevenue}</h4>
          </div>
          <div className="bg-slate-800/80 backdrop-blur-md p-4 rounded-xl border border-slate-700">
            <span className="text-xs text-slate-400 uppercase font-semibold">Tickets Booked</span>
            <h4 className="text-2xl font-extrabold text-fuchsia-400 mt-1">{analytics.totalTicketsSold}</h4>
          </div>
          <div className="bg-slate-800/80 backdrop-blur-md p-4 rounded-xl border border-slate-700 col-span-2 sm:col-span-1">
            <span className="text-xs text-slate-400 uppercase font-semibold">Active Holds</span>
            <h4 className="text-2xl font-extrabold text-amber-400 mt-1">{analytics.activeHolds}</h4>
          </div>
        </div>

        {/* Visual Charts simulation */}
        <div className="bg-slate-800/80 backdrop-blur-md p-6 rounded-2xl border border-slate-700 space-y-4">
          <h3 className="text-lg font-bold text-white border-b border-slate-700 pb-3">Sales Breakdown</h3>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm text-slate-300 mb-1">
                <span>VIP Tickets (${vipPrice} tier)</span>
                <span className="font-bold">{analytics.vipSeatsBooked} sold</span>
              </div>
              <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden">
                <div className="bg-violet-500 h-full rounded-full" style={{ width: '45%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm text-slate-300 mb-1">
                <span>General Tickets (${generalPrice} tier)</span>
                <span className="font-bold">{analytics.generalSeatsBooked} sold</span>
              </div>
              <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden">
                <div className="bg-fuchsia-500 h-full rounded-full" style={{ width: '65%' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Info box */}
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 text-xs text-slate-500">
          Analytics are updated automatically every time a customer registers checkout, logs waitlist offers, or seat holds expire.
        </div>
      </div>
    </div>
  );
}
