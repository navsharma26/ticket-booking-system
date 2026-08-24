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
      return 'bg-rose-600 border-rose-800 text-rose-100 cursor-not-allowed';
    }
    if (isMyHold || isSelected) {
      return 'bg-amber-500 border-amber-700 text-amber-950 hover:bg-amber-400 font-bold';
    }
    if (seat.status === 'held') {
      return 'bg-rose-900 border-rose-950 text-rose-400 cursor-not-allowed opacity-50';
    }
    // Available
    return 'bg-emerald-500 border-emerald-700 text-emerald-950 hover:bg-emerald-400';
  };

  return (
    <div className="bg-slate-800/80 backdrop-blur-md p-6 rounded-2xl border border-slate-700 space-y-6">
      <div className="text-center">
        <div className="w-full bg-slate-900 h-2 rounded-full mb-2 border border-slate-800" />
        <span className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Stage</span>
      </div>

      <div className="flex flex-col gap-3 justify-center items-center overflow-x-auto pb-4">
        {Object.entries(rows).map(([rowLabel, rowSeats]) => (
          <div key={rowLabel} className="flex gap-2 items-center">
            <span className="text-sm font-bold text-slate-500 w-6 text-center">{rowLabel}</span>
            <div className="flex gap-2">
              {rowSeats.map((seat) => (
                <button
                  key={seat._id}
                  onClick={() => handleSeatClick(seat)}
                  disabled={seat.status === 'booked' || (seat.status === 'held' && seat.heldBy !== userId)}
                  className={`w-10 h-10 rounded-lg border flex items-center justify-center text-xs font-semibold transition-all duration-300 transform active:scale-95 shadow-lg ${getSeatColorClass(
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
      <div className="flex justify-center gap-6 text-sm border-t border-slate-700 pt-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-emerald-500 border border-emerald-700 rounded-sm" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-amber-500 border border-amber-700 rounded-sm" />
          <span>Selected / Your Hold</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-rose-900 border border-rose-950 rounded-sm opacity-50" />
          <span>Held by others</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-rose-600 border border-rose-800 rounded-sm" />
          <span>Booked</span>
        </div>
      </div>
    </div>
  );
}
