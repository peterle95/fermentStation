# Manual image prompts: Swipe Drinks guide

**Unofficial analysis.** This project has no affiliation with or endorsement from Swipe Drinks or Orbix Studio. Trademarks belong to their respective owners.

Generate **nine separate images**, one per prompt below. These prompts expand the slots in [prompts.json](prompts.json) into self-contained instructions. They describe new artwork for the guide, not official brand photography or recovered brand rules.

## Does the image model need the `out/` folder?

**No. Copy the complete prompt for each image into your image tool.** Each prompt includes its subject, colours, lighting, composition, and exclusions. Set the aspect ratio through the tool's controls if available.

You do not need to upload the HTML guides, `snapshot.json`, `analysis.json`, slides, or video. Do not upload source brand photographs, logos, case-study screenshots, or font files as reference images. Use text descriptions only.

For context, we are interpreting **Swipe Drinks' visual identity inside an Orbix case study**, not Orbix Studio's own identity. The four pastel colours come from the artwork's style board: yellow `#FFEC89`, lime `#B6F074`, lilac `#DAB8F1`, and blue `#B6E1FA`. Dark `#1C1C1C` comes from a screenshot sample. Treat these hex values as colour direction for photography; lighting and materials will produce variations. We chose the subjects and compositions below for this unofficial guide.

## Generation and saving

- Generate a single finished photograph per prompt, not a contact sheet, collage, guide page, or mockup.
- Use opaque backgrounds and save actual PNG files with the filenames below. Do not rename another file format to `.png`.
- Landscape target: **2000 × 1125 px, 16:9**. Portrait target: **1400 × 1750 px, 4:5**. If your model offers different sizes, choose the matching ratio and the closest available resolution. The importer caps width at 2000 or 1400 px without upscaling; it does not fix the aspect ratio.
- Save files under `out/www.orbix.studio/images/`. The model does not need to render the filename into the image.
- Keep important subjects away from the edges to allow cropping. Check hands, glass rims, fruit, reflections, and repeated objects before importing.
- Do not add text, disclaimers, watermarks, or AI labels inside the pixels. The guide supplies the unofficial-analysis disclosures and adds an **AI-generated image** attribution when importing.

## 1. Hero

**Save as:** `images/hero.png`  
**Target:** 2000 × 1125 px, 16:9

```text
Create one original photorealistic studio beverage photograph, landscape 16:9. Place a chilled pink grapefruit soda in a plain, unbranded clear tumbler on the right half of a seamless pastel lemon-yellow studio sweep, colour direction #FFEC89. Add a few fresh lime slices near the glass, using lime-green accents around #B6F074. Show believable tiny bubbles, clear glass, condensation droplets, and a soft contact shadow. Use a frontal three-quarter view with bright directional studio light and shadow edges with slight softness. Keep the upper-left area calm and empty for a separate HTML text overlay; do not render any text. Use clean, playful, tactile beverage-editorial photography with restrained props. Create new subjects and a new composition without copying an existing brand photograph. No people, letters, numbers, logos, labels, brand marks, watermarks, packaging, cards, phones, or app screens. Output one photograph, not a collage or graphic layout.
```

## 2. Horizon

**Save as:** `images/horizon.png`  
**Target:** 2000 × 1125 px, 16:9

```text
Create one original photorealistic minimalist studio still life, landscape 16:9. A pale mint-lime floor, colour direction #B6F074 softened by light, meets a pale-blue backdrop, colour direction #B6E1FA, at a low, crisp horizontal seam. Place one small unbranded clear glass of chilled pear soda at the far right, fully inside the frame with room around it. Show subtle condensation and a believable contact shadow. Leave most of the foreground and the left side empty. Use bright clean studio lighting, controlled reflections, and shadow edges with slight softness. Keep the materials photographic and the set simple, with no mountains, buildings, or decorative objects. Create a new composition without copying source photographs. No people, text, letters, numbers, logos, labels, watermarks, packaging, cards, phones, or app screens. Output one photograph, not a collage or graphic layout.
```

## 3. Object

**Save as:** `images/object.png`  
**Target:** 1400 × 1750 px, 4:5

```text
Create one original photorealistic studio material study, portrait 4:5. Arrange a single polished chrome sphere beside one translucent ice-blue acrylic cylinder on a seamless pastel lime-green surface and backdrop, colour direction #B6F074. Use pale blue #B6E1FA as the direction for the acrylic. Keep both objects fully inside the frame with generous space around them. Photograph from a frontal three-quarter angle with bright directional studio lighting, orderly reflections, realistic refraction, and grounded contact shadows. The mood is clean, playful, tactile, and precise. Reflections should show only neutral studio light sources, not people, lettering, or scenery. Create a new composition without copying source artwork. No drinks, fruit, text, letters, numbers, logos, brand marks, labels, watermarks, cards, phones, or app screens. Output one photograph, not an illustration, collage, or graphic layout.
```

## 4. Street

**Save as:** `images/street.png`  
**Target:** 1400 × 1750 px, 4:5

```text
Create one original photorealistic candid lifestyle photograph, portrait 4:5. Show a small group of adult friends, all visibly over 25, holding plain unbranded clear cups of non-alcoholic citrus soda outside a relaxed outdoor music event in daylight. Frame around their torsos, hands, drinks, and partial faces, keeping the cups and hands away from the image edges. Give each person natural anatomy and a plausible grip on their cup. Show fresh citrus, clear ice, and condensation. Use a fresh pastel wardrobe and softly blurred surroundings with lemon yellow #FFEC89, lime #B6F074, lilac #DAB8F1, and pale blue #B6E1FA as colour accents. Use bright natural light, gentle shadow edges, and realistic skin texture rather than a glossy fashion-ad finish. Keep the setting generic with no identifiable venue, performers, signs, or brands. Create new fictional people and a new composition without copying source photographs. No children, alcohol, text, letters, numbers, logos, labels, watermarks, branded clothing, posters, cards, phones, or app screens. Output one photograph, not a collage or graphic layout.
```

