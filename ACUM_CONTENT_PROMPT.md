# ACUM — Repository-Wide Brand, Language and Content Migration (Frontend Only)

## 1. Mission

Rename and rebrand the existing **ACUM** Romanian live TV platform across the **frontend** only.

This is a brand identity, terminology, copywriting and localization migration only.

**UI/UX redesign is explicitly out of scope.** Do not redesign pages, modify layouts, replace components, change CSS, introduce a new design system or alter the visual appearance of the application.

The existing application must continue to look and function as it does today, apart from the necessary replacement of brand names and user-facing text.

The objective is to make ACUM feel like an established, coherent, professional Romanian live TV platform through consistent naming, terminology, tone of voice and communication.

Do not treat this as a simple global find-and-replace operation. Audit the entire frontend repository, understand the context of each reference and make deliberate, verifiable changes.

## 2. Scope of the migration (frontend only)

Inspect and update all relevant brand and language references throughout the **frontend** including:

- Frontend page titles, headings, labels, buttons, descriptions and other visible text.
- Login, registration, account recovery and onboarding copy.
- Channel directory, category pages and player copy.
- Account settings, profile pages and security-related copy.
- Admin dashboard labels, navigation, operational messages and customer-facing communications.
- Backend-generated messages and customer-facing API responses (frontend consumption).
- Email templates and transactional email content (frontend templates).
- In-app notifications, toast messages and alerts.
- Form validation, error messages, empty states, tooltips and confirmation messages.
- All translation dictionaries, locale files, fallback strings and localization resources.
- Page titles, metadata, descriptions, Open Graph content and social sharing text.
- Favicons, manifests and other assets that contain the old brand name, where changing them does not alter the visual design.
- Help pages, FAQs, support content and onboarding instructions.
- Tests, snapshots, fixtures and mock responses that contain outdated branding.
- Seed data and templates containing brand-specific text, where safe and appropriate.

**Do not touch:** TV app (`monorepo/tv`), TV apps (`tizen-tv/`, `webos-tv/`, `android-tv/`), Supabase backend (`supabase/`), or any files outside `monorepo/frontend/`.

Discover the actual repository structure before implementation. Do not assume every category exists, and do not omit a category simply because it is outside the main frontend.

## 3. ACUM brand identity

The official brand name for this migration is:

**ACUM**

Use this capitalization consistently in official brand references.

The positioning is:

Romanian live TV platform — free, ad-free, no account required for basic viewing.

ACUM should sound like a serious, clean, accessible media platform, not a speculative crypto project, a trading app, or a meme site.

AI is not part of the brand identity. Do not insert AI-related language into ordinary copy unless the actual feature requires it.

Proposed tagline:

"Televiziune live, fără reclame."

Treat the tagline as optional brand copy. Use it only in appropriate marketing contexts, not in operational messages, error notifications, transaction records or every page.

Do not invent company details, legal entities, regulatory permissions, licences, security certifications, institutional customers, viewership figures or other factual claims.

## 4. ACUM voice and writing principles

Apply a consistent voice throughout the entire frontend product.

### Confident

Use direct, assured language without arrogance or unsupported superlatives.

Preferred:
- "Explorează canalele."
- "Găsești ce rulează acum."
- "Rezultă detaliile înainte de a continua."

Avoid:
- "Cel mai puternic platformă de televiziune."
- "Revoluția ultimă a streamingului."
- "Numărul unu pentru toată lumea."

### Clear and concise

Prefer natural, precise sentences. Remove unnecessary words, repetitive phrases and awkward machine-generated copy.

Preferred:
- "Canalul rulează live."
- "Nu am putut încărca canalele. Încearcă din nou."
- "Verifică detaliile înainte de a continua."

Avoid:
- "Cererea ta de încărcare a canalului este în curs de procesare."
- "O problemă neașteptată s-a produs în timpul operațiunii susmentionate."

### Professional and premium

Use modern, natural Romanian. Maintain a calm, composed tone.

Avoid excessive exclamation marks, forced slang, emoji-heavy language, artificial urgency, exaggerated claims.

### Transparent and trustworthy

Be explicit about fees, requirements, eligibility, restrictions and viewing states wherever the existing functionality exposes them.

Never make viewing actions sound more successful or certain than they are.

Never promise guaranteed streaming quality, zero risk or uninterrupted availability unless a statement is factually justified and approved.

### Helpful and human

