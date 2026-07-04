import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
    envDir: path.resolve(__dirname, "../.."),
    server: {
        host: "::",
        port: 8080,
        hmr: {
            overlay: false,
        },
    },
    preview: {
        host: "0.0.0.0",
        allowedHosts: true,
    },
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    "react-vendor": ["react", "react-dom", "react-router-dom"],
                    "supabase-vendor": ["@supabase/supabase-js"],
                    "radix-vendor": ["@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu", "@radix-ui/react-tooltip", "@radix-ui/react-tabs", "@radix-ui/react-select", "@radix-ui/react-popover", "@radix-ui/react-checkbox", "@radix-ui/react-switch", "@radix-ui/react-label", "@radix-ui/react-slot"],
                    "lucide-vendor": ["lucide-react"],
                    "query-vendor": ["@tanstack/react-query"],
                },
            },
        },
    },
}));
