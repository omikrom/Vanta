import "server-only";

type RoomListener = () => void;

const globalHub = globalThis as unknown as {
  vantaWatchRoomListeners?: Map<string, Set<RoomListener>>;
};

const listeners = globalHub.vantaWatchRoomListeners ?? new Map<string, Set<RoomListener>>();
globalHub.vantaWatchRoomListeners = listeners;

export function subscribeWatchRoom(roomId: string, listener: RoomListener) {
  const roomListeners = listeners.get(roomId) ?? new Set<RoomListener>();
  roomListeners.add(listener);
  listeners.set(roomId, roomListeners);
  return () => {
    roomListeners.delete(listener);
    if (!roomListeners.size) listeners.delete(roomId);
  };
}

export function notifyWatchRoom(roomId: string) {
  for (const listener of listeners.get(roomId) ?? []) listener();
}