When something fails, explain what happened where known and provide a useful next step.

Do not blame the user, conceal failures or replace informative messages with generic marketing language.

## 5. Product terminology and semantic consistency

Create a canonical terminology guide for the actual features found in the frontend.

Standardize the wording of relevant concepts, including:

- Channels, live streams and broadcasts.
- Categories and families of channels.
- Available, live, offline and scheduled states.
- Streaming quality (SD, HD, Full HD).
- Favourites and recently watched.
- Account verification and security.
- Account tiers (free, paid) and limits.

Do not treat technically different states as synonyms.

For example, a channel that is scheduled is not necessarily live, and a requested stream is not necessarily playing.

Use terminology that matches the existing business logic and backend state model. Do not change that model to accommodate copywriting preferences.

Create a documented glossary in:

`monorepo/frontend/docs/brand/ACUM_TERMINOLOGY.md`

Include the preferred term, meaning, context, disallowed alternatives where appropriate and relevant translation guidance.

## 6. Preserve the existing application and technical contracts

This migration must not change application functionality.

Do not modify:

- CSS rules, styling classes or layout definitions.
- Component hierarchy or visual design.
- Page routing or navigation behavior.
- Authentication, authorization or permissions.
- API endpoint URLs, HTTP methods or request/response contracts.
- Database schemas, field names or persisted identifiers.
- Streaming logic, channel management, video player states or transaction states.
- WebSocket events, webhook payloads, queue names or event contracts.
- Error codes or machine-readable values consumed by clients.
- Environment-variable names or infrastructure identifiers merely to make them match the new brand.
- External integration requirements or third-party configuration.
- Dependencies, framework versions or build configuration, unless an explicitly approved technical requirement makes a change necessary.

Customer-facing text may be improved without changing machine-readable codes or underlying behavior.

Where the brand name appears in an API response, distinguish human-readable messages from structured fields, identifiers and contractually defined values.

Never rename a structured field simply because its name contains the old brand.

If a public-facing API, package or integration genuinely requires a name change, document it separately and request approval before changing its contract.

## 7. Distinguish public brand references from internal identifiers

Before changing references, classify them into these categories:

A. Public-facing content: brand names, visible copy, emails, notifications, help content and product descriptions.

B. Developer-facing content: documentation, examples, SDK descriptions and API guides.

C. Internal technical identifiers: database fields, function names, service names, event identifiers, queue names, environment variables and established API contracts.

D. Historical and third-party references: audit records, archived transactions, external integrations, historical documentation and legally significant records.

Update categories A and B where applicable.

Preserve categories C and D unless a specific change is approved and supported by a migration plan.

Do not rewrite historical records or attribute old transactions to ACUM in a way that changes their historical meaning.

## 8. Repository-wide reference discovery

Before changing anything, search for:

- The existing platform name and its capitalization variants.
- Previous product and sub-brand names.
- Old taglines and marketing claims.
- Old names in translation files.
- Hardcoded text that bypasses the localization system.
- Brand references embedded in templates, metadata, assets and generated files.
- Dynamically assembled strings and indirect references.
- Old brand names in tests, fixtures, examples and documentation.
- References to third-party companies that must remain unchanged.

Use contextual inspection rather than blind replacement.

Create:

`monorepo/frontend/docs/brand/ACUM_BRAND_INVENTORY.md`

For each significant finding, record its location, classification, intended action and migration status.

## 9. Translation and localization

Identify every supported language and the existing localization architecture.

Establish Romanian as the canonical source language for new or revised copy, unless the application has an established localization requirement that dictates otherwise.

Update all supported translations to reflect the ACUM brand and approved terminology.

Requirements:

- Preserve translation keys and interpolation contracts wherever possible.
- Preserve pluralization, date formats, number formats and locale-specific formatting.
- Preserve variables, placeholders and runtime substitutions exactly.
- Do not translate the brand name ACUM.
- Avoid literal translations that sound unnatural or misleading.
- Respect legal and regulatory wording.
- Update fallback strings and server-generated localized messages.
- Identify missing translations explicitly.
- Do not silently leave stale brand names in secondary languages.
- Do not invent new locales or remove supported languages.

Use the existing localization tooling and architecture.

Create:

`monorepo/frontend/docs/brand/ACUM_LOCALIZATION_AUDIT.md`

Record supported locales, files reviewed, terminology changes, missing translations and verification results.

## 10. Emails, notifications and backend-generated copy

