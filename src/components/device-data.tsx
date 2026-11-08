"use client";
import { useEffect, useState } from "react";
import { Download, HardDrive, ShieldAlert, Trash2 } from "lucide-react";
import { clearDeviceData, exportDeviceData, summarizeDeviceData, type PublicScope } from "@/lib/device-data";

const events = ["binera-preferences", "marketplace-activity", "storage"];

export function DeviceData() {
  const [summary, setSummary] = useState({ saved: 0, compare: 0, activity: 0, passkeys: 0 });
  const [armed, setArmed] = useState<PublicScope | "all" | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(null), 10_000);
    return () => clearTimeout(timer);
  }, [armed]);

  function refresh() { try { setSummary(summarizeDeviceData(localStorage)); } catch { /* Storage can be unavailable; counts stay zero. */ } }
  useEffect(() => {
    const first = setTimeout(refresh, 0);
    for (const event of events) window.addEventListener(event, refresh);
    return () => { clearTimeout(first); for (const event of events) window.removeEventListener(event, refresh); };
  }, []);

  function exportRefs() {
    try {
      const blob = new Blob([JSON.stringify(exportDeviceData(localStorage), null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob); const link = document.createElement("a");
      link.href = url; link.download = "binera-public-references.json"; link.click(); URL.revokeObjectURL(url);
      setMessage("Public references exported. Keep the file to restore labels after clearing.");
    } catch { setMessage("The export could not be created. Keep this browser's data."); }
  }

  function clear(scopes: PublicScope[]) {
    try {
      clearDeviceData(localStorage, scopes);
      window.dispatchEvent(new Event("binera-preferences"));
      window.dispatchEvent(new Event("marketplace-activity"));
      window.dispatchEvent(new Event("storage"));
      setArmed(null); refresh();
      setMessage("Cleared in this browser. Onchain jobs, payments and passkey references are unaffected; use the explorer for public records.");
    } catch { setMessage("These records could not be cleared. Browser storage may be unavailable."); }
  }

  return <section className="device-data" aria-labelledby="device-data-title">
    <h2 id="device-data-title"><HardDrive size={18} />Privacy &amp; device data</h2>
    <p>Binera has no server login or database of your activity. These public references live only in this browser. Passkey signing material is never stored here.</p>
    <dl className="device-data-counts">
      <div><dt>Saved agents</dt><dd>{summary.saved}</dd></div>
      <div><dt>Comparison selections</dt><dd>{summary.compare}</dd></div>
      <div><dt>Activity references</dt><dd>{summary.activity}</dd></div>
      <div><dt>Passkey account references <small>(never cleared here)</small></dt><dd>{summary.passkeys}</dd></div>
    </dl>
    <div className="device-data-actions">
      <button className="button" onClick={exportRefs}><Download size={15} />Export public references</button>
      <button className={`button ${armed === "all" ? "danger" : ""}`} onClick={() => armed === "all" ? clear(["saved", "compare", "activity"]) : setArmed("all")}><Trash2 size={15} />{armed === "all" ? "Confirm: clear all public labels" : "Clear public labels"}</button>
      {armed === "all" && <button className="text-button" onClick={() => setArmed(null)}>Cancel</button>}
    </div>
    <div className="device-data-scopes">
      <button className="text-button" onClick={() => armed === "saved" ? clear(["saved"]) : setArmed("saved")}>{armed === "saved" ? "Confirm clear saved agents" : "Clear saved agents only"}</button>
      <button className="text-button" onClick={() => armed === "activity" ? clear(["activity"]) : setArmed("activity")}>{armed === "activity" ? "Confirm clear activity labels" : "Clear activity labels only"}</button>
      <button className="text-button" onClick={() => armed === "compare" ? clear(["compare"]) : setArmed("compare")}>{armed === "compare" ? "Confirm clear comparison" : "Clear comparison only"}</button>
    </div>
    <p className="device-data-warning" role="status"><ShieldAlert size={14} />{message || "Export first if you want to keep agent and job labels. Clearing never cancels a funded job, revokes a permission or deletes a passkey."}</p>
  </section>;
}
