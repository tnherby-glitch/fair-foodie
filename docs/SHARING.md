# MN Fair Foodie Finder — Social Sharing Brief
Save as docs/SHARING.md and reference from CLAUDE.md alongside DESIGN.md. This is the most important feature in the app. Read it before building any list, profile, or navigation functionality, because it shapes the data model.
## Why this exists
Every year, fairgoers post Instagram stories and TikToks of what they ate and what they thought of it. Those posts are one-offs: the ratings and recommendations evaporate when the story expires. This app's core unlock is making those posts durable and followable. A creator (an influencer or any normal fairgoer) shares their list into their story; a viewer taps it and lands on that exact list — every food, every prontopup rating, mapped and findable at the fair. The post becomes a door into the app.
## The loop (build for this, not for &quot;sharing&quot; in the abstract)
flowchart LR
    A[Create a list&lt;br/&gt;rate foods in pups] --&gt; B[Share to story&lt;br/&gt;asset + link]
    B --&gt; C[Viewer taps link&lt;br/&gt;sticker or bio link]
    C --&gt; D{App installed?}
    D -- yes --&gt; E[App opens directly&lt;br/&gt;to that list]
    D -- no --&gt; F[Public web view&lt;br/&gt;of that list]
    F --&gt; G[Install app&lt;br/&gt;deferred deep link&lt;br/&gt;lands on same list]
    E --&gt; H[Save list, find foods,&lt;br/&gt;rate, make own list]
    G --&gt; H
    H --&gt; B
<w:left w:space="0" w:sz="0" w:val="nil"/><w:bottom w:space="0" w:sz="0" w:val="nil"/><w:right w:space="0" w:sz="0" w:val="nil"/><w:between w:space="0" w:sz="0" w:val="nil"/></w:pBdr><w:shd w:fill="auto" w:val="clear"/><w:spacing w:after="0" w:before="0" w:line="276" w:lineRule="auto"/><w:ind w:left="0" w:right="0" w:firstLine="0"/><w:jc w:val="left"/><w:rPr/></w:pPr><w:r w:rsidDel="00000000" w:rsidR="00000000" w:rsidRPr="00000000"><w:rPr><w:rtl w:val="0"/></w:rPr><w:t xml:space="preserve">
Every decision should shorten this loop or remove friction from it.
## Principle 1: The list is a first-class shareable object
Every list has a stable, canonical URL the moment it's created: mnfoodiefinder.com/l/{slug} with a short human-readable slug (e.g. /l/sarahs-stick-food-tour). Slugs never break; renames redirect.
That URL is the single source of truth for sharing. Story assets, QR codes, link stickers, copy-link, and unfurls all point at it. Never mint per-platform URLs beyond appending attribution parameters.
Lists are public by default (private is an option). A public list is fully viewable with zero login: foods, ratings, notes, creator handle, locations.
## Principle 2: The link must work for everyone, everywhere
Three viewers, one URL:

Has the app → universal link / Android app link opens the app directly to that list. Never bounce through a browser interstitial.
No app, on mobile web → a fast, beautiful, read-only web view of the list (follows DESIGN.md: photo tiles, pup ratings, Blue Ribbon badges). One clear CTA: &quot;Get the app to save this list.&quot; Browsing is never gated behind install or signup.
No app, installs it → deferred deep linking: after first launch, the new user lands on the list that brought them, with the creator credited. This is the moment the loop pays off; do not lose the referral context during install.

Unfurls matter as much as the page: every list URL carries Open Graph and Twitter Card metadata with a server-rendered preview image (list title, creator, top 3 foods, pup score) so links pasted into any platform, group chat, or DM look intentional.
## Principle 3: Design for the story, not just the link
Instagram and TikTok do not allow true interactive embeds; the share is an asset plus a link. So the app generates the asset:

