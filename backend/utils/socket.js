import { Server } from 'socket.io';

let io;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

// Broadcast seat status change helper
export const broadcastSeatUpdate = (event, data) => {
  // event can be 'SEAT_HELD', 'SEAT_RELEASED', 'SEAT_BOOKED'
  // data: { showId, seatIds, userId }
  if (io) {
    io.emit(event, data);
    console.log(`Broadcast event: ${event}`, data);
  }
};
