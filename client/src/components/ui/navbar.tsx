import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Search, Upload, Settings, LogOut, Shield, Database, Music, FileText, Menu, Home, Image, FolderOpen } from "lucide-react";

export default function Navbar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ["/api/stats"],
    retry: false,
  });

  const handleLogout = () => {
    const basePath = import.meta.env.BASE_URL || '/mediavault/';
    window.location.href = `${basePath}api/logout`;
  };

  const navItems = [
    { href: "/", label: "Dashboard", active: location === "/", icon: Home },
    { href: "/files", label: "Files", active: location === "/files", icon: FolderOpen },
    { href: "/gallery", label: "Gallery", active: location === "/gallery", icon: Image },
    { href: "/documents", label: "Documents", active: location === "/documents", icon: FileText },
    { href: "/music", label: "Music", active: location === "/music", icon: Music },
    { href: "/vault", label: "Vault", active: location === "/vault", vault: true, icon: Shield },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border" data-testid="navbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-4">
            {/* Mobile Menu Button */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-11 h-11 md:hidden"
                  data-testid="mobile-menu-button"
                >
                  <Menu className="w-6 h-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80">
                <SheetHeader>
                  <SheetTitle className="text-left">Menu</SheetTitle>
                </SheetHeader>
                <div className="mt-6 flex flex-col space-y-1">
                  {/* Mobile Search */}
                  <div className="relative mb-4">
                    <Input
                      type="search"
                      placeholder="Search media..."
                      value={searchQuery}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSearchQuery(value);
                        window.dispatchEvent(new CustomEvent('navbarSearchChange', {
                          detail: { query: value }
                        }));
                      }}
                      className="w-full pr-10"
                      data-testid="mobile-search-input"
                    />
                    <div className="absolute right-3 top-2.5 text-muted-foreground">
                      <Search className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Mobile Navigation Items */}
                  {navItems.map((item) => (
                    <Link key={item.href} href={item.href}>
                      <Button
                        variant={item.active ? "default" : "ghost"}
                        className={`w-full justify-start h-12 text-base ${
                          item.vault ? "text-accent hover:text-accent/80" : ""
                        }`}
                        onClick={() => setMobileMenuOpen(false)}
                        data-testid={`mobile-nav-${item.label.toLowerCase()}`}
                      >
                        <item.icon className="w-5 h-5 mr-3" />
                        {item.label}
                      </Button>
                    </Link>
                  ))}

                  {/* Mobile Upload Button */}
                  <Link href="/gallery">
                    <Button
                      className="w-full justify-start h-12 text-base bg-primary hover:bg-primary/90"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setTimeout(() => {
                          window.dispatchEvent(new CustomEvent('openUploadModal'));
                        }, 100);
                      }}
                      data-testid="mobile-upload-button"
                    >
                      <Upload className="w-5 h-5 mr-3" />
                      Upload
                    </Button>
                  </Link>

                  {/* Mobile User Actions */}
                  <div className="pt-4 mt-4 border-t border-border">
                    <Link href="/settings">
                      <Button
                        variant="ghost"
                        className="w-full justify-start h-12 text-base"
                        onClick={() => setMobileMenuOpen(false)}
                        data-testid="mobile-settings"
                      >
                        <Settings className="w-5 h-5 mr-3" />
                        Settings
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      className="w-full justify-start h-12 text-base"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleLogout();
                      }}
                      data-testid="mobile-logout"
                    >
                      <LogOut className="w-5 h-5 mr-3" />
                      Sign Out
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <Link href="/">
              <div className="text-xl md:text-2xl font-black bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent cursor-pointer" data-testid="logo">
                SecureGallery Pro
              </div>
            </Link>
            <div className="hidden md:flex items-center space-x-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span data-testid="database-status">PostgreSQL Connected</span>
            </div>
          </div>
          
          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <button
                  className={`transition-colors font-medium flex items-center gap-1.5 ${
                    item.active
                      ? "text-foreground"
                      : item.vault
                      ? "text-accent hover:text-accent/80"
                      : "text-muted-foreground hover:text-primary"
                  }`}
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              </Link>
            ))}
          </nav>
          
          {/* User Profile & Controls */}
          <div className="flex items-center space-x-4">
            {/* Search */}
            <div className="relative hidden lg:block">
              <Input
                type="search"
                placeholder="Search media..."
                value={searchQuery}
                onChange={(e) => {
                  const value = e.target.value;
                  setSearchQuery(value);
                  // Dispatch custom event for gallery to listen to
                  window.dispatchEvent(new CustomEvent('navbarSearchChange', { 
                    detail: { query: value } 
                  }));
                }}
                className="w-64 pr-10"
                data-testid="search-input"
              />
              <div className="absolute right-3 top-2.5 text-muted-foreground">
                <Search className="w-4 h-4" />
              </div>
            </div>
            
            {/* Upload Button */}
            <Link href="/gallery">
              <Button
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                data-testid="upload-button"
                onClick={() => {
                  // Navigate to gallery and trigger upload modal
                  // The modal state will be handled by the gallery page
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('openUploadModal'));
                  }, 100);
                }}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload
              </Button>
            </Link>
            
            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center space-x-3 text-sm" data-testid="user-menu-trigger">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={user?.profileImageUrl} alt={user?.firstName || user?.email || "User"} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white font-semibold">
                      {getInitials(user?.firstName, user?.lastName, user?.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:block text-left">
                    <div className="text-foreground font-medium" data-testid="user-name">
                      {user?.firstName || user?.email || 'User'}
                    </div>
                    <div className="text-xs text-muted-foreground" data-testid="user-role">
                      {user?.role || 'User'}
                    </div>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5 text-sm">
                  <div className="font-medium" data-testid="dropdown-user-name">
                    {user?.firstName || user?.email || 'User'}
                  </div>
                  <div className="text-xs text-muted-foreground" data-testid="dropdown-user-email">
                    {user?.email}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <Link href="/settings">
                  <DropdownMenuItem data-testid="dropdown-settings">
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuItem data-testid="dropdown-admin" className="md:hidden">
                  <Database className="w-4 h-4 mr-2" />
                  Admin Panel
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} data-testid="dropdown-logout">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}

function getInitials(firstName?: string, lastName?: string, email?: string): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) {
    return firstName.slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return "U";
}
