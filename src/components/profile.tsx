"use client";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Bookmark, UserRound } from "lucide-react";
import { z } from "zod";
import type { Agent } from "@/lib/domain";
import { useMarket } from "./shell";
import { api, CopyAddress } from "./ui";

const event = "binera-preferences";
function subscribe(fn: () => void) { window.addEventListener(event, fn); window.addEventListener("storage", fn); return () => { window.removeEventListener(event, fn); window.removeEventListener("storage", fn); }; }
function read(key: string) { try { return localStorage.getItem(key) || ""; } catch { return ""; } }
function write(key: string, value: string) { localStorage.setItem(key, value); window.dispatchEvent(new Event(event)); }
const idsSchema = z.array(z.string().regex(/^(scan-56-\d{1,20}|studio-[\w-]+)$/)).max(100);
export function useSavedAgents() {
  const raw = useSyncExternalStore(subscribe, () => read("binera-saved"), () => "");
  let ids: string[] = []; try { ids = idsSchema.parse(JSON.parse(raw || "[]")); } catch { /* Invalid preferences are ignored. */ }
  return { ids, toggle: (id: string) => write("binera-saved", JSON.stringify(idsSchema.parse(ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]))) };
}
export function SaveAgent({ id, name }: { id: string; name: string }) {
  const { ids, toggle } = useSavedAgents(); const [error, setError] = useState(""); const saved = ids.includes(id);
  return <span><button type="button" className="icon-button" aria-label={`${saved ? "Unsave" : "Save"} ${name}`} aria-pressed={saved} onClick={() => { try { toggle(id); setError(""); } catch { setError("Could not save. Check browser storage or the 100-agent limit."); } }}><Bookmark size={17} fill={saved ? "currentColor" : "none"} /></button>{error && <small role="alert">{error}</small>}</span>;
}
export function SavedAgents() {
  const { ids } = useSavedAgents(); const { toggleCompare } = useMarket(); const [items, setItems] = useState<Record<string, Agent | null>>({});
  const key = ids.join(",");
  useEffect(() => {
    const controller = new AbortController();
    // Bounded concurrency; one failed publisher never hides other saved identities.
    const pending = key.split(",").filter(Boolean);
    async function worker() { while (pending.length && !controller.signal.aborted) { const id = pending.shift()!; try { const a = await api<Agent>(`/api/agents/${id}`, { signal: controller.signal }); if (!controller.signal.aborted) setItems(old => ({ ...old, [id]: a })); } catch { if (!controller.signal.aborted) setItems(old => ({ ...old, [id]: null })); } } }
    void Promise.all([worker(), worker()]); return () => controller.abort();
  }, [key]);
  return <div className="page"><div className="eyebrow">YOUR SHORTLIST</div><h1>Saved agents</h1><p>Saved in this browser. Identity details are retrieved from the live registry.</p>{!ids.length ? <div className="empty"><Bookmark /><h2>Keep a few specialists in mind.</h2><Link className="button primary" href="/">Discover agents</Link></div> : <div className="job-list">{ids.map(id => <article className="job-card" key={id}><div className="job-card-header"><Link href={`/agents/${id}`}><h3>{items[id]?.name || id}</h3></Link><SaveAgent id={id} name={items[id]?.name || id} /></div><p>{items[id]?.description || (items[id] === null ? "Live details unavailable. Open the agent to retry." : "Refreshing identity…")}</p>{items[id] && <button className="button" onClick={() => toggleCompare(items[id]!)}>Add to comparison</button>}</article>)}</div>}</div>;
}
const profileSchema = z.object({ name: z.string().trim().max(60), bio: z.string().trim().max(240) });
function ProfileEditor({ storageKey }: { storageKey: string }) {
  const [value, setValue] = useState(() => { try { return profileSchema.parse(JSON.parse(read(storageKey) || "{}")); } catch { return { name: "", bio: "" }; } });
  const [message, setMessage] = useState("");
  return <form className="task-form" onSubmit={e => { e.preventDefault(); try { write(storageKey, JSON.stringify(profileSchema.parse(value))); setMessage("Profile saved on this device."); } catch { setMessage("Could not save your profile. Browser storage may be unavailable."); } }}><label>Display name<input maxLength={60} value={value.name} onChange={e => setValue({ ...value, name: e.target.value })} /></label><label>About your research goals<textarea maxLength={240} rows={3} value={value.bio} onChange={e => setValue({ ...value, bio: e.target.value })} /></label><button className="button primary">Save profile</button><button type="button" className="text-button" onClick={() => { try { write(storageKey, ""); setValue({ name: "", bio: "" }); setMessage("Profile cleared. Account and activity references are preserved."); } catch { setMessage("Could not clear profile."); } }}>Clear profile</button><p role="status">{message}</p></form>;
}
export function Profile() {
  const { wallet, openWallet } = useMarket(); const { ids } = useSavedAgents(); const [ready, setReady] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setReady(true), 0); return () => clearTimeout(timer); }, []);
  return <div className="page profile-page"><div className="eyebrow">YOUR BINERA</div><h1>Profile</h1><p>Your preferences and marketplace account, in one place.</p><div className="detail-grid"><section><h2><UserRound size={22} /> Personal details</h2><p>Private to this browser. No public profile or cross-device sync is enabled. These details are never included in agent tasks automatically.</p>{ready && <ProfileEditor key={wallet?.address || "guest"} storageKey={`binera-profile-${wallet?.address.toLowerCase() || "guest"}`} />}</section><aside className="job-card"><h2>Marketplace account</h2>{wallet ? <><p className="address">{wallet.address}<CopyAddress address={wallet.address} /></p><p>Connected with a passkey. BNB Smart Chain.</p><Link className="button" href="/dashboard">View jobs & permissions</Link></> : <><p>Connect your passkey account to manage jobs. Guest preferences can be saved without connecting.</p><button className="button primary" onClick={openWallet}>Connect account</button></>}<hr /><Link href="/saved">Saved agents ({ids.length})</Link><p><Link href="/compare">Open comparison</Link></p></aside></div><p className="source-note">Profile and saved agents are device preferences. Export job references from My agents to retain your activity history.</p></div>;
}
