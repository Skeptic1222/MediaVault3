import { Switch, Route, Router as WouterRouter } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";

// Get base path from Vite's BASE_URL
const basePath = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';
import Login from "@/pages/login";
import Home from "@/pages/home";
import Gallery from "@/pages/gallery";
import Vault from "@/pages/vault";
import FileManager from "@/pages/FileManager";
import Settings from "@/pages/settings";
import MusicPage from "@/pages/MusicPage";
import DocumentsPage from "@/pages/DocumentsPage";
import UserAdminPage from "@/pages/UserAdminPage";
import ActivityLogsPage from "@/pages/ActivityLogsPage";
import InvitePage from "@/pages/invite";
import NotFound from "@/pages/not-found";
import { AudioPlayer } from "@/components/AudioPlayer";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show nothing while loading auth state
  if (isLoading) {
    return null;
  }

  return (
    <Switch>
      {/* Public routes - no authentication required */}
      <Route path="/invite/:code" component={InvitePage} />

      {!isAuthenticated ? (
        <Route path="/" component={Login} />
      ) : (
        <>
          <Route path="/" component={Home} />
          <Route path="/gallery" component={Gallery} />
          <Route path="/documents" component={DocumentsPage} />
          <Route path="/vault" component={Vault} />
          <Route path="/files" component={FileManager} />
          <Route path="/music" component={MusicPage} />
          <Route path="/settings" component={Settings} />
          <Route path="/admin/users" component={UserAdminPage} />
          <Route path="/admin/activity" component={ActivityLogsPage} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated } = useAuth();
  
  return (
    <>
      <Router />
      {isAuthenticated && <AudioPlayer />}
    </>
  );
}

function App() {
  // Set document title
  document.title = 'SecureGallery Pro';

  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={basePath}>
        <TooltipProvider>
          <Toaster />
          <AppContent />
        </TooltipProvider>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