## 5. Sky

**Save as:** `images/sky.png`  
**Target:** 2000 × 1125 px, 16:9

```text
Create one original photorealistic minimalist summer landscape photograph, landscape 16:9. Fill most of the frame with a clean pale-blue sky, colour direction #B6E1FA, above a narrow band of fresh chartreuse-green grass, colour direction #B6F074. Keep the horizon low, straight, and crisp. Use soft natural daylight and believable grass texture. Keep the sky calm and almost cloudless, with ample empty space for a separate HTML overlay. The mood is fresh, light, and quiet, consistent with pastel beverage-editorial imagery. Create a new scene without copying a source photograph. No people, drinks, fruit, objects, buildings, mountains, birds, text, letters, numbers, logos, watermarks, cards, phones, or app screens. Output one photograph, not an illustration, collage, or graphic layout.
```

## 6. Glass

**Save as:** `images/glass.png`  
**Target:** 1400 × 1750 px, 4:5

```text
Create one original photorealistic studio material photograph, portrait 4:5. Arrange an orderly row of exactly three plain clear cylindrical drinking glasses on a seamless pastel lilac surface and backdrop, colour direction #DAB8F1. Show delicate condensation on the glasses and place one freshly cut kiwi slice near their bases. Photograph from the front with a slight elevated angle so the glass rims remain visible. Keep the full glasses inside the frame with breathing room above and at the sides. Use bright directional studio lighting with shadow edges with slight softness, controlled highlights, believable transparent glass, consistent rims, and grounded shadows. The mood is clean, playful, and tactile. Create new subjects and a new composition without copying source photographs. No people, text, letters, numbers, logos, labels, brand marks, watermarks, packaging, cards, phones, or app screens. Output one photograph, not a collage or graphic layout.
```

## 7. Grid

**Save as:** `images/grid.png`  
**Target:** 2000 × 1125 px, 16:9

```text
Create one original photorealistic top-down studio still life, landscape 16:9. Arrange plain unbranded clear glass tumblers and fresh lime halves in a precise, evenly spaced modular arrangement on a flat pale-yellow surface, colour direction #FFEC89. Suggest the rhythm of a twelve-column design grid through alignment and equal spacing, without drawing grid lines or adding twelve columns of tiny objects. Use lime-green fruit accents around #B6F074. Leave visible negative space between objects and a clear margin around the composition. Use bright directional studio light, shadow edges with slight softness, realistic glass reflections, and tactile cut-fruit detail. Keep the camera directly overhead and the arrangement orderly. Create new subjects and a new composition without copying source photographs. No people, text, letters, numbers, logos, labels, brand marks, watermarks, packaging, cards, phones, or app screens. Output one photograph, not a collage, diagram, or graphic layout.
```

## 8. Tokens

**Save as:** `images/tokens.png`  
**Target:** 1400 × 1750 px, 4:5

```text
Create one original photorealistic studio material study, portrait 4:5. Place a small, precise staggered stack of blank lime-green ceramic discs beside a translucent pale-blue cube on a clean matte near-black studio surface and backdrop. Colour directions: discs #B6F074, cube #B6E1FA, background #1C1C1C. Keep the discs plain, with no engraving, symbols, currency marks, or holes. Use a frontal three-quarter camera angle, controlled bright studio highlights, shadow edges with slight softness, realistic ceramic texture, believable refraction through the cube, and grounded contact shadows. Keep the objects fully inside the frame with generous negative space. The mood is playful, tactile, and orderly rather than futuristic. Create a new composition without copying source artwork. No people, drinks, fruit, text, letters, numbers, logos, labels, watermarks, packaging, cards, phones, or app screens. Output one photograph, not an illustration, collage, or graphic layout.
```

## 9. Fruit

**Save as:** `images/fruit.png`  
**Target:** 1400 × 1750 px, 4:5

```text
Create one original photorealistic macro food photograph, portrait 4:5. Arrange freshly cut pink grapefruit, pear, and kiwi with a few small clear ice cubes on a seamless pale-blue studio sweep, colour direction #B6E1FA. Show plausible fruit anatomy, translucent grapefruit flesh, moist pear surfaces, detailed kiwi seeds, and realistic ice with subtle melting droplets. Keep the main fruit grouping away from the frame edges. Use bright directional studio light, shadow edges with slight softness, sharp tactile detail across the main subjects, and controlled highlights. Keep the styling fresh, clean, playful, and restrained, with no extra props. Use natural fruit colours alongside the pastel blue background. Create new subjects and a new composition without copying source photographs. No people, text, letters, numbers, logos, labels, brand marks, watermarks, packaging, cards, phones, or app screens. Output one photograph, not a collage or graphic layout.
```

## Import after generation

From the repository root, run:

```powershell
node tools/reverse-brand/cli.js https://www.orbix.studio/case-studies/swipe-drinks-app --out out/www.orbix.studio --images manual --import --profile tools/reverse-brand/profiles/swipe.json --snapshot out/www.orbix.studio/snapshot.json --video --stills --verify
```

This rebuilds the generated guides and media using the existing capture, imports the supplied images as WebP, and reruns verification. It preserves PNG originals. The light `brand-guide.html` keeps its gradients; `brand-guide-hero.html` embeds the imported images. Review the outputs after import, including crops and attribution. The importer enforces an image budget for the 4 MB hero guide; overly complex images may require smaller or simpler source images before retrying.

Creating this prompt file makes no image-provider calls. Any charges from your chosen external generation tool remain separate and unknown to this CLI.
