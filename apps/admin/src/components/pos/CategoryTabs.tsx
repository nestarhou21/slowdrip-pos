import { cn } from "@repo/ui";
import type { ApiCategory } from "@repo/store";
import {
  Coffee,
  Croissant,
  Cake,
  Dumbbell,
  LayoutGrid,
  CupSoda,
  Milk,
  Utensils,
  Leaf,
  IceCream,
} from "lucide-react";

interface CategoryTabsProps {
  active: string;
  onChange: (cat: string) => void;
  categories: ApiCategory[];
  isLoading?: boolean;
}

function getIconForCategory(name: string): React.ElementType {
  const lower = name.toLowerCase();
  if (lower.includes("matcha") || lower.includes("green tea")) return Leaf;
  if (lower.includes("coffee")) return Coffee;
  if (lower.includes("juice") || lower.includes("soda") || lower.includes("cold brew")) return CupSoda;
  if (lower.includes("pastry") || lower.includes("bread") || lower.includes("croissant")) return Croissant;
  if (lower.includes("cake") || lower.includes("dessert") || lower.includes("sweet")) return Cake;
  if (lower.includes("pilates") || lower.includes("class") || lower.includes("fitness")) return Dumbbell;
  if (lower.includes("milk") || lower.includes("yogurt") || lower.includes("smoothie")) return Milk;
  if (lower.includes("ice cream") || lower.includes("frozen")) return IceCream;
  if (lower.includes("hojicha") || lower.includes("tea")) return Coffee;
  return Utensils;
}

const CategoryTabs = ({ active, onChange, categories, isLoading = false }: CategoryTabsProps) => {
  if (isLoading) {
    return (
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-[82px] min-w-[90px] rounded-xl border-2 border-border bg-muted animate-pulse"
          />
        ))}
      </div>
    );
  }

  const totalCount = categories.reduce((s, c) => s + (c.products_count ?? 0), 0);
  const allTabs = [
    { id: "all", name: "All", icon: LayoutGrid, count: totalCount },
    ...categories.filter((c) => c.is_active).map((c) => ({
      id: c.id,
      name: c.name,
      icon: getIconForCategory(c.name),
      count: c.products_count ?? 0,
    })),
  ];

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
      {allTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-xl border-2 px-5 py-3 text-xs font-medium transition-all duration-200 whitespace-nowrap min-w-[90px]",
              isActive
                ? "border-primary bg-primary text-primary-foreground shadow-md"
                : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
            )}
          >
            <Icon className="h-5 w-5" />
            <span>{tab.name}</span>
            {tab.count > 0 && (
              <span className={cn("text-[10px]", isActive ? "text-primary-foreground/70" : "text-muted-foreground")}>
                {tab.count} items
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default CategoryTabs;
