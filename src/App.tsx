import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
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
import NotFound from "@/pages/not-found";
import { AudioPlayer } from "@/components/AudioPlayer";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return null; // or a loading spinner
  }

  const basePath = import.meta.env.BASE_URL || '/mediavault/';

  return (
    <Switch>
      <Route path={`${basePath}login`}>
        {isAuthenticated ? (
          <div>{setLocation(basePath)}</div>
        ) : (
          <Login />
        )}
      </Route>

      {isAuthenticated ? (
        <>
          <Route path={basePath} component={Home} />
          <Route path={`${basePath}gallery`} component={Gallery} />
          <Route path={`${basePath}documents`} component={DocumentsPage} />
          <Route path={`${basePath}vault`} component={Vault} />
          <Route path={`${basePath}files`} component={FileManager} />
          <Route path={`${basePath}music`} component={MusicPage} />
          <Route path={`${basePath}settings`} component={Settings} />
          <Route path={`${basePath}admin/users`} component={UserAdminPage} />
          <Route path={`${basePath}admin/activity`} component={ActivityLogsPage} />
        </>
      ) : (
        <Route path="*">
          <div>{setLocation(`${basePath}login`)}</div>
        </Route>
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
      <TooltipProvider>
        <Toaster />
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
