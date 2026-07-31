import { readFile, writeFile } from 'fs/promises';
import {join} from 'path';

const MAP_PATH = join('baileys_auth', 'lid-user-map.json');
let cache = null;

export async function loadLidUserMap(){
    try{
        cache = JSON.parse(await readFile(MAP_PATH, 'utf-8'));
    } catch(e) {cache = {};}
}

export async function saveLidUserMap(){
    await writeFile(MAP_PATH, JSON.stringify(cache, null, 2), 'utf-8');
}

export function getLidUserMap() {return cache;}

//Guarda: lid -> {email, userID, phone, resolvedAt}
export function setLidUserMapping(lid, data){
    cache[lid] = {...data, resolvedAt: Date.now()};
}

export function getLidUser(lid) {return cache[lid];}