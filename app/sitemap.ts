import type { MetadataRoute } from "next";
import { site } from "@/lib/content/home";

const lastModified = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/apply", "/login", "/register"].map((path) => ({
    url: `${site.url}${path}`,
    lastModified,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
