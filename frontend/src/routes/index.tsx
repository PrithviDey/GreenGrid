import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/greengrid/Dashboard";
import { LandingPage } from "@/components/greengrid/LandingPage";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("greengrid_user");
    }
    return null;
  });

  const handleEnterApp = (username: string) => {
    localStorage.setItem("greengrid_user", username);
    setCurrentUser(username);
  };

  const handleLogout = () => {
    localStorage.removeItem("greengrid_user");
    setCurrentUser(null);
  };

  if (!currentUser) {
    return <LandingPage onEnterApp={handleEnterApp} />;
  }

  return <Dashboard onLogoutRedirect={handleLogout} />;
}
