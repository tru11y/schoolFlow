"use client";

import { useRef, useState, useTransition } from "react";
import { MAX_LOGO_BYTES } from "@/core/domain/school/logo";
import { updateSchoolProfile } from "./actions";

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export function ProfileForm({ name, hasLogo }: { name: string; hasLogo: boolean }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null | undefined>(undefined);
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = logo === undefined ? (hasLogo ? "/school-logo" : null) : logo;

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) return setMessage("Format accepté : PNG ou JPEG.");
    if (file.size > MAX_LOGO_BYTES) return setMessage("Logo trop lourd (150 Ko maximum).");
    setMessage(null);
    setLogo(await readAsDataUrl(file));
  }

  return (
    <form
      action={(fd) =>
        start(async () => {
          const res = await updateSchoolProfile({ name: fd.get("name"), logoDataUrl: logo });
          setMessage(res.ok ? "Établissement enregistré" : res.error.message);
          if (res.ok) setLogo(undefined);
        })
      }
      className="grid gap-4"
    >
      <label className="grid gap-1 text-sm">Nom de l&apos;établissement
        <input
          name="name"
          defaultValue={name}
          required
          minLength={2}
          maxLength={80}
          className="min-w-64 rounded-2xl bg-canvas px-4 py-2.5 outline-none ring-1 ring-ink/15 focus-visible:ring-2 focus-visible:ring-accent"
        />
      </label>
      <div className="flex flex-wrap items-center gap-4">
        <div className="grid size-16 place-items-center overflow-hidden rounded-2xl bg-canvas ring-1 ring-ink/15">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL / auth-gated route, not optimizable */}
          {preview ? <img src={preview} alt="Logo de l'établissement" className="size-full object-contain" /> : <span aria-hidden>🏫</span>}
        </div>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg" onChange={(e) => void onFile(e.target.files?.[0])} className="sr-only" id="logo-file" />
        <label htmlFor="logo-file" className="min-h-11 cursor-pointer rounded-2xl bg-raised px-4 py-2.5 text-sm font-medium ring-1 ring-ink/15 focus-within:ring-2 active:scale-95">
          Choisir un logo
        </label>
        {preview ? (
          <button type="button" onClick={() => { setLogo(null); if (fileRef.current) fileRef.current.value = ""; }} className="min-h-11 rounded-2xl px-4 text-sm text-danger">
            Retirer
          </button>
        ) : null}
        <p className="text-xs text-ink/70">PNG ou JPEG, 150 Ko max.</p>
      </div>
      <div>
        <button disabled={pending} className="min-h-11 rounded-2xl bg-accent px-5 font-medium text-canvas active:scale-95 disabled:opacity-60">
          {pending ? "…" : "Enregistrer"}
        </button>
      </div>
      {message ? <p role="status" className="text-sm text-ink/80">{message}</p> : null}
    </form>
  );
}
