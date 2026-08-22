/*
developer6087 (Main Developer)
Copyright 2024 all rights reserved by developer6087. DO NOT steal, copy the code, or claim it as your own!
Please send a message to grimza_zrc on Discord, or join our discord server: its coming very soon
Thank you.

Alternate-implementation build — same public API/behavior as the original,
different internals (chunking, property naming, storage cache, queueing).
*/
import { world } from "@minecraft/server";

// Internal cache: tableName -> { data, ready }
const CACHE = new Map();

const CHUNK_SIZE = 8000;
const HEADER_PREFIX = "bdb";

function chunkProp(table, index) {
    return `${HEADER_PREFIX}_${table}#${index}`;
}
function headerProp(table) {
    return `${HEADER_PREFIX}_${table}#len`;
}
function chunkString(str, size) {
    const out = [];
    for (let i = 0; i < str.length; i += size) out.push(str.slice(i, i + size));
    return out;
}

class BDatabase {
    constructor(tableName) {
        this.tableName = tableName;
        this.QUEUE = [];
        this.onLoadCallback = undefined;

        if (!CACHE.has(tableName)) {
            CACHE.set(tableName, { data: {}, ready: false });
        }

        const loaded = this.fetch();
        const entry = CACHE.get(tableName);
        entry.data = loaded;
        entry.ready = true;

        if (typeof this.onLoadCallback === "function") this.onLoadCallback(loaded);
        while (this.QUEUE.length) {
            const resolveFn = this.QUEUE.shift();
            resolveFn();
        }
    }

    resetStorage() {
        const ids = world.getDynamicPropertyIds().filter(id => id.startsWith(`${HEADER_PREFIX}_${this.tableName}#`));
        for (const id of ids) world.setDynamicProperty(id, undefined);
        world.setDynamicProperty(headerProp(this.tableName), 0);
        CACHE.set(this.tableName, { data: {}, ready: true });
    }

    fetch() {
        let length = world.getDynamicProperty(headerProp(this.tableName)) ?? 0;

        if (typeof length !== "number") {
            console.warn(`[DATABASE]: DB: ${this.tableName}, has improper setup! Resetting data.`);
            length = 0;
            this.resetStorage();
        }

        if (length <= 0) return {};

        let raw = "";
        for (let i = 0; i < length; i++) {
            const part = world.getDynamicProperty(chunkProp(this.tableName, i));
            if (typeof part !== "string") {
                console.warn(`[DATABASE]: When fetching: ${chunkProp(this.tableName, i)}, improper data was found.`);
                this.resetStorage();
                return {};
            }
            raw += part;
        }

        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch {
            console.warn(`[DATABASE]: DB: ${this.tableName}, failed to parse stored data. Resetting.`);
            this.resetStorage();
            return {};
        }

        const entry = CACHE.get(this.tableName) ?? { data: {}, ready: false };
        entry.data = parsed;
        entry.ready = true;
        CACHE.set(this.tableName, entry);
        return parsed;
    }

    addQueueTask() {
        return new Promise(resolve => {
            this.QUEUE.push(resolve);
        });
    }

    async saveData() {
        if (!CACHE.get(this.tableName)?.ready) await this.addQueueTask();
        const json = JSON.stringify(CACHE.get(this.tableName).data);
        const parts = chunkString(json, CHUNK_SIZE);
        if (!parts.length) return;

        world.setDynamicProperty(headerProp(this.tableName), parts.length);
        parts.forEach((part, i) => {
            world.setDynamicProperty(chunkProp(this.tableName, i), part);
        });
    }

    async onLoad(callback) {
        const entry = CACHE.get(this.tableName);
        if (entry?.ready) return callback(entry.data);
        this.onLoadCallback = callback;
    }

    getDBS(table) {
        return world.getDynamicPropertyIds().filter(id => id.startsWith(`${table}:`));
    }

    async set(key, val) {
        const entry = CACHE.get(this.tableName);
        if (!entry?.ready) throw new Error("Data tried to be set before load!");
        entry.data[key] = val;
        return this.saveData();
    }

    async setMany(data) {
        const entry = CACHE.get(this.tableName);
        if (!entry?.ready) throw new Error("Data not loaded! Consider using `setMany` after loading the data.");
        for (const key of Object.keys(data)) {
            entry.data[key] = data[key];
        }
        await this.saveData();
        return this;
    }

    async deleteMany(keys) {
        const entry = CACHE.get(this.tableName);
        if (!entry?.ready) throw new Error("Data not loaded! Consider using `deleteMany` after loading the data.");
        for (const key of keys) {
            delete entry.data[key];
        }
        await this.saveData();
        return this;
    }

