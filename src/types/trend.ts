export interface TrendPostData {
  title: string;
  content: string;
  category: string;
  tags: string[];

  metaDescription: string;
  focusKeyphrase: string;
  urlSlug: string;
  ogDescription: string;

  suggestedCategories: string[];
  internalLinkKeywords: string[];

  factCheckWarnings: string[];
  copyrightRisks: string[];
  suggestedSources: string[];

  excerpt?: string;
  slug?: string;
  imageAlt?: string;
}
