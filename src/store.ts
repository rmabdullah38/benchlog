// Firestore data layer. Writes go to the persistent local cache first, so the notebook
// works fully offline and syncs when the connection returns.
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Entry, Experiment } from "./types";

let uid = "";
export function setUser(id: string) {
  uid = id;
}

const entriesCol = () => collection(db, "users", uid, "entries");
const experimentsCol = () => collection(db, "users", uid, "experiments");

export function watchEntries(cb: (entries: Entry[], pendingSync: number) => void) {
  return onSnapshot(
    query(entriesCol(), orderBy("createdAt", "asc")),
    { includeMetadataChanges: true },
    (snap) => {
      let pending = 0;
      const list = snap.docs.map((d) => {
        const p = d.metadata.hasPendingWrites;
        if (p) pending++;
        return { ...(d.data() as Omit<Entry, "id">), id: d.id, pendingSync: p };
      });
      cb(list, pending);
    },
  );
}

export function watchExperiments(cb: (x: Experiment[]) => void) {
  return onSnapshot(query(experimentsCol(), orderBy("createdAt", "asc")), (snap) =>
    cb(snap.docs.map((d) => ({ ...(d.data() as Omit<Experiment, "id">), id: d.id }))),
  );
}

// Don't await writes: while offline the promise only resolves after the server acks.
export function addEntry(e: Omit<Entry, "id" | "pendingSync">): string {
  const ref = doc(entriesCol());
  void setDoc(ref, e).catch(console.error);
  return ref.id;
}

export function updateEntry(id: string, patch: Partial<Entry>) {
  const { pendingSync: _p, id: _i, ...rest } = patch;
  void updateDoc(doc(entriesCol(), id), rest).catch(console.error);
}

export function removeEntry(id: string) {
  void deleteDoc(doc(entriesCol(), id)).catch(console.error);
}

export function addExperiment(name: string, goal: string, createdAt = Date.now(), specs = ""): string {
  const ref = doc(experimentsCol());
  void setDoc(ref, { name, goal, specs, createdAt }).catch(console.error);
  return ref.id;
}

export function updateExperiment(id: string, patch: Partial<Omit<Experiment, "id">>) {
  void updateDoc(doc(experimentsCol(), id), patch).catch(console.error);
}
