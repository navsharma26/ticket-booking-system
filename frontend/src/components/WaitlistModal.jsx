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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
      <div className="bg-slate-900 border border-slate-800/80 w-full max-w-md rounded-3xl p-6 shadow-[0_25px_60px_rgba(0,0,0,0.7)] space-y-6 transform transition-all duration-300 animate-in fade-in zoom-in-95">
        <div className="flex justify-between items-center pb-4 border-b border-slate-800/60">
          <h3 className="text-xl font-extrabold text-white tracking-tight">Join the Waitlist</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer w-7 h-7 rounded-full bg-slate-800/40 hover:bg-slate-800 flex items-center justify-center text-sm"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
              Select Seat Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              required
              className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-3.5 text-slate-200 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 text-sm cursor-pointer"
            >
              <option value="" className="bg-slate-900 text-slate-400">-- Choose Category --</option>
              {show.seatCategories.map((cat) => (
                <option key={cat.name} value={cat.name} className="bg-slate-900 text-slate-200">
                  {cat.name} (${cat.price})
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs text-slate-400 leading-relaxed bg-slate-950/30 border border-slate-800/60 p-3.5 rounded-xl">
            If tickets become available due to holds releasing or order cancellations, seats will be offered in a first-in, first-out (FIFO) order with a 5-minute checkout window.
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800/60">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-800/60 hover:bg-slate-800 text-slate-300 rounded-xl font-bold transition-all text-xs cursor-pointer active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedCategory}
              className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-xl font-bold shadow-lg shadow-violet-600/20 hover:shadow-violet-600/30 transition-all text-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95"
            >
              {loading ? 'Joining...' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
