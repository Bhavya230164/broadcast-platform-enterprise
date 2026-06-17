import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import App from "./App";
import { SocketProvider } from "./context/SocketContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <SocketProvider>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            className: "dark:!bg-slate-800 dark:!text-slate-100",
            style: { borderRadius: "10px", fontSize: "14px" },
            success: { iconTheme: { primary: "#0ea5e9", secondary: "#fff" } },
          }}
        />
      </SocketProvider>
    </BrowserRouter>
  </React.StrictMode>

  
);
