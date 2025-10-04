import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ChevronRight, Folder, FolderOpen, Plus, Settings, Loader2, Share2 } from "lucide-react";
import ManageCategoriesDialog from "./ManageCategoriesDialog";
import type { Category } from "@shared/schema";

interface CategoryHierarchyProps {
  categories: Category[];
  selectedCategoryId?: string;
  onCategorySelect: (categoryId?: string) => void;
  onShareCategory?: (categoryId: string, categoryName: string) => void;
}

export default function CategoryHierarchy({ categories, selectedCategoryId, onCategorySelect, onShareCategory }: CategoryHierarchyProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [currentPath, setCurrentPath] = useState<Category[]>([]);
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);

  // Build category tree
  const categoryMap = new Map<string, Category & { children: Category[] }>();
  const rootCategories: (Category & { children: Category[] })[] = [];

  // Initialize category map
  categories.forEach(cat => {
    categoryMap.set(cat.id, { ...cat, children: [] });
  });

  // Build tree structure
  categories.forEach(cat => {
    const category = categoryMap.get(cat.id)!;
    if (cat.parentId) {
      const parent = categoryMap.get(cat.parentId);
      if (parent) {
        parent.children.push(category);
      }
    } else {
      rootCategories.push(category);
    }
  });

  // Sort categories by sortOrder and name - handle both extended and regular categories
  const sortCategories = <T extends Category>(cats: T[]): T[] => {
    return cats.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return (a.sortOrder || 0) - (b.sortOrder || 0);
      }
      return a.name.localeCompare(b.name);
    });
  };

  const toggleExpanded = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const handleCategoryClick = (category: Category) => {
    onCategorySelect(category.id);
    
    // Build breadcrumb path with cycle protection
    const path: Category[] = [];
    const visited = new Set<string>();
    let current: Category | undefined = category;
    
    while (current) {
      // Check for cycles to prevent infinite loops
      if (visited.has(current.id)) {
        console.error(`Cycle detected in category hierarchy at category "${current.name}" (${current.id})`);
        break;
      }
      
      visited.add(current.id);
      path.unshift(current);
      
      // Find parent category
      current = current.parentId ? categories.find(c => c.id === current!.parentId) : undefined;
    }
    
    setCurrentPath(path);
  };

  const getIcon = (category: Category) => {
    if (category.icon) {
      return category.icon;
    }
    return category.isVault ? '🔒' : '📁';
  };

  // Fetch category statistics from the API
  const { data: categoryStatsData, isLoading: isLoadingStats, error: statsError } = useQuery<Record<string, number>>({
    queryKey: ['/api/stats/categories'],
    staleTime: 30000, // Cache for 30 seconds
  });
  
  const { data: globalStatsData } = useQuery<{
    totalItems: number;
    images: number;
    videos: number;
    vaultItems: number;
    storageUsed: number;
    duplicatesFound: number;
  }>({
    queryKey: ['/api/stats'],
    staleTime: 30000,
  });

  // Get category stats from the fetched data
  const getCategoryStats = (categoryId: string) => {
    if (!categoryStatsData || isLoadingStats) return 0;
    return categoryStatsData[categoryId] || 0;
  };
  
  // Get total items for "All Media" from global stats
  const getTotalItems = () => {
    if (!globalStatsData) return 0;
    return globalStatsData.totalItems || 0;
  };

  if (categories.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-border p-6 mb-6" data-testid="category-hierarchy-empty">
        <div className="text-center">
          <Folder className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Folders</h3>
          <p className="text-muted-foreground mb-4">
            Create folders to organize your media collection
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setManageCategoriesOpen(true)}
            data-testid="button-create-first-category"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Folder
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-border p-4 mb-6" data-testid="category-hierarchy">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Browse Folders</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setManageCategoriesOpen(true)}
          data-testid="button-manage-categories"
        >
          <Settings className="w-4 h-4 mr-2" />
          Manage Folders
        </Button>
      </div>
      
      {/* Breadcrumb Navigation */}
      {currentPath.length > 0 && (
        <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-4" data-testid="breadcrumb">
          <button 
            className="hover:text-foreground transition-colors"
            onClick={() => {
              onCategorySelect(undefined);
              setCurrentPath([]);
            }}
          >
            📁 Root
          </button>
          {currentPath.map((category, index) => (
            <div key={category.id} className="flex items-center space-x-2">
              <ChevronRight className="w-4 h-4" />
              <button 
                className={`hover:text-foreground transition-colors ${
                  index === currentPath.length - 1 ? 'text-foreground font-medium' : ''
                }`}
                onClick={() => {
                  if (index < currentPath.length - 1) {
                    handleCategoryClick(category);
                  }
                }}
              >
                {getIcon(category)} {category.name}
              </button>
            </div>
          ))}
        </nav>
      )}
      
      {/* Category Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3" data-testid="category-grid">
        {/* Show "All" option */}
        <button
          className={`flex items-center space-x-2 p-3 rounded-lg transition-colors text-left ${
            !selectedCategoryId 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-secondary hover:bg-secondary/80'
          }`}
          onClick={() => {
            onCategorySelect(undefined);
            setCurrentPath([]);
          }}
          data-testid="category-all"
        >
          <span className="text-lg">📂</span>
          <div>
            <div className="font-medium text-sm">All Media</div>
            <div className="text-xs opacity-75">
              {isLoadingStats ? (
                <div className="flex items-center space-x-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Loading...</span>
                </div>
              ) : (
                `${getTotalItems().toLocaleString()} items`
              )}
            </div>
          </div>
        </button>

        {/* Root categories or current category children */}
        {sortCategories(
          selectedCategoryId
            ? categoryMap.get(selectedCategoryId)?.children || []
            : rootCategories
        ).map((category) => (
          <CategoryItem
            key={category.id}
            category={category}
            isSelected={selectedCategoryId === category.id}
            isExpanded={expandedCategories.has(category.id)}
            onToggleExpanded={toggleExpanded}
            onClick={handleCategoryClick}
            itemCount={getCategoryStats(category.id)}
            onShare={onShareCategory}
          />
        ))}
      </div>

      {/* Show subcategories if any category is expanded */}
      {Array.from(expandedCategories).map(categoryId => {
        const category = categoryMap.get(categoryId);
        if (!category || category.children.length === 0) return null;

        return (
          <div key={categoryId} className="mt-4 pl-4 border-l-2 border-border">
            <div className="text-sm font-medium text-muted-foreground mb-2">
              {category.name} subcategories:
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {sortCategories(category.children).map((child) => (
                <CategoryItem
                  key={child.id}
                  category={child}
                  isSelected={selectedCategoryId === child.id}
                  isExpanded={expandedCategories.has(child.id)}
                  onToggleExpanded={toggleExpanded}
                  onClick={handleCategoryClick}
                  itemCount={getCategoryStats(child.id)}
                  size="sm"
                  onShare={onShareCategory}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Manage Categories Dialog */}
      <ManageCategoriesDialog 
        open={manageCategoriesOpen} 
        onOpenChange={setManageCategoriesOpen} 
      />
    </div>
  );
}

interface CategoryItemProps {
  category: Category & { children?: Category[] };
  isSelected: boolean;
  isExpanded: boolean;
  onToggleExpanded: (categoryId: string) => void;
  onClick: (category: Category) => void;
  itemCount: number;
  size?: 'sm' | 'md';
  onShare?: (categoryId: string, categoryName: string) => void;
}

function CategoryItem({
  category,
  isSelected,
  isExpanded,
  onToggleExpanded,
  onClick,
  itemCount,
  size = 'md',
  onShare
}: CategoryItemProps) {
  const hasChildren = (category.children?.length || 0) > 0;
  const [isHovered, setIsHovered] = useState(false);
  
  const getIcon = () => {
    if (category.icon) {
      return category.icon;
    }
    if (category.isVault) {
      return '🔒';
    }
    return hasChildren ? (isExpanded ? '📂' : '📁') : '📄';
  };

  return (
    <div className="relative group">
      <button
        className={`flex items-center space-x-2 p-3 rounded-lg transition-colors text-left w-full ${
          size === 'sm' ? 'p-2' : 'p-3'
        } ${
          isSelected
            ? 'bg-primary text-primary-foreground'
            : category.isVault
            ? 'bg-accent/20 hover:bg-accent/30 border border-accent/50'
            : 'bg-secondary hover:bg-secondary/80'
        }`}
        onClick={() => onClick(category)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        data-testid={`category-${category.slug}`}
      >
        <span className={size === 'sm' ? 'text-base' : 'text-lg'}>
          {getIcon()}
        </span>
        <div className="flex-1 min-w-0">
          <div className={`font-medium ${size === 'sm' ? 'text-xs' : 'text-sm'} truncate`}>
            {category.name}
          </div>
          <div className={`opacity-75 ${size === 'sm' ? 'text-xs' : 'text-xs'}`}>
            {itemCount.toLocaleString()} items
          </div>
        </div>
      </button>

      {/* Action buttons container - top-right corner */}
      <div className="absolute top-1 right-1 flex gap-1">
        {/* Share button - always visible */}
        {onShare && (
          <button
            className={`p-1.5 rounded transition-all bg-white/20 hover:bg-white/40 ${
              isSelected ? 'opacity-100' : 'opacity-80 hover:opacity-100'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onShare(category.id, category.name);
            }}
            title="Share this folder"
            data-testid={`share-category-${category.slug}`}
          >
            <Share2 className={`w-3.5 h-3.5 ${isSelected ? 'text-primary-foreground' : 'text-foreground'}`} />
          </button>
        )}

        {/* Expand/Collapse button for categories with children */}
        {hasChildren && (
          <button
            className="p-1 rounded hover:bg-black/10 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpanded(category.id);
            }}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            <ChevronRight
              className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            />
          </button>
        )}
      </div>
    </div>
  );
}