Update applicable customer-facing templates, including registration, verification, password recovery, security alerts, support messages and product communications.

Preserve:

- Template variables.
- Dynamic values.
- Links and security-sensitive tokens.
- Delivery configuration.
- Unsubscribe mechanisms where applicable.
- Localization behavior.
- Existing trigger conditions.
- Notification delivery and retry behavior.

Do not send real emails, notifications or customer communications during migration testing.

For backend-generated messages, distinguish customer-facing language from internal diagnostic information.

Preserve diagnostic detail in logs and observability systems. Do not expose sensitive internal details to customers.

## 11. Marketing and product copy

Review existing content and rewrite it where necessary to meet the ACUM voice.

Do not merely replace the old name while retaining awkward, repetitive or exaggerated copy.

However, do not invent features or capabilities to make the brand sound more impressive.

Keep product descriptions aligned with actual functionality.

Use the proposed tagline sparingly and only where it supports the message.

Do not add new marketing pages, new features, promotional flows or interface elements. This task changes existing brand and language content only.

## 12. Admin and operational language

Apply the same terminology and writing standards to the admin application.

Prioritize precision, clarity and operational accuracy.

Preserve internal record identifiers, role names, audit history, permissions, security messages and troubleshooting information.

Differentiate between internal operational messages and messages intended to be sent to customers.

Do not simplify operational language to the point that administrators lose essential information.

Do not remove security warnings or alter the meaning of an administrative action.

## 13. Migration workflow

### Phase 0 — Read-only audit

Do not edit application files.

Inspect the repository and produce the brand inventory, terminology proposal, localization inventory, technical risk assessment and migration plan.

Identify the current brand name, product names, supported locales and all relevant locations where brand or language changes are required.

Stop and report findings before proceeding.

### Phase 1 — Approve terminology and voice

Create the canonical terminology glossary, voice guide and approved wording for key product messages.

Resolve ambiguous or legally sensitive wording before broad changes.

### Phase 2 — Migrate customer-facing content

Update visible text, marketing copy, product terminology, page metadata, email templates, notifications and other user-facing content.

Do not change layouts, styling or functionality.

### Phase 3 — Migrate translations and backend-facing content

Update all supported locale resources, backend-generated messages, admin text, developer documentation and other in-scope references.

Preserve contracts and technical identifiers.

### Phase 4 — Repository-wide consistency audit

Search again for old brand references and outdated terminology.

Review every remaining match and classify it as:

- Correctly migrated.
- Intentionally retained.
- Historical.
- Third-party.
- Internal technical identifier.
- Outstanding issue.

Do not force every search result to change.

### Phase 5 — Regression and acceptance

Run the relevant checks and verify that the application looks and behaves as it did before the content migration, except for the intended text and brand changes.

Report all remaining issues and unverified areas.

## 14. Testing and verification

Perform and document the following checks where supported:

- Build and TypeScript checks.
- Linting and relevant automated tests.
- Localization key and interpolation validation.
- Translation completeness checks.
- Template rendering tests.
- API contract and schema comparisons.
- Searches for stale brand references.
- Browser checks for representative pages and critical workflows.
- Screenshots comparing the before and after appearance.

Visual comparisons should confirm that layouts and styling have not changed unintentionally.

Do not claim that tests passed unless they were actually executed.

Use a safe test environment and synthetic data. Do not initiate real streams or send real customer communications.

## 15. Completion criteria

The migration is complete only when:

- All applicable customer-facing content consistently uses ACUM.
- Product terminology is consistent and documented.
- The approved voice and writing principles are applied throughout the product.
- All supported translations have been audited and updated.
- Admin, email, notification, backend-message and developer-document references have been assessed.
- API contracts, internal identifiers and financial logic remain intact.
- No unexplained legacy brand references remain in active in-scope content.
- Existing layouts, CSS and functionality remain unchanged except for approved text and brand asset substitutions.
- Applicable automated checks have been executed.
- Remaining issues and unverified areas are documented.

## 16. First task

Begin with Phase 0 only.

Read the repository, inspect its actual structure and perform a read-only audit.

Do not install packages, edit application code, change CSS or perform global replacements.

Produce the brand inventory, terminology proposal, localization audit outline, technical risk register and phased migration plan.

Stop before implementation and report the findings.

The objective is a complete and consistent ACUM brand and language migration with no unintended visual redesign, API breakage or functional regression.