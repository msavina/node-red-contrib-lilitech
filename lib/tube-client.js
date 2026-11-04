'use strict';

const { EventEmitter } = require('events');
const { randomUUID } = require('crypto');
const { io } = require('socket.io-client');

// Eventi del tubo della headunit (MessageDatabaseDevices in core-devices)
const EVENTS = {
    update: 'DATABASE_UPDATE_DEVICES',
    insert: 'DATABASE_INSERT_DEVICES',
    delete: 'DATABASE_DELETE_DEVICES',
    listRequest: 'DATABASE_LIST_REQUEST_DEVICES',
    listResponse: 'DATABASE_LIST_RESPONSE_DEVICES',
    // Eventi dello storico (MessageDatabaseHistory in libs/interfaces): es. accesso consentito/negato con l'utente
    history: 'DATABASE_HISTORY_UNIT_EVENT'
};

// Campi del payload che non sono items del device
const META_KEYS = ['unitId', 'unitName', 'deviceId', 'familyId', 'roomId', 'authorId', 'authorName', 'timestamp', 'clientId'];

const CLASS_NAME = 'NodeRed';
const AUTHOR_NAME = 'Node-RED';

class TubeClient extends EventEmitter {
    /*------------------------------------------------------------------------------------------------------------------
    ------------------------------------------------------------------------------------------------------------------*/
    constructor(url, options = {}) {
        super();
        this.setMaxListeners(0);
        this.url = url;
        this.options = options;
        this.socket = null;
        // Device conosciuti con l'ultimo stato degli items, per chiave "familyId/deviceId"
        this.devices = new Map();
        this.pendingLists = new Map();
    }

    /*------------------------------------------------------------------------------------------------------------------
    ------------------------------------------------------------------------------------------------------------------*/
    get connected() {
        return !!this.socket?.connected;
    }

    /*------------------------------------------------------------------------------------------------------------------
    ------------------------------------------------------------------------------------------------------------------*/
    connect() {
        if (this.socket) return;
        this.socket = io(this.url, { transports: ['websocket'], reconnectionDelayMax: 10000, ...this.options });
        this.socket.on('connect', () => this.emit('connected'));
        this.socket.on('disconnect', (reason) => this.emit('disconnected', reason));
        this.socket.on('connect_error', (error) => this.emit('connect-error', error));
        this.socket.onAny((eventName, message) => this.handleTubeMessage(eventName, message));
    }

    /*------------------------------------------------------------------------------------------------------------------
    ------------------------------------------------------------------------------------------------------------------*/
    close() {
        for (const pending of this.pendingLists.values()) {
            clearTimeout(pending.timer);
            pending.reject(new Error('Connection closed'));
        }
        this.pendingLists.clear();
        this.socket?.removeAllListeners();
        this.socket?.disconnect();
        this.socket = null;
        this.removeAllListeners();
    }

    /*------------------------------------------------------------------------------------------------------------------
    ------------------------------------------------------------------------------------------------------------------*/
    getDevice(familyId, deviceId) {
        return this.devices.get(`${familyId}/${deviceId}`);
    }

    /*------------------------------------------------------------------------------------------------------------------
        Chiede alla headunit l'elenco dei device di una famiglia, con lo stato attuale degli items
    ------------------------------------------------------------------------------------------------------------------*/
    listDevices(familyId, timeout = 5000) {
        return new Promise((resolve, reject) => {
            if (!this.connected) return reject(new Error('Headunit not connected'));
            const requestId = randomUUID();
            const timer = setTimeout(() => {
                this.pendingLists.delete(requestId);
                reject(new Error('Headunit did not answer the device list request'));
            }, timeout);
            this.pendingLists.set(requestId, { resolve, reject, timer });
            this.emitTube(EVENTS.listRequest, { familyId, requestId });
        });
    }

    /*------------------------------------------------------------------------------------------------------------------
        Scrive degli items su un device già conosciuto (serve unitId e roomId ricevuti dalla lista)
    ------------------------------------------------------------------------------------------------------------------*/
    write(familyId, deviceId, items) {
        if (!this.connected) throw new Error('Headunit not connected');
        const device = this.getDevice(familyId, deviceId);
        if (!device) throw new Error(`Unknown device "${deviceId}"`);
        this.emitTube(EVENTS.update, {
            unitId: device.unitId,
            deviceId,
            familyId,
            roomId: device.roomId,
            authorName: AUTHOR_NAME,
            ...items
        });
        Object.assign(device, items);
    }

    /*------------------------------------------------------------------------------------------------------------------
    ------------------------------------------------------------------------------------------------------------------*/
    emitTube(eventName, payload) {
        this.socket.emit(eventName, { origin: 'UNIT', className: CLASS_NAME, eventName, payload });
    }

    /*------------------------------------------------------------------------------------------------------------------
    ------------------------------------------------------------------------------------------------------------------*/
    handleTubeMessage(eventName, message) {
        const payload = message?.payload;
        if (!payload || typeof payload !== 'object') return;

        switch (eventName) {
            case EVENTS.listResponse:
                this.handleListResponse(payload);
                break;
            case EVENTS.update:
            case EVENTS.insert:
                this.handleDeviceUpdate(payload, message.origin, eventName === EVENTS.insert);
                break;
            case EVENTS.history:
                this.handleHistoryEvent(payload);
                break;
            case EVENTS.delete:
                if (payload.familyId && payload.deviceId) {
                    this.devices.delete(`${payload.familyId}/${payload.deviceId}`);
                    this.emit('device-delete', payload.familyId, payload.deviceId);
                }
                break;
            default:
                break;
        }
    }

    /*------------------------------------------------------------------------------------------------------------------
    ------------------------------------------------------------------------------------------------------------------*/
    handleListResponse(payload) {
        const devices = Array.isArray(payload.devices) ? payload.devices : [];
        for (const device of devices) {
            this.devices.set(`${payload.familyId}/${device.deviceId}`, { ...device, unitId: device.unitId || payload.unitId });
        }

        const pending = this.pendingLists.get(payload.requestId);
        if (pending) {
            clearTimeout(pending.timer);
            this.pendingLists.delete(payload.requestId);
            pending.resolve(devices.map((device) => this.getDevice(payload.familyId, device.deviceId)));
        }
        this.emit('device-list', payload.familyId, devices);
    }

    /*------------------------------------------------------------------------------------------------------------------
        Evento dello storico generato da un device (sourceId = deviceId)
    ------------------------------------------------------------------------------------------------------------------*/
    handleHistoryEvent(payload) {
        if (!payload.eventName || !payload.sourceId) return;
        this.emit('history-event', {
            eventName: payload.eventName,
            sourceId: payload.sourceId,
            authorId: payload.authorId ?? null,
            authorName: payload.authorName ?? null,
            payload: payload.payload ?? null
        });
    }

    /*------------------------------------------------------------------------------------------------------------------
    ------------------------------------------------------------------------------------------------------------------*/
    handleDeviceUpdate(payload, origin, isInsert) {
        const { familyId, deviceId } = payload;
        if (!familyId || !deviceId) return;

        const items = {};
        for (const [key, value] of Object.entries(payload)) {
            if (!META_KEYS.includes(key)) items[key] = value;
        }

        const key = `${familyId}/${deviceId}`;
        const device = this.devices.get(key);
        if (device) {
            Object.assign(device, items, payload.roomId ? { roomId: payload.roomId } : {});
        } else if (isInsert) {
            this.devices.set(key, { ...payload });
        }
        this.emit('device-update', { familyId, deviceId, items, origin });
    }
}

module.exports = { TubeClient, EVENTS, META_KEYS };
