import { cn } from "@repo/ui";
import { useSettings, type ApiProduct } from "@repo/store";
import { ShoppingBag, Plus, Layers } from "lucide-react";

interface ProductCardProps {
  product: ApiProduct;
  onAdd: (product: ApiProduct) => void;
}



const ProductCard = ({ product, onAdd }: ProductCardProps) => {
  const { data: settings } = useSettings();
  const khrRate = settings?.khr_rate || 4010;
  const fmtKHR = (usd: number) => `${Math.round(usd * khrRate).toLocaleString()} ៛`;
  const minPrice = product.has_variants && product.variants.length > 0
    ? Math.min(...product.variants.filter(v => v.is_available).map(v => parseFloat(v.price)))
    : parseFloat(product.base_price);
  
  const priceLabel = product.has_variants ? `from $${minPrice.toFixed(2)}` : `$${minPrice.toFixed(2)}`;
  const khrLabel = fmtKHR(minPrice);

  return (
    <button
      onClick={() => onAdd(product)}
      disabled={!product.is_available}
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 text-left",
        product.is_available
          ? "hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5 animate-fade-in"
          : "opacity-50 cursor-not-allowed"
      )}
    >
      {/* Image */}
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-accent">
            <ShoppingBag className="h-10 w-10 text-primary/40" />
          </div>
        )}
        {product.is_available && (
          <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-card/90 opacity-0 shadow-md backdrop-blur-sm transition-opacity group-hover:opacity-100">
            <Plus className="h-4 w-4 text-foreground" />
          </div>
        )}
        {!product.is_available && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
              Unavailable
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="text-sm font-semibold text-foreground leading-tight">{product.name}</h3>
        <div className="flex items-center justify-between mt-auto pt-1">
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-muted text-muted-foreground flex items-center gap-1">
            {product.has_variants && <Layers className="h-2.5 w-2.5" />}
            {product.category.name}
          </span>
          <div className="flex flex-col items-end">
            <span className="text-sm font-bold text-foreground">{priceLabel}</span>
            <span className="text-[10px] font-bold text-muted-foreground -mt-1 opacity-70">{khrLabel}</span>
          </div>
        </div>
      </div>
    </button>
  );
};

export default ProductCard;
