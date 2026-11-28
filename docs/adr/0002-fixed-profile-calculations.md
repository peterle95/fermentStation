# Fixed profile calculations

Profile calculations are fixed ratios supplied with starter profiles, such as salt at 2% of cabbage weight, rather than formulas users write themselves. Users who are not comfortable with math, or who need cognitive accessibility, found the general formula builder too hard: they had to define terms in Settings, then combine a source, an operator, an operand and a result in the profile editor. Users now enter one quantity when starting a batch and read the result as a number with a plain-language instruction. The amount always follows the quantity: a batch's Recipe tab edits the quantity in place and recalculates as you type, and there is no per-batch override.

## Considered Options

- **General formula builder** (the previous design): flexible, but it required thinking in equations and code-style identifiers such as `totalWeight * 2%`.
- **Ratio sentences users write themselves** ("Use [2] % [salt] of [cabbage weight]"): easier than equations, but still asks users to write a calculation. It stays possible as a later step if users ask to change the ratio number.
- **Global formula term list in Settings**: removed. Names only matter inside a profile, and having to visit Settings before writing a profile was the biggest structural obstacle.

## Consequences

User-created profiles have no calculations unless they start as a copy of a starter profile. Adding a new kind of calculation means shipping it with the app, not configuring it. No general formula language remains, and since the app had no users when this was decided, no stored formulas needed to be migrated. Overrides saved before they were removed are ignored when a batch loads or an archive is imported.
