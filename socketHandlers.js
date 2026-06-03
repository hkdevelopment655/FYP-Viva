export const setupSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('join-group', (groupId) => {
      socket.join(`group-${groupId}`);
      console.log(`Socket ${socket.id} joined group-${groupId}`);
    });

    socket.on('leave-group', (groupId) => {
      socket.leave(`group-${groupId}`);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
};
