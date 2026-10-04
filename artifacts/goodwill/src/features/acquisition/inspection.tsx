// Development-only inspection entry. Not registered in the production app shell.
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "../../index.css";
import { ReplicaPortal } from "./ReplicaPortal";
import { AcquisitionConsole } from "./AcquisitionConsole";

const consoleView = new URLSearchParams(window.location.search).get("view") === "console";
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient()}>
    <p className="bg-muted px-5 py-2 text-xs">
      Integration inspection only. Shared app routes and private storage are lead-owned; this entry does not publish data.
    </p>
    {consoleView ? <AcquisitionConsole /> : <ReplicaPortal />}
  </QueryClientProvider>,
);