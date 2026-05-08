import localFont from "next/font/local";

export const montserrat = localFont({
  src: [
    {
      path: "public/fonts/Montserrat-VariableFont_wght.ttf",
      style: "normal",
      weight: "100 900", // variable font range
    },
  ],
  variable: "--font-montserrat",
  display: "swap",
});
