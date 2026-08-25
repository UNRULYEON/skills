# Perf

1. Establish a baseline measurement before changing anything — the same
   metric, measured the same way, that you'll use to judge success.
   ([prove it against the real artifact](../principles.md#prove-it-against-the-real-artifact))
2. Locate the actual bottleneck with real profiling data (a trace, a
   profiler, timing instrumentation) — not a guess about where the time
   goes.
3. Form one hypothesis about the cause and change the smallest thing that
   tests it.
4. Re-measure with the same method as the baseline and compare directly.
5. If it didn't help, revert and form the next hypothesis rather than
   layering another change on top of one that didn't work.
   ([sequence into verifiable units](../principles.md#sequence-into-verifiable-units))
6. Report: baseline, change, new measurement, and the delta — numbers, not
   impressions.
