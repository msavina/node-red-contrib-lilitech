'use strict';

const http = require('http');
const { Server } = require('socket.io');
const { io } = require('socket.io-client');

/*----------------------------------------------------------------------------------------------------------------------
    Tubo finto: come il gateway di core-tube, ritrasmette ogni messaggio a tutti gli altri client
----------------------------------------------------------------------------------------------------------------------*/
async function startFakeTube() {
    const httpServer = http.createServer();
    const server = new Server(httpServer);
    server.on('connection', (socket) => {
        socket.onAny((eventName, message) => socket.broadcast.emit(eventName, message));
    });
    await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${httpServer.address().port}`;

    return {
        url,
        close: () =>
            new Promise((resolve) => {
                server.close();
                httpServer.close(() => resolve());
            })
    };
}

/*----------------------------------------------------------------------------------------------------------------------
    core-devices finto: risponde all'elenco delle lights e registra i comandi ricevuti
----------------------------------------------------------------------------------------------------------------------*/
async function startFakeDevices(url, lights) {
    const socket = io(url, { transports: ['websocket'] });
    const received = [];
    const emit = (eventName, payload) => socket.emit(eventName, { origin: 'UNIT', className: 'LightsService', eventName, payload });

    socket.on('DATABASE_LIST_REQUEST_DEVICES', (message) => {
        if (message.payload.familyId !== 'lights') return;
        emit('DATABASE_LIST_RESPONSE_DEVICES', { unitId: 'unit-1', familyId: 'lights', requestId: message.payload.requestId, devices: lights });
    });
    socket.on('DATABASE_UPDATE_DEVICES', (message) => received.push(message));
    await new Promise((resolve) => socket.on('connect', resolve));

    return {
        received,
        emitUpdate: (payload) => emit('DATABASE_UPDATE_DEVICES', { unitId: 'unit-1', familyId: 'lights', ...payload }),
        close: () => socket.disconnect()
    };
}

module.exports = { startFakeTube, startFakeDevices };
