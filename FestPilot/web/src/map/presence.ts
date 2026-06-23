/**
 * Mock presence for the map demo. Real presence comes from the per-group Durable
 * Object over WebSocket (DEC-004) with privacy gating (DEC-015); here we simulate
 * "me", a few friends, and a meeting point so the live overlay is exercised.
 */
import { useEffect, useState } from "react";
import type { StageGeo } from "./transform";

export interface Person {
  id: string;
  name: string;
  lng: number;
  lat: number;
  kind: "me" | "friend";
  sharing: boolean;
}

export interface Meeting {
  lng: number;
  lat: number;
  label: string;
}

const RAD = Math.PI / 180;
function offset(lng: number, lat: number, east: number, north: number): [number, number] {
  const dLat = north / 111320;
  const dLng = east / (111320 * Math.cos(lat * RAD));
  return [lng + dLng, lat + dLat];
}

function seed(stages: StageGeo[]): { people: Person[]; meeting: Meeting } {
  const at = (i: number): StageGeo => stages[Math.min(i, stages.length - 1)]!;
  const me0 = at(Math.floor(stages.length / 2));
  const f1 = at(0), f2 = at(2), f3 = at(stages.length - 1);
  const meet = at(1);
  const [mlng, mlat] = offset(me0.lng, me0.lat, 25, -15);
  const [a1lng, a1lat] = offset(f1.lng, f1.lat, -20, 18);
  const [a2lng, a2lat] = offset(f2.lng, f2.lat, 30, 10);
  const [a3lng, a3lat] = offset(f3.lng, f3.lat, 12, -22);
  return {
    people: [
      { id: "me", name: "You", lng: mlng, lat: mlat, kind: "me", sharing: true },
      { id: "f1", name: "Andy", lng: a1lng, lat: a1lat, kind: "friend", sharing: true },
      { id: "f2", name: "Bea", lng: a2lng, lat: a2lat, kind: "friend", sharing: true },
      { id: "f3", name: "Cris", lng: a3lng, lat: a3lat, kind: "friend", sharing: false },
    ],
    meeting: { lng: meet.lng, lat: meet.lat, label: "Meet point" },
  };
}

/** Gentle random walk (~a few metres / tick) so the dots feel alive. */
export function usePresence(stages: StageGeo[]): { people: Person[]; meeting: Meeting | null } {
  const [people, setPeople] = useState<Person[]>([]);
  const [meeting, setMeeting] = useState<Meeting | null>(null);

  useEffect(() => {
    if (stages.length < 2) return;
    const s = seed(stages);
    setPeople(s.people);
    setMeeting(s.meeting);
    const id = setInterval(() => {
      setPeople((prev) =>
        prev.map((p) => {
          if (!p.sharing) return p;
          const [lng, lat] = offset(p.lng, p.lat, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9);
          return { ...p, lng, lat };
        }),
      );
    }, 2200);
    return () => clearInterval(id);
  }, [stages]);

  return { people, meeting };
}
