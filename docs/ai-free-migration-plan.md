# AI-Free Migration Plan (Hitster)

## Mål
Göra spelet fullt spelbart utan AI-anrop i runtime. Musik väljs från en egen databas/katalog och kopplas till befintlig spelmotor.

## Scope
- In: Musikdatabas, import/kuratering, deck builder, setup-UI utan AI, DJ-kommentar utan LLM, testning och observability.
- Out (kan behållas bakom feature flag): AI-profilgenerering och AI-chat för experiment.

## Nuvarande AI-beroenden att bygga om
- Musikurval via AI i spelflöde:
  - `server/socketHandlers.ts` (`confirmPreferences`, `aiChat`)
  - `server/ai.ts` (`generateSpotifySearchQueries`, `generateSongSuggestions`)
- AI-chat endpoint:
  - `server/routes.ts` (`POST /api/chat`)
- DJ-LLM (script generation):
  - `server/elevenlabs.ts` (`generateDJScriptWithLLM`)
- AI-profil (ej blockerande för kärnspel):
  - `server/routes.ts` (`POST /api/profiles/generate-ai`)
  - `server/aiProfileGenerator.ts`

## Föreslagen målarkitektur (utan AI i runtime)
1. Setup på masterskärmen använder filter/presets i stället för AI-chat.
2. Backend bygger låtdeck från lokal databas (`songs`, `themes`, `song_facts`), med tydliga regler.
3. Spotify används endast för metadata/preview-länkar (om ni vill), inte för AI-genererade söksträngar.
4. DJ-kommentar bygger på mallar + lagrad trivia i DB.

## Datamodell (förslag)
- `songs`
  - `id`, `spotify_id` (nullable), `title`, `artist`, `release_year`, `preview_url`, `album_cover`, `language`, `popularity`, `is_playable`, `created_at`
- `themes`
  - `id`, `name`, `description`, `is_active`
- `song_themes`
  - `song_id`, `theme_id`
- `song_facts`
  - `id`, `song_id`, `fact_text`, `source` (optional), `locale`
- `import_jobs`
  - `id`, `status`, `started_at`, `finished_at`, `stats_json`, `error`

## Regler för deck builder (MVP)
- 20 låtar per match.
- Inga dubbletter på `title+artist`.
- År mellan 1950-2024.
- Minst 4 olika decennier i ett deck (om temats låtpool tillåter).
- Minst 15 spelbara låtar krävs, annars tydligt fel till UI.

## Backlog (prioriterad)

### EPIC A: Musikdatabas och ingestion
- [ ] A1. Lägg till schema/migrations för `songs`, `themes`, `song_themes`, `song_facts`, `import_jobs`.
  - AC: Migration kör utan fel i dev och test.
  - Estimat: 3 SP
- [ ] A2. Bygg importer (CSV + Spotify metadata-berikning valfritt).
  - AC: Kan importera minst 2 000 låtar med loggad statistik.
  - Estimat: 5 SP
- [ ] A3. Bygg dedupe + validering (år, saknade fält, spelbarhet).
  - AC: Rapport på felaktiga rader och dubbletter.
  - Estimat: 3 SP

### EPIC B: Deck builder och spelintegration
- [ ] B1. Implementera `SongCatalogService` med filter (tema/era/språk/mood).
  - AC: Returnerar kandidatpool deterministiskt för given seed.
  - Estimat: 5 SP
- [ ] B2. Implementera `DeckBuilderService` (20 låtar, spridningsregler).
  - AC: Enhetstester för dubblettskydd + årsspridning.
  - Estimat: 5 SP
- [ ] B3. Bygg om `confirmPreferences` i `server/socketHandlers.ts` att använda DB i stället för AI.
  - AC: Match kan startas/slutföras utan `OPENROUTER_API_KEY`.
  - Estimat: 5 SP
- [ ] B4. Ta bort beroendet till `server/ai.ts` i runtime-flödet.
  - AC: Inga runtime-anrop till OpenRouter för låtval.
  - Estimat: 2 SP

### EPIC C: Setup-UI utan AI
- [ ] C1. Ersätt `client/src/components/AIChat.tsx` med `MusicSetupForm` (presets + filter).
  - AC: Master kan välja tema/era och bekräfta.
  - Estimat: 5 SP
