import baseConfig from "../../packages/config-tailwind/index";
import type { Config } from "tailwindcss";

const config: Config = {
    ...baseConfig,
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
    ],
};

export default config;
