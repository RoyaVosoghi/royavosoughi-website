# Curated knowledge docs

Drop markdown files here to add them to the chatbot's knowledge base, beyond
what's already on the site.

**Naming convention**: `<slug>.<locale>.md`, e.g. `pricing-faq.en.md` and
`pricing-faq.fa.md`. The slug ties the two locale versions of the same doc
together; each file's whole content becomes one document to chunk — no
frontmatter needed, the file content is the source of truth.

After adding or editing a file here, run `npm run ingest` to (re)embed it
into Supabase. Re-running is safe — each doc's old chunks are replaced, not
duplicated.
