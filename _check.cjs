const fs = require('fs');
const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } };
const c = (s, sub) => s.split(sub).length - 1;
const out = [];

const client = read('src/net/client.ts');
const store = read('src/store/useGameStore.ts');
const home = read('src/pages/Home.tsx');
const server = read('server/gameServer.ts');
const proto = read('src/net/protocol.ts');

out.push('== protocol ==');
out.push('RoomSummary_iface=' + c(proto, 'export interface RoomSummary'));
out.push('client_rooms_req=' + c(proto, "t: 'rooms' }"));
out.push('server_rooms_msg=' + c(proto, "t: 'rooms'; rooms: RoomSummary[]"));

out.push('== client ==');
out.push('lines=' + client.split(/\r?\n/).length);
out.push('RoomSummary_import=' + c(client, 'RoomSummary'));
out.push('onRooms_handler=' + c(client, 'onRooms: (rooms'));
out.push('onMessage_rooms=' + c(client, 'this.handlers?.onRooms'));
out.push('refreshRooms=' + c(client, 'refreshRooms'));
out.push('export_net=' + c(client, 'export const net'));

out.push('== store ==');
out.push('lines=' + store.split(/\r?\n/).length);
out.push('RoomSummary_import=' + c(store, 'RoomSummary'));
out.push('rooms_field=' + c(store, 'rooms: RoomSummary[]'));
out.push('rooms_init=' + c(store, 'rooms: [],'));
out.push('onRooms_sub=' + c(store, 'onRooms: (rooms) => set({ rooms })'));
out.push('refreshRooms=' + c(store, 'refreshRooms'));

out.push('== home ==');
out.push('lines=' + home.split(/\r?\n/).length);
out.push('rooms_from_store=' + c(home, 'rooms,'));
out.push('enterRoom=' + c(home, 'enterRoom'));
out.push('rooms_map=' + c(home, 'rooms.map'));
out.push('refreshRooms_use=' + c(home, 'refreshRooms'));

out.push('== server ==');
out.push('broadcastLobby_calls=' + c(server, 'this.broadcastLobby()'));
out.push('onClose_def=' + c(server, 'private onClose'));
out.push('roomSummaries_def=' + c(server, 'private roomSummaries'));
out.push('broadcastLobby_def=' + c(server, 'private broadcastLobby'));

fs.writeFileSync('_check.out', out.join('\n') + '\n');
console.log('ok');