    forEach(callback) {
        const collection = this.collection();
        try {
            for (const key of Object.keys(collection)) callback(key, collection[key]);
        } catch (e) {
            console.warn(e + e.stack);
        }
        return this;
    }

    map(callback) {
        const before = this.collection();
        const keysBefore = Object.keys(before);
        const results = [];

        try {
            for (const key of keysBefore) results.push(callback(key, before[key]) ?? undefined);
        } catch (e) {
            console.warn(e + e.stack);
        }

        results.forEach((pair, i) => {
            if (!pair || !pair.length) return;
            const oldKey = keysBefore[i];
            const [newKey, newVal] = pair;
            if (newKey !== oldKey) {
                this.delete(oldKey);
                this.set(newKey, newVal);
            } else {
                this.set(oldKey, newVal);
            }
        });

        return this;
    }

    get(key) {
        const entry = CACHE.get(this.tableName);
        if (!entry?.ready) throw new Error("Data not loaded! Consider using `getAsync` instead!");
        return entry.data[key];
    }

    async getSync(key) {
        const entry = CACHE.get(this.tableName);
        if (entry?.ready) return this.get(key);
        await this.addQueueTask();
        return CACHE.get(this.tableName)?.ready ? CACHE.get(this.tableName).data[key] : null;
    }

    getMany(keys) {
        return keys.map(k => this.get(k));
    }

    async getManySync(keys) {
        const out = [];
        for (const k of keys) out.push(await this.getSync(k));
        return out;
    }

    keys() {
        const entry = CACHE.get(this.tableName);
        if (!entry?.ready) throw new Error("Data not loaded! Consider using `keysSync` instead!");
        return Object.keys(entry.data);
    }

    async keysSync() {
        const entry = CACHE.get(this.tableName);
        if (entry?.ready) return this.keys();
        await this.addQueueTask();
        return CACHE.get(this.tableName)?.ready ? Object.keys(CACHE.get(this.tableName).data) : [];
    }

    allKeysP() {
        return Object.keys(CACHE.get(this.tableName)?.data ?? {});
    }

    async allKeys() {
        await this.addQueueTask();
        const all = this.allKeysP();
        if (!all) return;
        return all.map(k => `\n${k}`);
    }

    values() {
        const entry = CACHE.get(this.tableName);
        if (!entry?.ready) throw new Error("Data not loaded! Consider using `valuesSync` instead!");
        return Object.values(entry.data);
    }

    async valuesSync() {
        const entry = CACHE.get(this.tableName);
        if (entry?.ready) return this.values();
        await this.addQueueTask();
        return CACHE.get(this.tableName)?.ready ? Object.values(CACHE.get(this.tableName).data) : [];
    }

    has(key) {
        const entry = CACHE.get(this.tableName);
        if (!entry?.ready) throw new Error("Data not loaded! Consider using `hasSync` instead!");
        return Boolean(entry.data[key]);
    }

    async hasSync(key) {
        const entry = CACHE.get(this.tableName);
        if (entry?.ready) return this.has(key);
        await this.addQueueTask();
        return CACHE.get(this.tableName)?.ready ? Boolean(CACHE.get(this.tableName).data[key]) : false;
    }

    find(value) {
        const data = CACHE.get(this.tableName)?.data ?? {};
        return Object.keys(data).find(key => data[key] === value);
    }

    findMany(value) {
        const data = CACHE.get(this.tableName)?.data ?? {};
        return Object.keys(data).filter(key => data[key] === value);
    }

    collection() {
        const entry = CACHE.get(this.tableName);
        if (!entry?.ready) throw new Error("Data not loaded! Consider using `collectionSync` instead!");
        return entry.data;
    }

    async collectionSync() {
        const entry = CACHE.get(this.tableName);
        if (entry?.ready) return this.collection();
        await this.addQueueTask();
        return CACHE.get(this.tableName)?.ready ? CACHE.get(this.tableName).data : {};
    }

    async delete(key) {
        const entry = CACHE.get(this.tableName);
        if (!entry?.ready) return false;
        const existed = delete entry.data[key];
        await this.saveData();
        return existed;
    }

    async clear() {
        const entry = CACHE.get(this.tableName) ?? { data: {}, ready: true };
        entry.data = {};
        entry.ready = true;
        CACHE.set(this.tableName, entry);
        return this.saveData();
    }

    getKeyByValue(value) {
        const data = CACHE.get(this.tableName)?.data ?? {};
        for (const key in data) {
            if (data[key] === value) return key;
        }
        return null;
    }
}

export default BDatabase;
