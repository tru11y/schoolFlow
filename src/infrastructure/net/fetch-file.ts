import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_REDIRECTS = 5;

/** Vrai si l'IP est privée / loopback / lien-local / réservée (cible interne). */
export function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const p = ip.split(".").map(Number);
    if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true;
    const [a, b] = p as [number, number, number, number];
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224 // multicast / réservé
    );
  }
  if (v === 6) {
    const ip6 = ip.toLowerCase();
    return (
      ip6 === "::1" || ip6 === "::" ||
      ip6.startsWith("fe80") || ip6.startsWith("fc") || ip6.startsWith("fd") ||
      ip6.startsWith("::ffff:") // IPv4-mapped : à revalider en amont
    );
  }
  return true; // hostname non résolu en IP littérale -> refus
}

async function assertPublicHost(hostname: string): Promise<void> {
  const addrs = await lookup(hostname, { all: true });
  if (addrs.length === 0) throw new Error("Hôte introuvable.");
  for (const a of addrs) if (isPrivateIp(a.address)) throw new Error("Cible réseau interne refusée.");
}

/**
 * Télécharge un fichier distant en bloquant les cibles internes (SSRF) :
 * chaque saut de redirection est revalidé par DNS, et la taille est plafonnée.
 */
export async function fetchRemoteFile(startUrl: string): Promise<{ buffer: Buffer; contentType: string }> {
  let url = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Protocole non autorisé.");
    await assertPublicHost(u.hostname);

    const res = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": "SchoolFlow-Timetable-Import", Accept: "*/*" },
      signal: AbortSignal.timeout(15_000),
    });

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error("Redirection sans destination.");
      url = new URL(loc, url).toString();
      continue;
    }
    if (!res.ok) throw new Error(`Téléchargement échoué (HTTP ${res.status}).`);

    const len = Number(res.headers.get("content-length") ?? "0");
    if (len > MAX_BYTES) throw new Error("Fichier trop volumineux.");

    const ab = await res.arrayBuffer();
    if (ab.byteLength > MAX_BYTES) throw new Error("Fichier trop volumineux.");
    return { buffer: Buffer.from(ab), contentType: res.headers.get("content-type") ?? "" };
  }
  throw new Error("Trop de redirections.");
}
