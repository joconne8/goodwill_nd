import React from "react";
import { createRoot } from "react-dom/client";
import { ReplicaPortal } from "./ReplicaPortal";

// Dedicated packaged synthetic surface. No App/auth/UI changes, provider,
// arbitrary transport, development module graph, or query-selected fault mode.
const root = document.getElementById("root");
if (!root) throw new Error("Synthetic replica root is unavailable.");
createRoot(root).render(<ReplicaPortal scenario="success" />);