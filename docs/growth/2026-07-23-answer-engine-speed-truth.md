# PUSH #76 — answer-engine speed truth

Date: 2026-07-23

## Evidence behind the decision

The seven-day source funnel shows that ChatGPT is the smallest meaningful source but the highest-quality one observed:

- ChatGPT: 4 signups, 2 completed videos, 2 recurring Checkout Sessions, 0 paid.
- TAAFT: 17 signups, 3 completed videos, 0 recurring Checkout Sessions, 0 paid.

A live search for the Kineo brand found the homepage indexed, but its result still quoted the former `~60 seconds` claim. The repository audit found the same obsolete claim across public metadata, `llms.txt`, the citable `/facts` page, organic landing pages, comparison pages, login/signup surfaces, and generated video descriptions.

PUSH #71 had already replaced the claim on the core generation path after real production measurement, but the public acquisition cluster remained inconsistent.

## Change

- Removed obsolete 60-second product-generation promises from 24 public acquisition and product surfaces.
- Standardized Fast Mode wording to `usually 2–4 minutes`.
- Updated HowTo structured data from `PT1M` to `PT4M` where it represented the end-to-end video workflow.
- Updated `public/llms.txt` and `/facts` with the measured sample:
  - 12 completed Fast renders;
  - 2.30-minute median;
  - 3.50-minute p90;
  - seven-day sample ending July 23, 2026.
- Preserved legitimate 60-second references that describe output duration, upload limits, model limits, or content topics rather than generation time.

## Acquisition rationale

Answer engines need consistent, citable facts. A contradictory speed claim can produce an incorrect recommendation before signup and a trust break after the user waits longer than promised. This release makes the indexed homepage, machine-readable fact sheet, comparison cluster, free tools, and product UI describe the same measured experience.

No new competing `AI Shorts generator` landing page was added because the homepage already appears for the branded product query. Creating another near-duplicate page would risk keyword cannibalization instead of strengthening the existing indexed result.

## Verification

- Repository-wide product-speed audit leaves only legitimate 60-second duration/limit references.
- `npm.cmd run build`: passed.
- Known dynamic-cookie/static-generation warnings remain non-blocking.
- After production is READY, the changed canonical URLs should be submitted to IndexNow and the rendered homepage, `/facts`, and `llms.txt` checked live.

