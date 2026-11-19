"use client";

import { useEffect } from "react";
import { flushOutbox } from "./outbox";

/** Vide la file hors-ligne au chargement, au retour du réseau, et sur demande du service worker. */
export function OutboxSync() {
  useEffect(() => {
    const run = () => {
      flushOutbox().catch(() => {});
    };
    run();
    window.addEventListener("online", run);
    const onMsg = (e: MessageEvent) => {
      if (e.data === "flush-outbox") run();
    };
    navigator.serviceWorker?.addEventListener("message", onMsg);
    return () => {
      window.removeEventListener("online", run);
      navigator.serviceWorker?.removeEventListener("message", onMsg);
    };
  }, []);
  return null;
}