- [ ] C2. Anpassa `MasterPage` + socket payload för nytt format.
  - AC: `confirmPreferences` skickar strukturerat filterobjekt.
  - Estimat: 3 SP
- [ ] C3. UX-felhantering när låtpoolen är för liten.
  - AC: Tydligt fel + förslag till bredare filter.
  - Estimat: 2 SP

### EPIC D: DJ/profil och avveckling av AI-funktioner
- [ ] D1. Ersätt `generateDJScriptWithLLM` med template engine + `song_facts`.
  - AC: Kommentar genereras alltid lokalt utan LLM.
  - Estimat: 5 SP
- [ ] D2. Feature flagga eller avveckla `/api/chat` och `/api/profiles/generate-ai`.
  - AC: Kan stängas av i produktion utan regression i kärnspel.
  - Estimat: 3 SP
- [ ] D3. Dokumentera driftläge “AI-off”.
  - AC: README med env-matris och fallback-beteenden.
  - Estimat: 2 SP

### EPIC E: Kvalitet, test och drift
- [ ] E1. Integrationstester för full matchcykel utan AI-nycklar.
  - AC: CI-test passerar med AI-env avstängd.
  - Estimat: 5 SP
- [ ] E2. Metrics/loggning för deck-building och importjobb.
  - AC: Ser orsaker till misslyckat deck i logg/metric.
  - Estimat: 3 SP
- [ ] E3. Lasttest av deck-build endpoint/socket-event.
  - AC: Stabil vid samtidiga spelstarter.
  - Estimat: 3 SP

## Sprintplan (5 sprintar, 2 veckor)

## Sprint 1: Datagrund
- Fokus: EPIC A (A1-A3)
- Mål: Första katalogen i DB med validerad kvalitet.
- Exit criteria:
  - Migrationer klara.
  - Importjobb fungerar reproducibelt.
  - Minst 2 000 validerade låtar.

## Sprint 2: Deck builder backend
- Fokus: EPIC B (B1-B2)
- Mål: Stabilt låtdeck från DB.
- Exit criteria:
  - `DeckBuilderService` levererar 20 låtar enligt regler.
  - Tester för dedupe/spridning passerar.

## Sprint 3: Runtime utan AI i kärnflöde
- Fokus: EPIC B (B3-B4) + start på C2
- Mål: Match kan spelas komplett utan OpenRouter.
- Exit criteria:
  - `confirmPreferences` bygger deck från DB.
  - `OPENROUTER_API_KEY` behövs inte för att spela.

## Sprint 4: Setup-UI migration
- Fokus: EPIC C (C1-C3)
- Mål: Ny setup-upplevelse utan chat.
- Exit criteria:
  - `AIChat` ersatt.
  - Master kan välja filter/preset och starta spel.

## Sprint 5: Avveckling, hardening, release
- Fokus: EPIC D + E
- Mål: Produktionsklar AI-fri version.
- Exit criteria:
  - DJ-kommentar utan LLM.
  - AI-endpoints feature-flaggade/avvecklade.
  - CI, observability och lasttest klara.

## Definition of Done (per story)
- Kod + tester + dokumentation uppdaterade.
- Felhantering och loggning på plats.
- Ingen regression i befintlig spelloop.
- Verifierad lokalt utan AI-nycklar där relevant.

## Risker och motåtgärder
- Liten låtpool för smala teman.
  - Motåtgärd: fallback till bredare tema + UI-förslag.
- Ojämn årsspridning i importerad data.
  - Motåtgärd: hårda regler i `DeckBuilderService` + kvalitetsrapport.
- Spotify-preview saknas för många låtar.
  - Motåtgärd: gör preview valfritt i spelregler och fortsätt med metadata.

## Leveransordning i kodbasen
1. `shared/schema.ts` + migrationer.
2. Nya server-services: `songCatalogService`, `deckBuilderService`, `importService`.
3. Omskrivning av `server/socketHandlers.ts` (`confirmPreferences`).
4. Ny setup-komponent i `client/src/components` och uppdatering i `MasterPage`.
5. Refaktor av `server/elevenlabs.ts` till template-läge.

