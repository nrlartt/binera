"use client";
export default function ErrorBoundary({ reset }: { reset: () => void }) { return <div className="empty page"><h1>Something interrupted this page.</h1><p>Your wallet permissions have not changed.</p><button className="button primary" onClick={reset}>Try again</button></div>; }
