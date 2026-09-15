// Navigation types for the public site. The menu itself is CMS content (the
// "nav" list in Site settings, src/cms/documents.ts); the marketing layout
// loads it once and hands it to the Header (a client component) and the
// Footer (a server component) as props. Types only, so either side can import
// this module without crossing the client/server boundary.

import type { DocumentData } from "@/cms/documents";

export type NavItem = DocumentData<"site">["nav"][number];
export type NavChild = NavItem["children"][number];
export type Brand = DocumentData<"site">["brand"];
