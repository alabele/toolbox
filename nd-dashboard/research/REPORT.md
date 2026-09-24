# Designing a regulating work dashboard for an engineer who works best with low cognitive load

Research report, 2026-09-21. Generated from `build/data.js` by `build/build.js`. Interactive version: https://claude.ai/artifact/2EV6UqbsQ2xM4VVNCXbGEh

| Research runs | Claims extracted | Claims fact-checked | Refuted | Distinct sources |
|---|---|---|---|---|
| 7 | 715 | 175 | 0 | 80 |

**How to read this.** Each run extracts claims from sources and sends at most 25 to three independent fact-checkers. A claim is dropped if two of three refute it. Findings below survived that check. Recommendations marked *reasoning* are extrapolation from checked principles. Section 5 lists what was never checked. Raw verifier output is in the `pass*-raw.json` files.

**The main limit.** Nearly every study used neurotypical people, children, or students. No checked source studied the exact profile this tool is built for. Treat findings as starting defaults. The user's own reaction outranks them.

## 1. Findings

### High confidence

**F1. Interruptions should be rare and under your control.** W3C cognitive accessibility guidance says to avoid interruptions and give easy control over reminders and changing content. Sounds and content that appears or changes can make people abandon a task, even an important one. *Limits:* Expert consensus, not a study. Its named populations are dementia and brain injury, so applying it to ADHD and autism is a stretch, though a reasonable one. [W3C, Making Content Usable (COGA), pattern 4.6.1](https://www.w3.org/TR/coga-usable/)

**F2. Motion off by default.** The accessibility standard requires that animation triggered by interaction can be switched off. W3C says to avoid unnecessary animation and honor the system reduce-motion setting. *Limits:* A standard at the strictest level, not a sensory study. [WCAG 2.3.3, Animation from Interactions](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions)

**F3. Autistic adults report more sensory overload in every sense, including vision.** Survey of 221 autistic and 181 non-autistic adults. Over-responsivity rose with autistic traits in both groups. The population matches you. *Limits:* Self-report. It supports having intensity controls. It does not support any particular color, font, or layout. [Tavassoli et al., Autism, 2014](https://doi.org/10.1177/1362361313477246)

**F4. Polyvagal theory is openly disputed.** *Contested.* In February 2026 a group of physiologists published a paper calling the theory untenable. The author's reply in the same issue offers no new data in its abstract. *Limits:* The confidence is that it is contested. Neither side has won. [Porges, reply to Grossman et al., Clinical Neuropsychiatry, 2026](https://www.clinicalneuropsychiatry.org/download/when-a-critique-becomes-untenable-a-scholarly-response-to-grossman-et-al-s-evaluation-of-polyvagal-theory/)

**F23. Planning-skills programs work for adults with ADHD, as a whole package.** Two randomized trials against active comparisons, plus two pooled analyses. Programs that teach one calendar plus one task list, prioritizing, breaking tasks down, and parking distractions reduce symptoms. The benefit is moderate against an active comparison and larger against a waiting list. This is the best-evidenced support for what the dashboard is for. *Limits:* No trial tested any single technique alone. Both trials were run by the people who designed the treatment. One sample was all medicated. Untested for autistic adults. [Safren 2010 (JAMA); Solanto 2010; Cochrane review 2018](https://jamanetwork.com/journals/jama/fullarticle/186469)

**F24. What those programs actually teach.** A calendar plus a task list as the first step. Prioritizing and scheduling. Breaking an overwhelming task into steps. Writing a distraction down instead of acting on it, then returning. Rewarding yourself for unpleasant tasks. Timing your own attention span and sizing work blocks to it. *Limits:* High confidence applies to the description only. There is no evidence for any one technique by itself. [Safren 2010; Solanto 2010; Cochrane review 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC6494390/)

**F27. “More options is always worse” is not supported.** *Contested.* Two independent pooled analyses agree that the average effect of offering more options is near zero. Researchers who set out to find choice overload often did not. *Limits:* Neurotypical shoppers and students choosing products, not work tasks. A near-zero average does not mean overload never happens. See the next finding. [Scheibehenne et al. 2010; Chernev et al. 2015](https://chernev.com/wp-content/uploads/2017/02/ChoiceOverload_JCP_2015.pdf)

**F29. “Decision fatigue” as a draining willpower budget did not replicate.** *Contested.* A preregistered test across 36 labs with 3,531 people found an effect near zero. The authors include proponents of the original theory. *Limits:* Mostly students on lab tasks. The result supports “near zero or very small,” not “disproven.” Untested in ADHD or autistic adults. [Vohs et al., 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC12422598/)

**F31. Autistic adults spend more visual effort on pages, and clutter makes it worse.** Two eye-tracking studies. Autistic participants looked at more elements and more irrelevant ones, especially when pages were visually complex or regions were hard to tell apart. The authors conclude: keep it simple. *Limits:* Same research group, 18 or 19 people per group, few pages. No number for how many elements is too many. Does not transfer to ADHD. [Eraslan, Yaneva, Yesilada, Harper, 2019 and 2021](https://doi.org/10.1007/s10209-020-00708-9)

**F32. Dark text on a light background is more legible than the reverse.** A controlled experiment found the advantage for both sharpness of vision and proofreading, in younger and older adults. *Limits:* Neurotypical adults, legibility only. It says nothing about comfort, fatigue, or sensory load, so preferring dark mode is a legitimate reason to override it. [Piepenbrock et al., Ergonomics, 2013](https://pubmed.ncbi.nlm.nih.gov/23654206/)

**F33. Dyslexia fonts give no reading benefit.** Two independent studies found no gain in speed or accuracy over Arial or Times. Children tended to prefer Arial. *Limits:* Children with dyslexia, reading on paper. Nothing checked covers other typefaces, line length, or spacing. [Kuster et al. 2018; Wery and Diliberto 2017](https://link.springer.com/article/10.1007/s11881-017-0154-6)

**F34. A widely cited review of autism design guidelines contains no tested guidelines.** It reviewed 94 studies of technology for teaching autistic people. Only about a quarter said anything about usability, and the authors note that accessibility claims were not backed by evidence. *Limits:* So widely shared autism design advice is practitioner consensus, not tested findings. [Valencia et al., Sensors, 2019](https://doi.org/10.3390/s19204485)

**F36. The ambient-display literature is design theory, not outcome evidence.** The key papers define a useful vocabulary: status should sit at “change-blind” or “make-aware,” and only critical items may interrupt. They tested whether heuristics find usability problems, not whether the displays help anyone. *Limits:* Nothing checked shows that a peripheral status display beats notifications. The menubar idea stays as reasoning. [Pousman and Stasko 2006; Mankoff et al. 2003](https://faculty.cc.gatech.edu/~john.stasko/papers/avi06.pdf)

**F39. Autistic burnout is described consistently.** Two studies define it the same way: chronic exhaustion, loss of skills, lower tolerance for stimulation, withdrawal, and more trouble with executive function. Tasks that were easy last month may not be now. *Limits:* Definitions are provisional and based on self-report. General autistic adults. [Raymaker et al. 2020; Higgins et al. 2021](https://pubmed.ncbi.nlm.nih.gov/32851204/)

**F43. Emotional dysregulation in adult ADHD is large and well replicated.** A pooled analysis of 13 studies found a very large difference from controls. In focus groups, “zero to one hundred” reactions to things the person knew were minor came up in every group, and insight did not prevent them. *Limits:* Results vary a lot between studies and publication bias is likely. Official diagnostic criteria treat it as an associated feature, not a core one. ADHD-only adults. [Beheshti et al. 2020; Ginapp et al. 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC7069054/)

**F49. Resuming interrupted coding is slow and almost always means rebuilding context.** Logs from 86 programmers. Only 10% of sessions had a first edit within a minute, and about 30% took over half an hour. Only about 7% of sessions began editing without first navigating around other code. *Limits:* Logs from 2005 to 2008. Interruption is inferred from gaps in activity. Developers of unknown neurotype. [Parnin and Rugaber, 2011](https://chrisparnin.me/pdf/parnin-sqj11.pdf)

**F61. Brain scans show real but small dopamine differences in adults with ADHD.** In 53 unmedicated adults with ADHD, markers in reward-pathway regions were roughly 6 to 11 percent lower than in controls, with overlapping ranges. Links to attention and to trait motivation were modest. It is reasonable to make progress and payoff visible and near-term. *Limits:* Correlational, one site. It does not show that dopamine causes low motivation, and the wider scan literature is inconsistent. [Volkow et al., JAMA 2009 and Molecular Psychiatry 2011](https://pubmed.ncbi.nlm.nih.gov/19738093/)

**F63. Heart-rate biofeedback reduces self-reported stress and anxiety.** Two independent pooled analyses agree, one covering 58 randomized trials. The effect is small to moderate and no better than other effective treatments. An optional breathing or heart-rate aid is defensible as a calming tool. *Limits:* General and clinical populations, not ADHD or autistic adults. Self-reported outcomes, and many comparisons were against doing nothing. [Goessl et al. 2017; Lehrer et al. 2020](https://pubmed.ncbi.nlm.nih.gov/32385728/)

### Medium confidence

**F5. For engineers with ADHD, starting and finishing are the hard parts, and rebuilding context is very costly.** Interviews with 19 software engineers with ADHD. One said loading a code structure into mind takes almost an hour and a casual interruption destroys it. 11 of 19 struggled to start and finish: “the first 5 percent are impossible… last 15 percent is like torture.” *Limits:* One study, self-report. The hour figure is one person. The authors do not claim this is unique to ADHD. [Liebel, Langlois, Gama, ICSE 2024](https://arxiv.org/pdf/2312.05029)

**F6. Do not rely on memory.** The W3C guidance says people with impaired working memory may hold one to three items, and that no process should depend on remembering an earlier step. *Limits:* The guidance gives no citation for the one-to-three figure. A later run found that a hard cap on visible items is not supported by the choice research (F27), so treat any cap as a setting. [W3C COGA, Objective 6](https://www.w3.org/TR/coga-usable/)

**F7. Hold notifications until a task boundary.** Controlled study, 16 people doing programming and diagram editing. Waiting for a natural breakpoint delayed notifications by about 90 seconds on average. *Limits:* The drop in frustration was significant for diagram editing, not for programming. Neurotypical participants. [Iqbal and Bailey, CHI 2008](https://dl.acm.org/doi/10.1145/1357054.1357070)

**F8. Interruptions cost stress, not output.** Lab experiment, 48 people. Interrupted work finished in less time with no more errors. But within 20 minutes, stress, frustration, time pressure, and effort were all significantly higher. You can look productive while your stress climbs. *Limits:* Students doing an email task. Neurotypical. [Mark, Gudith, Klocke, CHI 2008](https://ics.uci.edu/~gmark/chi08-mark.pdf)

**F9. Being relevant does not excuse an interruption.** *Contested.* One study suggests relevant notifications can come at an earlier breakpoint. Another found same-topic and different-topic interruptions cost the same. Only urgency should break through. *Limits:* The two studies pull in different directions, and the wider literature is mixed. [Iqbal and Bailey 2008; Mark et al. 2008](https://ics.uci.edu/~gmark/chi08-mark.pdf)

**F10. Less time in email is better, but checking on a schedule did not lower stress.** *Contested.* Twelve-day field study, 40 office workers wearing sensors. More email time went with higher measured stress. Batching did not lower it. People who checked by choice did better than people who responded to alerts. *Limits:* Observational. Fact-checkers recalled two experiments that did find a benefit, but never verified them. No batching interval has checked support. [Mark et al., CHI 2016](https://dl.acm.org/doi/10.1145/2858036.2858262)

**F11. Alerts raise self-reported inattention and restlessness.** A randomized field experiment. A week with phone alerts on produced more inattention and hyperactivity than a week with alerts off. *Limits:* 221 undergraduates without ADHD diagnoses. Small differences. Alerts-off was bundled with phone-out-of-sight. The authors do not claim this treats ADHD. [Kushlev, Proulx, Dunn, CHI 2016](https://dl.acm.org/doi/10.1145/2858036.2858359)

**F12. The ADHD sensory profile is mixed, not just oversensitive.** A 2025 analysis of 30 studies found large elevations in all four patterns at once: sensitive, avoiding, under-registering, and seeking. One muted theme may under-serve you. *Limits:* 23 of the 30 studies are in children. Results vary a lot between studies. [Jurek et al., JAACAP, 2025](https://www.sciencedirect.com/science/article/pii/S0890856725002096)

**F13. Developers rarely watch agents live. They review afterward.** Interviews with 17 experienced developers found four kinds of oversight: limits before launch, planning together, live monitoring, and review afterward. Most never read reasoning traces on their own initiative. *Limits:* 12 of 17 from one company, handing off small tasks. May not hold for one person running many long sessions, which is you. [Dhanorkar, Passi, Vorvoreanu, FAccT 2026](https://arxiv.org/html/2606.05391v1)

**F14. Outcome checklists make review faster, not more accurate, and raise over-trust.** Study of 12 people. Step-by-step traces were overwhelming and small, important errors got missed. A requirements checklist with the agent's assumptions made finding errors faster. Accuracy did not improve. Confidence rose even on wrong answers. *Limits:* It studied an agent answering questions on a computer, not a coding agent. [Grunde-McLaughlin et al., preprint, 2026](https://arxiv.org/pdf/2602.16844)

**F15. Slow paced breathing reliably shifts heart-rate variability.** Analysis of 223 studies. The effect shows during a session, right after, and after repeated practice. *Limits:* Heart-rate variability is a stand-in measure. The review does not show less stress or better thinking. General population. [Laborde et al., Neuroscience and Biobehavioral Reviews, 2022](https://www.sciencedirect.com/science/article/abs/pii/S0149763422002007)

**F16. Differences in sensing your own body are small in autism, not a global deficit.** Analysis of 15 studies found slightly lower accuracy at counting heartbeats alongside higher confidence in that ability. *Limits:* The authors suspect the counting difference may be an artifact of the test. Nothing on ADHD was checked. [Williams et al., J Autism Dev Disord, 2022](https://link.springer.com/article/10.1007/s10803-022-05656-2)

**F25. People with ADHD show real timing deficits, but narrower than “time blindness” suggests.** A pooled analysis of 55 studies found deficits in judging, estimating, and reproducing durations. *Limits:* The studies are weighted toward children and measure intervals of seconds, not the hours of a workday. Nothing checked shows that timers or elapsed-time displays help. [Marx et al., JAACAP, 2022](https://www.sciencedirect.com/science/article/abs/pii/S0890856721020451)

**F26. A far-off deadline is weak motivation in ADHD.** A pooled analysis of 37 comparisons found people with ADHD choose small immediate rewards over larger delayed ones more often. Real rewards had about double the effect of hypothetical ones. *Limits:* Mostly children and adolescents. The link from lab reward choices to work priorities is a stretch. [Marx et al., J Atten Disord, 2021](https://journals.sagepub.com/doi/10.1177/1087054718772138)

**F28. Choice overload does happen under four conditions.** Complicated options. A hard decision. Not knowing your own preferences. Just wanting to get started with little effort. So fix those conditions instead of counting items: consistent item format, no time pressure while choosing, priorities decided earlier in a calm moment, and one pre-picked next task. *Limits:* One pooled analysis, conditions coded after the fact. Neurotypical samples choosing products. [Chernev, Böckenholt, Goodman, 2015](https://chernev.com/wp-content/uploads/2017/02/ChoiceOverload_JCP_2015.pdf)

**F35. Adults with ADHD show stronger visual crowding, and one color cue reduces it.** 22 adults with ADHD had more trouble identifying a letter surrounded by similar letters. Showing the target in red helped everyone. This supports generous spacing around key status marks and one sparing accent color. *Limits:* One small lab study on split-second letter recognition, not interfaces. No spacing values you can apply. [Ifrah-Tsruya et al., Vision Research, 2026](https://pubmed.ncbi.nlm.nih.gov/42308563/)

**F40. People tie burnout to cumulative load and masking, and recovery to lower expectations.** Participants named long-term masking most often, combined with expectations that outweigh abilities. They linked recovery to acceptance, time off or reduced expectations, and doing things in an autistic way. *Limits:* These are participants' own explanations, not tested causes. [Raymaker et al. 2020; Higgins et al. 2021](https://journals.sagepub.com/doi/10.1177/13623613211019858)

**F41. Burnout overlaps heavily with depression, and its link to masking is only moderate.** *Contested.* In 238 autistic adults, burnout scores tracked depression, anxiety, stress, and fatigue closely. Whether burnout is distinct from depression was not settled. So a tool should never name or diagnose a state from how you use it. *Limits:* One self-report sample using an unpublished measure. [Mantzalas et al., Autism Research, 2024](https://onlinelibrary.wiley.com/doi/full/10.1002/aur.3129)

**F44. Work feedback is a reported trigger for rejection sensitivity.** *Contested.* Young adults with ADHD named negative work feedback and perceived rejection online as triggers, describing rumination, self-blame, and physical distress. *Limits:* One qualitative study, mostly young women recruited from online ADHD communities. “Rejection sensitive dysphoria” remains an unvalidated popular term. [Ginapp et al., PLOS ONE, 2023](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0292721)

**F45. About four in ten autistic people also have ADHD, and the combination is harder.** A pooled analysis puts ADHD among autistic people at 38.5%. Across 34 studies, the combination went with more impairment than autism alone. So expect to need more support than either literature suggests by itself. *Limits:* Mostly children in clinical settings. No evidence says which supports work for the combined profile or for gifted adults. [Rong et al. 2021; Rosello et al. 2022](https://journals.sagepub.com/doi/abs/10.1177/13623613211065545)

**F47. “Gifted means perfectionist” is not supported.** Across 10 studies, gifted students did not differ in self-critical perfectionism. They had modestly higher standards. So high standards are not a problem to be managed. *Limits:* Every sample is students. No adults, no twice-exceptional people. [Stricker et al., 2020](https://link.springer.com/article/10.1007/s10648-019-09504-1)

**F48. Procrastination tracks self-criticism, not high standards.** Pooled across about 10,000 people, procrastination rose with self-critical perfectionism and fell with high standards. So soften the sense of being judged and leave ambition alone. *Limits:* Small correlations, mostly students. ADHD procrastination may have other drivers. [Sirois, Molnar, Hirsch, 2017](https://eprints.whiterose.ac.uk/id/eprint/112533/)

**F50. An automatic activity trail beat handwritten notes for resuming.** In a controlled lab study, developers given an automatically captured cue finished interrupted tasks at about twice the rate of those with notes alone. They strongly preferred a timeline of recent activity shown as code snippets. *Limits:* One 2010 study, small sample, never replicated. [Parnin and DeLine, CHI 2010](https://doi.org/10.1145/1753326.1753342)

**F51. Developers already leave themselves deliberate roadblocks.** In a survey of 414 programmers, 77% tracked task state in notes. Many leave an intentional compile error so they cannot miss where they stopped. *Limits:* Self-report, mostly one company, around 2009. [Parnin and Rugaber, 2011](https://doi.org/10.1007/s11219-010-9104-9)

**F52. Few projects per day beats many, but there is no magic number.** Developers who contribute to many projects were more productive on days they focused on few. Heavy switching within a day hurt more as the total number of projects rose. *Limits:* Mined GitHub data, output measured in code volume. No threshold for “too many” was verified. [Vasilescu et al., ICSE 2016](https://doi.org/10.1145/2884781.2884875)

**F53. Switching by your own choice may hurt more than being interrupted, and developers believe the opposite.** In 4,910 recorded tasks from 17 developers, self-interruptions were more disruptive than external ones. Most of 132 developers surveyed believed the reverse. Time of day and type of interruption mattered more than task priority. *Limits:* One small study, never replicated. It does not test whether this is stronger in ADHD. [Abad et al., 2018](https://arxiv.org/abs/1805.05508)

**F54. A day feels productive when you make progress on planned goals, not when it was unfragmented.** 379 developers named finishing or progressing tasks, and getting into flow, as what makes a good day. Observed developers switched about 13 times an hour and most still felt productive. A switch to a different task costs far more than a quick email. *Limits:* Perceptions, not measured output. So a raw switch count is a poor headline number. [Meyer et al., FSE 2014](https://thomas-zimmermann.com/publications/files/meyer-fse-2014.pdf)

**F55. Unfinished tasks do not stay in mind better, but there is a real pull to resume them.** *Contested.* A 2025 pooled analysis found no memory advantage for unfinished tasks. The tendency to return to an interrupted task did hold up. *Limits:* So store everything outside your head, and use the pull: show a partly-done task with an obvious next step. Mostly older lab studies of students. [Ghibellini and Meier, 2025](https://doi.org/10.1057/s41599-025-05000-w)

**F57. Measuring an activity can raise output while lowering enjoyment and staying power.** Six experiments. Counting made people do more but enjoy it less, because attention to output made enjoyable activities feel like work. *Limits:* Students doing leisure tasks. The cost may be smaller for things already framed as work. [Etkin, J Consumer Research, 2016](https://doi.org/10.1093/jcr/ucv095)

**F58. How a streak is displayed changes what you do next, regardless of what you actually did.** Seven studies. Highlighting a broken streak lowered later engagement compared with highlighting an intact one. The effect was worse when the break felt like your fault and smaller when the streak could be repaired. *Limits:* General consumers in short online experiments. Nothing on ADHD or autistic adults. [Silverman and Barasch, 2023](https://doi.org/10.1093/jcr/ucac029)

**F59. Engineers with ADHD cope mainly by getting things out of their heads.** In the same interview study as F5, 11 of 19 relied on to-do lists, calendars, sticky notes, or exhaustive notes. 4 of 19 had built their own support tools. One said: “If I can’t see it, I’m not going to remember it.” So keep commitments visible, make capture nearly effortless, and make the dashboard scriptable. *Limits:* This shows how common the strategy is, not that it works. ADHD-only sample. [Liebel, Langlois, Gama, ICSE 2024](https://arxiv.org/abs/2312.05029)

**F60. The founding study of neurodivergent engineers is small and from one company.** It interviewed 10 neurodivergent tech workers and surveyed 846 engineers, of whom about 7% identified as neurodivergent. Treat its lists of challenges and strengths as hypotheses to check against your own experience, not as norms. *Limits:* Only the study design was verified. None of its actual findings on challenges or accommodations reached fact-checking. [Morris, Begel, Wiedermann, ASSETS 2015](https://doi.org/10.1145/2700648.2809841)

**F62. There is no agreed dopamine account of ADHD, and nothing supports “dopamine menus” or “dopamine detox”.** *Contested.* A pooled brain-imaging analysis found a medium reduction in reward anticipation in ADHD. But a major review compares seven competing models with inconsistent findings. No checked source tested the dopamine menu, dopamine detox, or the “interest-based nervous system.” *Limits:* Mostly children and adolescents. A personal list of energizing activities is fine as a preference. Keep brain-chemistry language out of the interface. [Plichta and Scheres 2014; Luman, Tripp, Scheres 2010](https://pubmed.ncbi.nlm.nih.gov/23928090/)

### Low confidence

**F17. Autistic inertia: reminders do not help, one gentle prompt at a natural break can.** Focus groups with 32 autistic adults. Trouble starting, stopping, and switching felt outside conscious control, even for things they enjoy. Alarms and reminders typically did not overcome it. Stress made it worse. The authors advise giving all the information needed to decide at the moment of asking. *Limits:* One exploratory study. The advice was never tested. Says nothing about ADHD. [Buckle et al., Frontiers in Psychology, 2021](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2021.631596/full)

**F18. A few fixed states and collapsed-by-default are precedents, not proven.** One research prototype hides everything below top-level goals. One terminal tool reduces each session to five states with a key that jumps to the next one needing you. *Limits:* No user studies. The terminal tool tells two states apart by color alone, which a sensory-safe design must never do. [OrchVis preprint; fleet](https://github.com/eylonronen/fleet)

**F19. Body doubling is widely used. Whether it works is not established.** Survey of 220 people. Remote, recorded, and stranger doubles are all in use. *Limits:* Self-selected survey with no measured outcomes. Controlled studies are mixed to null. [Eagle, Baltaxe-Admony, Ringland, ACM TACCESS, 2024](https://dl.acm.org/doi/full/10.1145/3689648)

**F20. Monotropism supports single-focus modes as lived experience, not as measured evidence.** The theory describes autistic attention as pulled deeply into few interests, with forced switches felt as “a wrench each time.” *Limits:* The source is a 1992 theoretical paper with no data. Later measured support is thin. [Murray, Attention tunnelling and autism](https://monotropism.org/dinah/attention-tunnelling-and-autism/)

**F21. If-then plans helped children with ADHD on a lab task.** Children who added an if-then plan matched children without ADHD on an impulse-control task. *Limits:* Children, one lab task, 2008. No evidence for adults or for getting started. Cheap and harmless to try. [Gawrilow and Gollwitzer, 2008](https://link.springer.com/article/10.1007/s10608-007-9150-1)

**F22. ADHD professionals want quiet, adjustable, non-judgmental support.** About 25 people surveyed. They liked weekly summaries, gentle reminders, and quiet check-ins. They rejected intrusive automation and were wary of gamification, hard deadlines, and performance tracking. One wanted no suggestions at all. *Limits:* A single-author preprint. The tool it proposes was never built or tested. [Deshmukh, preprint, 2025](https://arxiv.org/pdf/2507.06864)

**F30. Autistic adults report more decision avoidance.** 38 autistic and 40 non-autistic adults. The autistic group reported more decision problems and a more avoidant decision style. This supports a default next task you can accept without deciding. *Limits:* One small 2012 study, self-report. Says nothing about ADHD or about whether the number of options is the cause. [Luke et al., 2012](https://pubmed.ncbi.nlm.nih.gov/21846664/)

**F37. Ten minutes of nature photos did nothing for attention.** 60 young adults. No difference from city photos on accuracy, speed, or a brain measure of error monitoring. *Limits:* One possibly underpowered study of neurotypical adults. It does not show nature imagery never helps. [Collins et al., 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC12209298/)

**F38. “Autistic people dislike yellow” rests on one study of boys.** 29 French boys with autism preferred yellow cards less often than other boys did. *Limits:* Children, boys only, physical cards. There is no evidence-based color rule for adults. Let your own preference decide. [Grandgeorge and Masataka, 2016](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5179595/)

**F42. Masking is linked to feeling defeated and trapped.** The measured effect is small. The design lesson is to avoid anything that feels inescapable: backlogs that only grow, overdue piles with no way out. *Limits:* 180 undergraduates with autistic traits, not diagnosed adults. A big population jump. [Cassidy et al., 2023](https://onlinelibrary.wiley.com/doi/full/10.1111/sltb.12965)

**F46. Having both can feel like two contradictory sets of needs.** Six women diagnosed as adults described autism and ADHD as “two separate parts of my brain”: novelty against sameness, stimulation against calm, changing day to day. *Limits:* Six people, one study, the first of its kind. Not generalizable. [Craddock, 2025](https://journals.sagepub.com/doi/10.1177/13634593251336163)

**F56. A specific, sincere plan quieted intrusive thoughts about unfinished goals.** In lab studies, unfinished goals intruded on unrelated work. Making a specific plan removed the effect, but only for people who meant to carry it out. *Limits:* A 2011 social-psychology paper with small samples. Its replication status could not be checked. [Masicampo and Baumeister, 2011](https://europepmc.org/article/MED/21688924)

**F64. Evidence that heart-rate biofeedback helps ADHD, autism, or executive function is weak.** The ADHD study had no control group, combined two treatments, and was written by the commercial provider's staff. The autism study was a pilot with about 8 completers per group. *Limits:* Do not present a biofeedback feature as improving attention or executive function. Let yourself rate before and after to judge its value to you. [Groeneveld et al. 2019; Coulter et al. 2022; Tinello et al. 2022](https://pubmed.ncbi.nlm.nih.gov/35299845/)

## 2. Design principles

1. **Pull, not push.** Nothing appears, moves, sounds, or badges unless you asked, or it is an emergency you defined. Add a one-keystroke inbox for the urge to switch, since switching by choice may cost more than being interrupted. (F1, F8, F10, F11, F53)
2. **Release at boundaries.** Queued items surface at a commit, a finished test run, a session ending, or when you say you are between things. A maximum wait stops anything being held forever. (F7, F9, F17)
3. **Nothing depends on remembering.** Every session, repo, and ticket carries what it was for and where you left off. Capture an automatic trail of recent activity per task, because it beats remembering to write notes. Make capture nearly effortless and the dashboard scriptable. (F5, F6, F49, F50, F55, F59)
4. **Park and resume.** One keystroke parks a task with a concrete next step, and that step is the unavoidable first thing you see on return. A sincere plan also quiets the nagging feeling. (F17, F20, F51, F56)
5. **Help with the first 5% and the last 15%.** A concrete first action on every item, and an explicit finish list. Offer “make a bad version first,” because stalling tracks self-criticism, not high standards. (F5, F17, F48)
6. **One pre-picked next task, decided earlier.** Set priorities in a calm planning moment, not at the moment of starting. Offer a default you can accept without deciding. Any cap on visible items is a setting, since more options is not reliably worse. (F23, F24, F27, F28, F30)
7. **Few projects per day.** A today view limited to a small number of projects you choose. Soft, never a hard block, and no number presented as research-backed. (F52)
8. **State first for agents, tests as the gate.** One row per agent with a fixed word and shape for its state, sorted by what needs you. Checklists raise confidence without raising accuracy, so tests stay the real gate. (F13, F14, F18)
9. **Low density, clear regions, intensity as a dial.** Few elements per view, regions that are easy to tell apart, generous space around status marks, one sparing accent. Separate controls for color, contrast, density, and motion. Never color alone. (F2, F3, F12, F31, F35)
10. **An emotionally flat opening view.** No red badges, alarm icons, or surprise bad news on load. Anything evaluative sits behind a deliberate click. Review feedback appears as a neutral task, batched, with no reviewer name. (F43, F44)
11. **Every stuck state has an exit.** Drop, defer, shrink, or hand off, worded as normal choices. No backlog that only grows. No age shown on your own stalled tasks. Age displays are for agent sessions only. (F40, F42, F48)
12. **A first-class low-capacity mode.** One switch shrinks the view and rescopes the day without comment. The tool never names or diagnoses a state, and no diagnostic language appears anywhere. Keep the frame stable and let the content vary. (F39, F40, F41, F46)
13. **Progress on planned goals is the feedback.** Show progress on a few goals you planned today. Measure sparingly and only by choice. Make progress and payoff visible and near-term. No streaks that reset to zero, and no raw switch count as a headline. (F8, F22, F26, F54, F57, F58, F61)
14. **Invitations, never demands.** Every nudge can be dismissed, tuned, or switched off completely. One prompt, never escalating. (F17, F22)
15. **Show outside cues for your state.** Show elapsed time and time since your last break, because your felt sense of both may be unreliable. Your own check-ins still count. (F16, F25, F26)
16. **Regulation features stand on their own evidence.** A breathing or heart-rate aid you start yourself is fine as a calming tool. Nothing is built on vagal states, willpower budgets, or dopamine stories, and no brain-chemistry language appears in the interface. (F4, F15, F29, F62, F63, F64)

## 3. Recommendations by area

### Claude sessions — evidence

Has direct evidence, plus features confirmed on your machine.

1. Do not rebuild the built-in session view. Use it for drilling in.
2. Get session state from lifecycle hooks plus the JSON list. Reading terminal text breaks whenever the tool updates.
3. Five states, each with a word and its own shape: working, needs permission, needs an answer, finished with output, failed.
4. Each row shows the goal, the last thing the agent did, the repo, and time in that state as a bar. Time-in-state is for agents only, never for your own tasks.
5. A blocked agent goes in the queue by default. You can mark a session urgent when you launch it. Treat this as a setting to tune.
6. Three sessions waiting on permission show as one line with a count.
7. A review panel per finished session: requirements marked pass, unknown, or fail, the agent's stated assumptions, and test status shown as the real gate.
8. Long-forgotten sessions surface gently at a boundary with “resume, park, or end.” No red, no age.

### Many repos — evidence

Now has evidence from studies of developers generally. None studied neurodivergent developers.

1. Capture an automatic activity trail per task: recent edits, files, commits, commands. Show it as a timeline when you return.
2. Reopen each task at the exact place you last edited, with the surrounding files one step away.
3. One keystroke to park: it records your next step and shows it first when you come back, like a deliberate compile error.
4. A today view limited to a few projects you choose. Soft, not a hard block.
5. Group your 70 session folders by the repo underneath. Most are review-loop copies of a few repos.
6. A single-focus mode: one repo and its sessions, everything else hidden.

### Priorities — evidence

The overall approach has trial evidence in adults with ADHD. Individual techniques do not.

1. One calendar plus one task list is the single source of truth. This is the first thing the trial-tested programs teach.
2. Decide priorities in a short, calm planning moment. At start time, the dashboard offers one pre-picked task you can accept without choosing.
3. Break a task into steps at the moment it feels overwhelming, not in advance.
4. Every item carries a concrete first action, like “open the PR diff.” Offer “make a bad version first.”
5. Size work blocks to your own measured attention span, not a fixed interval.
6. Let yourself attach a small real reward to an unpleasant task. Real rewards work about twice as well as symbolic ones.
7. Any cap on visible items or things in progress is a setting you tune. The research does not support a fixed number.
8. Do not build anything on a daily willpower or decision budget. That idea did not replicate.

### Jira tickets — reasoning

My reasoning from the checked principles. No study covered ticket tools.

1. Show only your tickets, in three states: ready, in progress, waiting on someone else. Hide the backlog.
2. Tickets you started and left surface at a boundary as “still yours? shrink, park, or hand back.” No age, no overdue styling.
3. Each ticket links its repo, branch, pull request, and any agent session working on it.
4. A finish list per ticket for the last 15%: PR merged, ticket moved, QA notes written, reviewer told.
5. Changes to a ticket take one keystroke. The confirmation shows everything you need to decide.

### Messages — evidence

Part evidence, part reasoning. No study covered Slack or PR review for neurodivergent people.

1. Slack, review requests, and email never notify through the dashboard. They fill a queue you open by choice.
2. Review feedback appears as a neutral task, like “2 threads to respond to.” Batched, opened on demand, no reviewer name, no tone.
3. Never show a tally of people waiting on you, and never anything comparing you with teammates. Order by who is blocked, without displaying it.
4. Limit total time in the queue with a visible timer. Do not promise a schedule, since batching alone did not lower stress.
5. A quiet state you can trust: “Nothing needs you,” with the time it last checked.
6. An emergency path you define yourself, by person or keyword. It is the only thing allowed through mid-task.
7. Draft-and-park for replies you are avoiding, since starting the reply is the hard part.

### Form factor — reasoning

Decided 2026-09-22: a local web app. The evidence was neutral on form factor; the decision rests on the distinguishability findings and on the user's own report that everything in the terminal looks the same.

1. A local web app in TypeScript, served by a small local process that polls Claude Code sessions, receives hook events, and talks to GitHub, Jira, and Slack.
2. Installed as a standalone window through Safari or Chrome, with its own Dock icon and no browser chrome, so it is not one tab among forty.
3. Not a terminal app. Identical monospace panes are exactly the hard-to-distinguish regions that cost autistic adults the most visual effort (F31) and that crowd together for adults with ADHD (F35).
4. Every session and repo gets a visual identity you can tell apart at a glance: a name, a stable position, a shape, and a color band. Never color alone.
5. It pulls at boundaries and holds still while you read. The earlier warning against web dashboards was about always-updating, not about the web.
6. Default to dark text on a dimmed off-white, which is more legible. Offer dark mode as a choice, because comfort was never studied.
7. Later, if a menubar count or native notifications prove wanted, wrap the same app in Tauri. Nothing is thrown away.

## 4. What Claude Code already provides

Confirmed on Claude Code 2.1.278. `claude agents` is a built-in multi-session view sorted by what needs you, with in-place replies and a recap on reattach. `claude agents --json` lists live sessions with state and working directory and needs no terminal. Lifecycle hooks (`Notification` with permission and idle types, `Stop`, `SessionEnd`, and an HTTP hook type) push events from every repo when set at user scope. Build on these. Do not parse transcripts or scrape terminal text.

## 5. Coverage

**Checked:** Interruptions and control [F1, F8]; When to deliver notifications [F7]; Relevant vs irrelevant interrupts (contested) [F9]; Email and batching (contested) [F10]; Alerts and attention [F11]; Self-interruption [F53]; Planning programs for adult ADHD [F23, F24]; Choice overload (contested) [F27, F28]; Decision fatigue (contested) [F29]; Timing and delay in ADHD [F25, F26]; Starting and finishing tasks [F5]; Working memory limits [F6]; Resuming interrupted coding [F49, F50, F51]; Many projects at once [F52]; What makes a day feel productive [F54]; Unfinished-task effects (contested) [F55, F56]; Overseeing coding agents [F13, F14]; Emotional dysregulation in ADHD [F43]; Rejection sensitivity (contested) [F44]; Autistic burnout [F39, F40, F41]; Autism and ADHD together [F45, F46]; Perfectionism and giftedness [F47, F48]; Self-tracking and streaks [F57, F58]; Page clutter for autistic adults [F31]; Light vs dark mode [F32]; Fonts [F33]; Visual crowding in ADHD [F35]; Motion and animation [F2]; Sensory overload in autism [F3]; ADHD sensory profile [F12]; Polyvagal theory (contested) [F4]; Dopamine framing of ADHD (contested) [F61, F62]; Heart-rate biofeedback [F63, F64]; Engineers with ADHD [F5, F59]; Paced breathing [F15]; Body sensing in autism [F16].

**Checked, weak evidence:** Autistic inertia [F17]; Other neurodivergent developers [F60]; Decision avoidance in autism [F30]; Masking and its costs [F42]; Agent dashboard patterns [F18]; Body doubling [F19]; Monotropism [F20]; If-then plans [F21]; Gentle nudges [F22]; Autism design guidelines [F34]; Ambient displays [F36]; Nature imagery [F37]; Color preferences in autism [F38].

**Never checked:** Timers and time aids; Work-in-progress limits and kanban; Eisenhower, MoSCoW, Getting Things Done; Body sensing in ADHD; Twice-exceptional adults; Gamification; Breaks and micro-breaks; Calm technology; Barkley's executive-function model; Specific colors, spacing, line length; Jira, Slack, PR review, email; Comparing form factors.

Never checked means no claim reached verification. It does not mean the literature is empty or negative.

## 6. The agent bench

| Agent | Modelled on | Role | Owns | Evidence standing |
|---|---|---|---|---|
| Executive-function coach | Russell Barkley | advises | Getting started, priorities, keeping memory outside your head | His framework was not checked, but trial-tested planning programs teach the same moves |
| Sensory regulation specialist | Winnie Dunn | advises | Sensory load, and grading every “this is calming” claim | Well supported by findings on autistic and ADHD sensory profiles |
| Lived-experience advocate | Fergus Murray | reviews, can veto | Inertia, monotropism, dignity. Vetoes shame, tracking, and nagging | Now backed by findings on emotional dysregulation, burnout, streaks, and measurement |
| Attention and interruption researcher | Gloria Mark | advises | When and how often the dashboard may interrupt | Best supported. Self-interruption finding added, one overstated number corrected |
| Flow and priority specialist | Dominica DeGrandis | builds | One priority model across tickets, pull requests, and sessions | Hard caps are not supported. Few projects per day and progress on planned goals are |
| Agent supervision architect | Mica Endsley | builds | Session data, the “needs me” queue, what counts as alert-worthy | Oversight and resumption findings checked. Her framework was not |
| Calm technology designer | Amber Case | builds | Look, hierarchy, motion, the quiet state, form factor | Low density and clear regions now supported. Ambient displays remain theory |
| Cognitive accessibility engineer | Lisa Seeman | builds | Accessibility thresholds, keyboard use, plain language | Checked word for word against the W3C texts |
| Evidence auditor | Ben Goldacre | reviews | Grades every research claim. Flags pop psychology | Starts from this report's graded findings and its list of what was never checked |
| Bad-day simulator | no persona | reviews | Walks each flow as you at 30% capacity. Reports where it stalls | Grounded in findings on starting, inertia, emotional reactions, and burnout |
