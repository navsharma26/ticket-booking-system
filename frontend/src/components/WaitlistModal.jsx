import React, { useState } from 'react';

export default function WaitlistModal({ show, isOpen, onClose, onJoinWaitlist }) {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCategory) return;
    setLoading(true);
    await onJoinWaitlist(show._id, selectedCategory);
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-800 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-6 transform transition-all duration-300 animate-in fade-in zoom-in-95">
        <div className="flex justify-between items-center pb-4 border-b border-slate-700">
          <h3 className="text-xl font-bold text-white">Join the Waitlist</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-300">
              Select Seat Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">-- Choose Category --</option>
              {show.seatCategories.map((cat) => (
                <option key={cat.name} value={cat.name}>
                  {cat.name} (${cat.price})
                </option>
              ))}
            </select>
          </div>

          <div className="text-sm text-slate-400">
            If tickets become available due to holds releasing or order cancellations, seats will be offered in a first-in, first-out (FIFO) order with a 5-minute checkout window.
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedCategory}
              className="px-5 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-lg font-semibold shadow-lg shadow-violet-600/30 transition-all disabled:opacity-50"
            >
              {loading ? 'Joining...' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
