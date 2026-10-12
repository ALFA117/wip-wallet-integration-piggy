import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: 'https://wip-piggy.vercel.app/', changeFrequency: 'weekly', priority: 1 }]
}
