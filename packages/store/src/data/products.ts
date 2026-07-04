export type Category = string;

export interface Product {
  id: string;
  name: string;
  price: number;
  category: Category;
  tag: string;
  image: string;
  description?: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export const categories: { id: Category; label: string; count: number }[] = [
  { id: "all", label: "All Menu", count: 36 },
  { id: "matcha", label: "Matcha", count: 7 },
  { id: "hojicha", label: "Hojicha", count: 6 },
  { id: "coffee", label: "Coffee", count: 9 },
  { id: "juice", label: "Juice", count: 4 },
  { id: "yogurt", label: "Yogurt Bowl", count: 2 },
  { id: "pastry", label: "Pastries", count: 3 },
  { id: "pilates", label: "Classes", count: 5 },
];

export const products: Product[] = [
  // MATCHA
  { id: "m1", name: "Sea Salt Honey Cream Matcha", price: 3.80, category: "matcha", tag: "Drink", image: "/assets/Sea Salt Honey Cream Matcha.png" },
  { id: "m2", name: "Coconut Cold Whisked Matcha", price: 3.80, category: "matcha", tag: "Drink", image: "/assets/Coconut Cold Whisked Matcha.png" },
  { id: "m3", name: "Earl Grey Sea Salt Matcha", price: 3.80, category: "matcha", tag: "Drink", image: "/assets/Earl Grey Sea Salt Matcha.png" },
  { id: "m4", name: "Strawberry Matcha Cloud", price: 3.80, category: "matcha", tag: "Drink", image: "/assets/Strawberry Matcha Cloud.png" },
  { id: "m5", name: "Jasmine Tea Matcha Latte", price: 3.80, category: "matcha", tag: "Drink", image: "/assets/Jasmine Tea Matcha Latte.png" },
  { id: "m6", name: "Ceremonial Matcha Latte", price: 3.50, category: "matcha", tag: "Drink", image: "/assets/Ceremonial Matcha Latte.png" },
  { id: "m7", name: "Hot Matcha Latte", price: 3.50, category: "matcha", tag: "Drink", image: "/assets/Hot Matcha Latte.png" },

  // HOJICHA
  { id: "h1", name: "Earl Grey Hojicha Cloud", price: 3.80, category: "hojicha", tag: "Drink", image: "/assets/Earl Grey Hojicha Cloud.png" },
  { id: "h2", name: "Coconut Cold Whisked Hojicha", price: 3.80, category: "hojicha", tag: "Drink", image: "/assets/Coconut Cold Whisked Hojicha.png" },
  { id: "h3", name: "Black Sesame Cloud Hojicha", price: 3.80, category: "hojicha", tag: "Drink", image: "/assets/Black Sesame Cloud Hojicha.png" },
  { id: "h4", name: "Sea Salt Honey Cream Hojicha", price: 3.80, category: "hojicha", tag: "Drink", image: "/assets/Sea Salt Honey Cream Hojicha.png" },
  { id: "h5", name: "Premium Hojicha Latte", price: 3.50, category: "hojicha", tag: "Drink", image: "/assets/Premium Hojicha Latte.png" },
  { id: "h6", name: "Hot Hojicha Latte", price: 3.50, category: "hojicha", tag: "Drink", image: "/assets/Hot Hojicha Latte.png" },

  // COFFEE - ICE
  { id: "c1", name: "Salted Honey Butter Latte (Iced)", price: 3.20, category: "coffee", tag: "Drink", image: "/assets/Salted Honey Butter Latte.png" },
  { id: "c2", name: "Creamy Dalgona Coconut (Iced)", price: 3.20, category: "coffee", tag: "Drink", image: "/assets/Creamy Dalgona Coconut.png" },
  { id: "c3", name: "Iced Latte", price: 2.50, category: "coffee", tag: "Drink", image: "/assets/Iced Latte.png" },
  { id: "c4", name: "Iced Cappucino", price: 2.50, category: "coffee", tag: "Drink", image: "/assets/Iced Cappucino.png" },
  { id: "c5", name: "Iced Americano", price: 2.50, category: "coffee", tag: "Drink", image: "/assets/Iced Americano.png" },

  // COFFEE - HOT
  { id: "c6", name: "Espresso", price: 2.00, category: "coffee", tag: "Drink", image: "/assets/Espresso.png" },
  { id: "c7", name: "Latte (Hot)", price: 2.50, category: "coffee", tag: "Drink", image: "/assets/Latte.png" },
  { id: "c8", name: "Cappucino (Hot)", price: 2.50, category: "coffee", tag: "Drink", image: "/assets/Cappucino.png" },
  { id: "c9", name: "Americano (Hot)", price: 2.50, category: "coffee", tag: "Drink", image: "/assets/Americano.png" },

  // JUICE
  { id: "j1", name: "Green Balance", price: 3.50, category: "juice", tag: "Drink", image: "/assets/Green Balance.png", description: "Apple, cucumber, pineapple, kale/spinach, lemon" },
  { id: "j2", name: "Golden Glow", price: 3.50, category: "juice", tag: "Drink", image: "/assets/Golden Glow.png", description: "Carrots, oranges, apples, lemon" },
  { id: "j3", name: "Gentle Rise", price: 3.50, category: "juice", tag: "Drink", image: "/assets/Gentle Rise.png", description: "Apples, beetroots, carrots, oranges, lemon" },
  { id: "j4", name: "Soft Refresh", price: 3.50, category: "juice", tag: "Drink", image: "/assets/Soft Refresh.png", description: "Pineapple, green apple, orange, pear, lemon" },

  // YOGURT BOWL
  { id: "y1", name: "Berry Bliss Yogurt", price: 5.80, category: "yogurt", tag: "Food", image: "/assets/Berry_Bliss_Yogurt.png", description: "Coconut or Greek yogurt" },
  { id: "y2", name: "Golden Crunch Yogurt", price: 5.80, category: "yogurt", tag: "Food", image: "/assets/Golden Crunch Yogurt.png", description: "Coconut or Greek yogurt" },

  // PASTRIES
  { id: "p1", name: "Salt Bread", price: 2.00, category: "pastry", tag: "Food", image: "/assets/Salt bread.png" },
  { id: "p2", name: "Garlic Salt Bread", price: 2.20, category: "pastry", tag: "Food", image: "/assets/Garlic salt bread.png" },
  { id: "p3", name: "Croissant", price: 1.80, category: "pastry", tag: "Food", image: "/assets/Croissant.png" },

  // CLASSES (PILATES)
  { id: "cl1", name: "Reformer Class", price: 22.00, category: "pilates", tag: "Class", image: "" },
  { id: "cl2", name: "Cadillac Class", price: 25.00, category: "pilates", tag: "Class", image: "" },
  { id: "cl3", name: "Hot Pilates Class", price: 20.00, category: "pilates", tag: "Class", image: "" },
  { id: "cl4", name: "Barre Class", price: 19.00, category: "pilates", tag: "Class", image: "" },
  { id: "cl5", name: "Recovery Lounge Pass", price: 8.00, category: "pilates", tag: "Class", image: "" },
];
