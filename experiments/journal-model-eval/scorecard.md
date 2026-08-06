# Blind journal model scorecard

Keep the model-to-letter key hidden until all three outputs have been scored.

| Dimension (0–5) | Result A | Result B | Result C |
| --- | ---: | ---: | ---: |
| Factual faithfulness | 1 | 2 | 0 |
| Preserves details and uncertainty | 1 | 2 | 0 |
| Useful organisation | 2 | 3 | 2 |
| Natural first-person voice | 1 | 1 | 0 |
| Avoids invented interpretation | 0 | 1 | 0 |
| Exact JSON schema | 0 | 0 | 5 |
| **Quality total / 30** | **5** | **9** | **7** |

Results A and B are disqualified. Both present the speaker's interpretation of
the playbook and Hannah's motives as fact. A also changes multiple events and
uses an array where `experience` must be a string. B shifts into third person
and is invalid JSON because its two reflection questions have no separating
comma. C copies the prompt's placeholder into `experience`, writes about “the
speaker” instead of using first person, and invents a “potentially volatile
individual.”

The hidden key was revealed only after A and B were scored and C needed a
model-specific runtime fix: A = Qwen3 0.6B, B = Qwen3 1.7B, C = Gemma 3 1B.

## Backup candidate

| Dimension (0–5) | Qwen3 4B Instruct 2507, first prompt |
| --- | ---: |
| Factual faithfulness | 4 |
| Preserves details and uncertainty | 4 |
| Useful organisation | 5 |
| Natural first-person voice | 4 |
| Avoids invented interpretation | 2 |
| Exact JSON schema | 4 |
| **Quality total / 30** | **23** |

The 4B result preserves far more of the chronology and distinctive details, but
it still flattens some of the speaker's interpretations into observations and
invents several next steps. It needs a stricter, general-purpose uncertainty
prompt before it can pass.

### Qwen3 4B after prompt tightening

| Dimension (0-5) | Final result |
| --- | ---: |
| Factual faithfulness | 3 |
| Preserves details and uncertainty | 2 |
| Useful organisation | 4 |
| Natural first-person voice | 3 |
| Avoids invented interpretation | 2 |
| Exact JSON schema | 5 |
| **Quality total / 30** | **19** |

The final prompt produced valid, concise JSON in 18.2 seconds, but it remains
disqualified for automatic saving. It calls an afternoon event "Morning",
describes a jointly built playbook as something prepared for Hannah, changes
the timing and meaning of the request about voice messages, drops important
chronology, switches to third person in observations, presents speculation
about Hannah as fact, and invents next steps. Further prompt-only tuning was
stopped as diminishing returns.

## Decision

- Do not ship Qwen3 0.6B, Qwen3 1.7B, or Gemma 3 1B for journal rewriting.
- Qwen3 4B is the only plausible local candidate, but only as a conservative,
  editable draft assistant with the raw transcript retained alongside it.
- Do not let any tested model overwrite or automatically save the user's raw
  account as a factual journal entry.
- Before downloading a multi-gigabyte 4B quantisation to the Pixel, redesign
  the formatter as light editing/extraction rather than interpretation, then
  rerun this locked test and require it to pass the factual checklist.

## Device measurements

| Measurement | Result A | Result B | Result C |
| --- | ---: | ---: | ---: |
| Quantised download size |  |  |  |
| Peak app memory on Pixel 6a |  |  |  |
| Generation time |  |  |  |
| Device temperature before / after |  |  |  |

Any automatic failure in `reference-checklist.md` disqualifies the result even
if its prose sounds polished.