One tap on &quot;Share list&quot; renders a 1080x1920 story-ready image (and a 1080x1080 feed variant) of the list: brand-styled, creator handle, list title, top foods with pup ratings, and the short link rendered as both text and QR code.
The card must be gorgeous enough that people screenshot and repost it. Treat it as a marketing surface: follows DESIGN.md exactly (batter gold, maroon M mark, pup glyphs), photo-forward, readable at phone size.
Share flow uses the native OS share sheet (list URL + rendered asset together) so it works with Instagram Stories, TikTok, Snapchat, iMessage, and whatever launches next. On Instagram Stories specifically, the user pairs the asset with a link sticker pointing at the list URL; make the URL auto-copied to clipboard with a toast telling them it's ready to paste.

Story asset layout (1080x1920):

+------------------------------+
|  [mark]  MN FAIR             |
|          Foodie Finder       |
|                              |
|  SARAH'S STICK FOOD TOUR     |
|  by @sarahatthefair          |
|                              |
|  [photo] Pronto Pup    4.9🌭 |
|  [photo] Cheese Curds  4.7🌭 |
|  [photo] Sweet Martha  4.5🌭 |
|          +9 more             |
|                              |
|  [QR]   mnff.app/l/sarahs-   |
|         stick-food-tour      |
+------------------------------+
<w:left w:space="0" w:sz="0" w:val="nil"/><w:bottom w:space="0" w:sz="0" w:val="nil"/><w:right w:space="0" w:sz="0" w:val="nil"/><w:between w:space="0" w:sz="0" w:val="nil"/></w:pBdr><w:shd w:fill="auto" w:val="clear"/><w:spacing w:after="0" w:before="0" w:line="276" w:lineRule="auto"/><w:ind w:left="0" w:right="0" w:firstLine="0"/><w:jc w:val="left"/><w:rPr/></w:pPr><w:r w:rsidDel="00000000" w:rsidR="00000000" w:rsidRPr="00000000"><w:rPr><w:rtl w:val="0"/></w:rPr><w:t xml:space="preserve">
(🌭 = pup glyph per DESIGN.md, not an emoji, and never a star.)
## Principle 4: Sharing must be nearly instant
Acceptance criteria:

From viewing my list to the share sheet open with asset and link ready: 3 taps or fewer, under 10 seconds, including asset render.
Tapping a shared link with the app installed opens the correct list in one step — no login wall, no home-screen detour.
Tapping without the app shows the full list on web in under 2 seconds on fair Wi-Fi (assume bad connectivity; render server-side, keep the page light).
A user who installs from a shared link lands on that list on first launch, with the creator's attribution intact.
Every share records source attribution (which list, which creator, which channel where detectable) so we can see which creators and channels drive installs and saves.
## User stories
As a creator, I finish rating my foods, tap Share, and post my list to my Instagram story in one flow, so my followers can use my ratings.
As a viewer without the app, I tap the link in a story and immediately see the full list with ratings and locations, so I can try the foods today without installing anything.
As a viewer who installs, I land on the list that brought me and can save it to My Lists, so the recommendation isn't lost in onboarding.
As a creator, I can see how many people viewed and saved my shared list, so sharing feels rewarding and I do it again.
## Non-goals (v1)
No in-app social feed, follows, or comments. The social graph lives on Instagram/TikTok; we are the durable layer underneath it.
No native posting via Instagram/TikTok APIs (fragile, heavy review processes). The OS share sheet is the integration.
No video rendering of lists in v1. Static story asset first; motion export can follow.
## Build order
Canonical list URLs + public web view + OG unfurl images. The front door; everything depends on it.
Share flow: story/feed asset generator, share sheet, clipboard link with toast.
Universal links / app links + deferred deep linking with attribution.
Creator-facing share stats (views, saves per shared list).
## Voice on shared surfaces
Per DESIGN.md: warm, plain, midwestern. The web view CTA says &quot;Get the app to save this list.&quot; The share toast says &quot;Link copied — add it as a link sticker.&quot; Nothing says &quot;viral,&quot; &quot;clout,&quot; or &quot;creator economy.&quot;

