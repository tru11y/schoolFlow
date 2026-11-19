/**
 * Convertit un lien collé (fichier direct, OneDrive ou Google) en URL de
 * téléchargement direct du fichier. Fonction pure, sans réseau.
 */
export function resolveDownloadUrl(input: string): { url: string } | { error: string } {
  const raw = input.trim();
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { error: "Lien invalide." };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { error: "Seuls les liens http(s) sont acceptés." };
  }
  const host = u.hostname.toLowerCase();

  // OneDrive : lien de partage -> API shares (contenu brut).
  if (host === "1drv.ms" || host.endsWith("onedrive.live.com")) {
    const b64 = Buffer.from(raw, "utf8").toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
    return { url: `https://api.onedrive.com/v1.0/shares/u!${b64}/root/content` };
  }

  // Google Sheets -> export xlsx.
  if (host.endsWith("docs.google.com") && u.pathname.includes("/spreadsheets/")) {
    const m = u.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return { url: `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=xlsx` };
  }

  // Google Drive -> téléchargement direct.
  if (host.endsWith("drive.google.com")) {
    const id = u.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1] ?? u.searchParams.get("id");
    if (id) return { url: `https://drive.google.com/uc?export=download&id=${id}` };
  }

  // Sinon : lien de fichier direct, tel quel.
  return { url: raw };
}
