import React, { useEffect } from 'react';
import { io } from 'socket.io-client';

export default function SeatMap({
  showId,
  seats,
  setSeats,
  selectedSeats,
  setSelectedSeats,
  userId,
}) {
  useEffect(() => {
    // Connect to Backend Socket.io Server
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5001');

    console.log('[Socket] Connected to Socket.io server.');

    // Listen for seat updates
    socket.on('SEAT_HELD', (data) => {
      if (data.showId === showId) {
        setSeats((prevSeats) =>
          prevSeats.map((seat) => {
            if (data.seatIds.includes(seat._id)) {
              return {
                ...seat,
                status: 'held',
                heldBy: data.userId,
                holdExpiresAt: data.holdExpiresAt,
              };
            }
            return seat;
          })
        );
      }
    });

    socket.on('SEAT_RELEASED', (data) => {
      if (data.showId === showId) {
        setSeats((prevSeats) =>
          prevSeats.map((seat) => {
            if (data.seatIds.includes(seat._id)) {
              return {
                ...seat,
                status: 'available',
                heldBy: null,
                holdExpiresAt: null,
              };
            }
            return seat;
          })
        );
        // Deselect if we held it and it was released due to timeout
        setSelectedSeats((prevSelected) =>
          prevSelected.filter((id) => !data.seatIds.includes(id))
        );
      }
    });

    socket.on('SEAT_BOOKED', (data) => {
      if (data.showId === showId) {
        setSeats((prevSeats) =>
          prevSeats.map((seat) => {
            if (data.seatIds.includes(seat._id)) {
              return {
                ...seat,
                status: 'booked',
                heldBy: null,
                holdExpiresAt: null,
              };
            }
            return seat;
          })
        );
        setSelectedSeats((prevSelected) =>
          prevSelected.filter((id) => !data.seatIds.includes(id))
        );
      }
    });

    return () => {
      socket.disconnect();
      console.log('[Socket] Disconnected from Socket.io server.');
    };
  }, [showId, setSeats, setSelectedSeats]);

  const handleSeatClick = (seat) => {
    if (seat.status === 'booked') return;
    if (seat.status === 'held' && seat.heldBy !== userId) return;

    if (selectedSeats.includes(seat._id)) {
      setSelectedSeats(selectedSeats.filter((id) => id !== seat._id));
    } else {
      setSelectedSeats([...selectedSeats, seat._id]);
    }
  };

  // Group seats by rows (first letter of seatNumber)
  const rows = seats.reduce((acc, seat) => {
    const row = seat.seatNumber.charAt(0);
    if (!acc[row]) acc[row] = [];
    acc[row].push(seat);
    return acc;
  }, {});

  // Sort seats in each row numerically
  Object.keys(rows).forEach((row) => {
    rows[row].sort((a, b) => {
      const numA = parseInt(a.seatNumber.slice(1));
      const numB = parseInt(b.seatNumber.slice(1));
      return numA - numB;
    });
  });

  const getSeatColorClass = (seat) => {
    const isSelected = selectedSeats.includes(seat._id);
    const isMyHold = seat.status === 'held' && seat.heldBy === userId;

    if (seat.status === 'booked') {
      return 'bg-slate-900 border-slate-800/80 text-slate-600 cursor-not-allowed opacity-30 line-through';
    }
    if (isMyHold || isSelected) {
      return 'bg-gradient-to-tr from-amber-400 via-amber-500 to-orange-400 border-amber-600 text-slate-950 font-extrabold shadow-[0_0_15px_rgba(245,158,11,0.45)] scale-105';
    }
    if (seat.status === 'held') {
      return 'bg-rose-950/20 border-rose-900/30 text-rose-800/40 cursor-not-allowed opacity-30';
    }
    // Available - differentiate VIP and General
    if (seat.category === 'VIP') {
      return 'bg-gradient-to-tr from-violet-600/90 to-indigo-500/90 border-violet-500/60 text-white hover:from-violet-500 hover:to-indigo-400 hover:shadow-[0_0_12px_rgba(139,92,246,0.4)] hover:scale-105';
    }
    return 'bg-gradient-to-tr from-slate-800 to-slate-700 border-slate-700/80 text-slate-300 hover:from-slate-700 hover:to-slate-650 hover:text-white hover:shadow-[0_0_10px_rgba(255,255,255,0.05)] hover:scale-105';
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl p-8 rounded-2xl border border-slate-800/80 space-y-8 shadow-inner">
      <div className="relative text-center pb-6">
        <div className="w-2/3 mx-auto bg-gradient-to-r from-transparent via-violet-500 to-transparent h-[3px] rounded-full opacity-80 shadow-[0_0_15px_rgba(139,92,246,0.8)]" />
        <span className="text-[10px] text-violet-400 uppercase tracking-widest font-extrabold block mt-2.5">Stage / Screen</span>
      </div>

      <div className="flex flex-col gap-3.5 justify-center items-center overflow-x-auto pb-4 px-2">
        {Object.entries(rows).map(([rowLabel, rowSeats]) => (
          <div key={rowLabel} className="flex gap-3.5 items-center">
            <span className="text-xs font-black text-slate-600 w-5 text-center">{rowLabel}</span>
            <div className="flex gap-2.5">
              {rowSeats.map((seat) => (
                <button
                  key={seat._id}
                  onClick={() => handleSeatClick(seat)}
                  disabled={seat.status === 'booked' || (seat.status === 'held' && seat.heldBy !== userId)}
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center text-xs font-bold transition-all duration-300 transform active:scale-90 cursor-pointer shadow-md ${getSeatColorClass(
                    seat
                  )}`}
                  title={`Seat ${seat.seatNumber} (${seat.category} - $${
                    seat.category === 'VIP' ? 150 : 50
                  })`}
                >
                  {seat.seatNumber}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-6 text-xs border-t border-slate-800/60 pt-5 flex-wrap font-semibold text-slate-400">
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 bg-gradient-to-tr from-violet-600 to-indigo-500 border border-violet-500/60 rounded-md" />
          <span>VIP Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 bg-gradient-to-tr from-slate-800 to-slate-700 border border-slate-700/80 rounded-md" />
          <span>General Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 bg-gradient-to-tr from-amber-400 to-orange-400 border border-amber-600 rounded-md shadow-[0_0_8px_rgba(245,158,11,0.3)]" />
          <span>Selected / Yours</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 bg-rose-950/20 border border-rose-900/30 rounded-md opacity-50" />
          <span>Held (Others)</span>
        </div>
        <div className="flex items-center gap-2 text-slate-500">
          <div className="w-3.5 h-3.5 bg-slate-900 border border-slate-800/80 rounded-md line-through" />
          <span>Booked</span>
        </div>
      </div>
    </div>
  );
}
