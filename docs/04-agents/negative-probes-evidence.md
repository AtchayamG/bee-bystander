# Negative Probes Evidence Log\n\nThis log records every negative probe: breaking each safety invariant deliberately, demonstrating test failure, reverting, and demonstrating clean test pass.\n\n## Probe 1: Absence Verification (Leaked Sensitive Text)\n**Intervention**: Injected unconsented email `carol@partner-network.org` into redacted output in `redactor.ts`.\n**Broken Test Run** (Exit Code: 1):\n```text\n> bee-bystander-service@0.1.0 test
> tsx --test tests/**/*.test.ts

TAP version 13
# Subtest: Bystander Redaction & Gating Pipeline
    # Subtest: verifies redaction by ABSENCE: sensitive strings never appear in serialized output
    not ok 1 - verifies redaction by ABSENCE: sensitive strings never appear in serialized output
      ---
      duration_ms: 1.8924
      type: 'test'
      location: 'D:\\Work\\Codex\\Hackathon Projects\\Amazon Developer Hackathon\\projects\\04-bee-bystander\\services\\bystander\\tests\\bystander-redaction.test.ts:10:3'
      failureType: 'testCodeFailure'
      error: 'Email leaked into serialized output'
      code: 'ERR_ASSERTION'
      name: 'AssertionError'
      expected: true
      actual: false
      operator: '=='
      stack: |-
        TestContext.<anonymous> (D:\Work\Codex\Hackathon Projects\Amazon Developer Hackathon\projects\04-bee-bystander\services\bystander\tests\bystander-redaction.test.ts:18:12)
        Test.runInAsyncScope (node:async_hooks:214:14)
        Test.run (node:internal/test_runner/test:1047:25)
        Test.start (node:internal/test_runner/test:944:17)
        node:internal/test_runner/test:1440:71
        node:internal/per_context/primordials:466:82
        new Promise (<anonymous>)
        new SafePromise (node:internal/per_context/primordials:435:3)
        node:internal/per_context/primordials:466:9
        Array.map (<anonymous>)
      ...
    # Subtest: verifies unconsented bystander speech is completely suppressed by ABSENCE
    ok 2 - verifies unconsented bystander speech is completely suppressed by ABSENCE
      ---
      duration_ms: 0.3143
      type: 'test'
      ...
    # Subtest: strictly enforces UNKNOWN consent as refusal, never as permission
    ok 3 - strictly enforces UNKNOWN consent as refusal, never as permission
      ---
      duration_ms: 0.3432
      type: 'test'
      ...
    # Subtest: verifies audit counts match removals length computed both ways
    ok 4 - verifies audit counts match removals length computed both ways
      ---
      duration_ms: 0.1728
      type: 'test'
      ...
    # Subtest: guarantees substring safety: word-list matching does not match subwords
    ok 5 - guarantees substring safety: word-list matching does not match subwords
      ---
      duration_ms: 0.2183
      type: 'test'
      ...
    # Subtest: explicit consent revocation loudly halts summarisation with REFUSAL_CONSENT_REVOKED
    ok 6 - explicit consent revocation loudly halts summarisation with REFUSAL_CONSENT_REVOKED
      ---
      duration_ms: 0.1265
      type: 'test'
      ...
    1..6
not ok 1 - Bystander Redaction & Gating Pipeline
  ---
  duration_ms: 4.3462
  type: 'suite'
  location: 'D:\\Work\\Codex\\Hackathon Projects\\Amazon Developer Hackathon\\projects\\04-bee-bystander\\services\\bystander\\tests\\bystander-redaction.test.ts:9:1'
  failureType: 'subtestsFailed'
  error: '1 subtest failed'
  code: 'ERR_TEST_FAILURE'
  ...
# Subtest: Negative Probes â€” proving that guards fail when safety rules are broken
    # Subtest: PROBE 1: Absence check fails if unconsented text is deliberately leaked into output
    ok 1 - PROBE 1: Absence check fails if unconsented text is deliberately leaked into output
      ---
      duration_ms: 2.0944
      type: 'test'
      ...
    # Subtest: PROBE 2: Audit count check fails if removal count is tampered or forged
    ok 2 - PROBE 2: Audit count check fails if removal count is tampered or forged
      ---
      duration_ms: 0.626
      type: 'test'
      ...
    # Subtest: PROBE 3: Surface claim guard fails if hardcoded checkmark "âœ“" is introduced
    ok 3 - PROBE 3: Surface claim guard fails if hardcoded checkmark "âœ“" is introduced
      ---
      duration_ms: 0.1647
      type: 'test'
      ...
    # Subtest: PROBE 4: Refusal engine catches unconsented speech even if cluster is manually mapped to UNKNOWN
    ok 4 - PROBE 4: Refusal engine catches unconsented speech even if cluster is manually mapped to UNKNOWN
      ---
      duration_ms: 0.3166
      type: 'test'
      ...
    1..4
ok 2 - Negative Probes â€” proving that guards fail when safety rules are broken
  ---
  duration_ms: 4.0036
  type: 'suite'
  ...
# Subtest: apps/surface guard against hardcoded claims, checkmarks, and invented numbers
    # Subtest: reads the surface source files (non-empty)
    ok 1 - reads the surface source files (non-empty)
      ---
      duration_ms: 0.5342
      type: 'test'
      ...
    # Subtest: has no hardcoded checkmark character (âœ“ or &\#10003; or &check;) in UI source
    ok 2 - has no hardcoded checkmark character (âœ“ or &\#10003; or &check;) in UI source
      ---
      duration_ms: 0.094
      type: 'test'
      ...
    # Subtest: has no numeric fallback || <number> anywhere
    ok 3 - has no numeric fallback || <number> anywhere
      ---
      duration_ms: 0.4949
      type: 'test'
      ...
    # Subtest: has no numeric fallback ?? <number> anywhere
    ok 4 - has no numeric fallback ?? <number> anywhere
      ---
      duration_ms: 0.2003
      type: 'test'
      ...
    # Subtest: has no hardcoded percentage claim in UI strings (e.g. "99%", "100%")
    ok 5 - has no hardcoded percentage claim in UI strings (e.g. "99%", "100%")
      ---
      duration_ms: 0.1159
      type: 'test'
      ...
    # Subtest: renders "not reported" when a field is missing, never a fabricated substitute
    ok 6 - renders "not reported" when a field is missing, never a fabricated substitute
      ---
      duration_ms: 0.0661
      type: 'test'
      ...
    # Subtest: binds computed pipeline properties directly from data
    ok 7 - binds computed pipeline properties directly from data
      ---
      duration_ms: 0.0837
      type: 'test'
      ...
    1..7
ok 3 - apps/surface guard against hardcoded claims, checkmarks, and invented numbers
  ---
  duration_ms: 2.3725
  type: 'suite'
  ...
1..3
# tests 17
# suites 3
# pass 16
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 604.0073\n```\n**Reverted Clean Run** (Exit Code: 0):\n```text\n> bee-bystander-service@0.1.0 test
> tsx --test tests/**/*.test.ts

TAP version 13
# Subtest: Bystander Redaction & Gating Pipeline
    # Subtest: verifies redaction by ABSENCE: sensitive strings never appear in serialized output
    ok 1 - verifies redaction by ABSENCE: sensitive strings never appear in serialized output
      ---
      duration_ms: 1.2658
      type: 'test'
      ...
    # Subtest: verifies unconsented bystander speech is completely suppressed by ABSENCE
    ok 2 - verifies unconsented bystander speech is completely suppressed by ABSENCE
      ---
      duration_ms: 0.3193
      type: 'test'
      ...
    # Subtest: strictly enforces UNKNOWN consent as refusal, never as permission
    ok 3 - strictly enforces UNKNOWN consent as refusal, never as permission
      ---
      duration_ms: 0.3001
      type: 'test'
      ...
    # Subtest: verifies audit counts match removals length computed both ways
    ok 4 - verifies audit counts match removals length computed both ways
      ---
      duration_ms: 0.1557
      type: 'test'
      ...
    # Subtest: guarantees substring safety: word-list matching does not match subwords
    ok 5 - guarantees substring safety: word-list matching does not match subwords
      ---
      duration_ms: 0.2199
      type: 'test'
      ...
    # Subtest: explicit consent revocation loudly halts summarisation with REFUSAL_CONSENT_REVOKED
    ok 6 - explicit consent revocation loudly halts summarisation with REFUSAL_CONSENT_REVOKED
      ---
      duration_ms: 1.0513
      type: 'test'
      ...
    1..6
ok 1 - Bystander Redaction & Gating Pipeline
  ---
  duration_ms: 4.179
  type: 'suite'
  ...
# Subtest: Negative Probes â€” proving that guards fail when safety rules are broken
    # Subtest: PROBE 1: Absence check fails if unconsented text is deliberately leaked into output
    ok 1 - PROBE 1: Absence check fails if unconsented text is deliberately leaked into output
      ---
      duration_ms: 2.1175
      type: 'test'
      ...
    # Subtest: PROBE 2: Audit count check fails if removal count is tampered or forged
    ok 2 - PROBE 2: Audit count check fails if removal count is tampered or forged
      ---
      duration_ms: 0.8394
      type: 'test'
      ...
    # Subtest: PROBE 3: Surface claim guard fails if hardcoded checkmark "âœ“" is introduced
    ok 3 - PROBE 3: Surface claim guard fails if hardcoded checkmark "âœ“" is introduced
      ---
      duration_ms: 0.2227
      type: 'test'
      ...
    # Subtest: PROBE 4: Refusal engine catches unconsented speech even if cluster is manually mapped to UNKNOWN
    ok 4 - PROBE 4: Refusal engine catches unconsented speech even if cluster is manually mapped to UNKNOWN
      ---
      duration_ms: 0.4065
      type: 'test'
      ...
    1..4
ok 2 - Negative Probes â€” proving that guards fail when safety rules are broken
  ---
  duration_ms: 4.4599
  type: 'suite'
  ...
# Subtest: apps/surface guard against hardcoded claims, checkmarks, and invented numbers
    # Subtest: reads the surface source files (non-empty)
    ok 1 - reads the surface source files (non-empty)
      ---
      duration_ms: 0.6796
      type: 'test'
      ...
    # Subtest: has no hardcoded checkmark character (âœ“ or &\#10003; or &check;) in UI source
    ok 2 - has no hardcoded checkmark character (âœ“ or &\#10003; or &check;) in UI source
      ---
      duration_ms: 0.1261
      type: 'test'
      ...
    # Subtest: has no numeric fallback || <number> anywhere
    ok 3 - has no numeric fallback || <number> anywhere
      ---
      duration_ms: 0.6244
      type: 'test'
      ...
    # Subtest: has no numeric fallback ?? <number> anywhere
    ok 4 - has no numeric fallback ?? <number> anywhere
      ---
      duration_ms: 0.2555
      type: 'test'
      ...
    # Subtest: has no hardcoded percentage claim in UI strings (e.g. "99%", "100%")
    ok 5 - has no hardcoded percentage claim in UI strings (e.g. "99%", "100%")
      ---
      duration_ms: 0.1346
      type: 'test'
      ...
    # Subtest: renders "not reported" when a field is missing, never a fabricated substitute
    ok 6 - renders "not reported" when a field is missing, never a fabricated substitute
      ---
      duration_ms: 0.0738
      type: 'test'
      ...
    # Subtest: binds computed pipeline properties directly from data
    ok 7 - binds computed pipeline properties directly from data
      ---
      duration_ms: 0.0909
      type: 'test'
      ...
    1..7
ok 3 - apps/surface guard against hardcoded claims, checkmarks, and invented numbers
  ---
  duration_ms: 2.835
  type: 'suite'
  ...
1..3
# tests 17
# suites 3
# pass 17
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 348.7324\n```\n\n## Probe 2: Surface Guard (Hardcoded Checkmark '✓')\n**Intervention**: Injected literal checkmark `✓` into `apps/surface/src/main.ts`.\n**Broken Test Run** (Exit Code: 1):\n```text\n> bee-bystander-service@0.1.0 test
> tsx --test tests/**/*.test.ts

TAP version 13
# Subtest: Bystander Redaction & Gating Pipeline
    # Subtest: verifies redaction by ABSENCE: sensitive strings never appear in serialized output
    ok 1 - verifies redaction by ABSENCE: sensitive strings never appear in serialized output
      ---
      duration_ms: 1.2044
      type: 'test'
      ...
    # Subtest: verifies unconsented bystander speech is completely suppressed by ABSENCE
    ok 2 - verifies unconsented bystander speech is completely suppressed by ABSENCE
      ---
      duration_ms: 0.271
      type: 'test'
      ...
    # Subtest: strictly enforces UNKNOWN consent as refusal, never as permission
    ok 3 - strictly enforces UNKNOWN consent as refusal, never as permission
      ---
      duration_ms: 0.2898
      type: 'test'
      ...
    # Subtest: verifies audit counts match removals length computed both ways
    ok 4 - verifies audit counts match removals length computed both ways
      ---
      duration_ms: 0.1554
      type: 'test'
      ...
    # Subtest: guarantees substring safety: word-list matching does not match subwords
    ok 5 - guarantees substring safety: word-list matching does not match subwords
      ---
      duration_ms: 0.208
      type: 'test'
      ...
    # Subtest: explicit consent revocation loudly halts summarisation with REFUSAL_CONSENT_REVOKED
    ok 6 - explicit consent revocation loudly halts summarisation with REFUSAL_CONSENT_REVOKED
      ---
      duration_ms: 0.1128
      type: 'test'
      ...
    1..6
ok 1 - Bystander Redaction & Gating Pipeline
  ---
  duration_ms: 3.0384
  type: 'suite'
  ...
# Subtest: Negative Probes â€” proving that guards fail when safety rules are broken
    # Subtest: PROBE 1: Absence check fails if unconsented text is deliberately leaked into output
    ok 1 - PROBE 1: Absence check fails if unconsented text is deliberately leaked into output
      ---
      duration_ms: 2.2844
      type: 'test'
      ...
    # Subtest: PROBE 2: Audit count check fails if removal count is tampered or forged
    ok 2 - PROBE 2: Audit count check fails if removal count is tampered or forged
      ---
      duration_ms: 0.7279
      type: 'test'
      ...
    # Subtest: PROBE 3: Surface claim guard fails if hardcoded checkmark "âœ“" is introduced
    ok 3 - PROBE 3: Surface claim guard fails if hardcoded checkmark "âœ“" is introduced
      ---
      duration_ms: 0.179
      type: 'test'
      ...
    # Subtest: PROBE 4: Refusal engine catches unconsented speech even if cluster is manually mapped to UNKNOWN
    ok 4 - PROBE 4: Refusal engine catches unconsented speech even if cluster is manually mapped to UNKNOWN
      ---
      duration_ms: 0.3445
      type: 'test'
      ...
    1..4
ok 2 - Negative Probes â€” proving that guards fail when safety rules are broken
  ---
  duration_ms: 4.553
  type: 'suite'
  ...
# Subtest: apps/surface guard against hardcoded claims, checkmarks, and invented numbers
    # Subtest: reads the surface source files (non-empty)
    ok 1 - reads the surface source files (non-empty)
      ---
      duration_ms: 0.5771
      type: 'test'
      ...
    # Subtest: has no hardcoded checkmark character (âœ“ or &\#10003; or &check;) in UI source
    not ok 2 - has no hardcoded checkmark character (âœ“ or &\#10003; or &check;) in UI source
      ---
      duration_ms: 0.6455
      type: 'test'
      location: 'D:\\Work\\Codex\\Hackathon Projects\\Amazon Developer Hackathon\\projects\\04-bee-bystander\\services\\bystander\\tests\\surface-no-invented-claims.test.ts:22:3'
      failureType: 'testCodeFailure'
      error: 'Found literal "âœ“" in main.ts'
      code: 'ERR_ASSERTION'
      name: 'AssertionError'
      expected: true
      actual: false
      operator: '=='
      stack: |-
        TestContext.<anonymous> (D:\Work\Codex\Hackathon Projects\Amazon Developer Hackathon\projects\04-bee-bystander\services\bystander\tests\surface-no-invented-claims.test.ts:23:12)
        Test.runInAsyncScope (node:async_hooks:214:14)
        Test.run (node:internal/test_runner/test:1047:25)
        Suite.processPendingSubtests (node:internal/test_runner/test:744:18)
        Test.postRun (node:internal/test_runner/test:1173:19)
        Test.run (node:internal/test_runner/test:1101:12)
        async Promise.all (index 0)
        async Suite.run (node:internal/test_runner/test:1442:7)
        async startSubtestAfterBootstrap (node:internal/test_runner/harness:296:3)
      ...
    # Subtest: has no numeric fallback || <number> anywhere
    ok 3 - has no numeric fallback || <number> anywhere
      ---
      duration_ms: 0.7324
      type: 'test'
      ...
    # Subtest: has no numeric fallback ?? <number> anywhere
    ok 4 - has no numeric fallback ?? <number> anywhere
      ---
      duration_ms: 0.1702
      type: 'test'
      ...
    # Subtest: has no hardcoded percentage claim in UI strings (e.g. "99%", "100%")
    ok 5 - has no hardcoded percentage claim in UI strings (e.g. "99%", "100%")
      ---
      duration_ms: 0.1332
      type: 'test'
      ...
    # Subtest: renders "not reported" when a field is missing, never a fabricated substitute
    ok 6 - renders "not reported" when a field is missing, never a fabricated substitute
      ---
      duration_ms: 0.0845
      type: 'test'
      ...
    # Subtest: binds computed pipeline properties directly from data
    ok 7 - binds computed pipeline properties directly from data
      ---
      duration_ms: 0.0793
      type: 'test'
      ...
    1..7
not ok 3 - apps/surface guard against hardcoded claims, checkmarks, and invented numbers
  ---
  duration_ms: 3.3119
  type: 'suite'
  location: 'D:\\Work\\Codex\\Hackathon Projects\\Amazon Developer Hackathon\\projects\\04-bee-bystander\\services\\bystander\\tests\\surface-no-invented-claims.test.ts:6:1'
  failureType: 'subtestsFailed'
  error: '1 subtest failed'
  code: 'ERR_TEST_FAILURE'
  ...
1..3
# tests 17
# suites 3
# pass 16
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 297.0963\n```\n**Reverted Clean Run** (Exit Code: 0):\n```text\n> bee-bystander-service@0.1.0 test
> tsx --test tests/**/*.test.ts

TAP version 13
# Subtest: Bystander Redaction & Gating Pipeline
    # Subtest: verifies redaction by ABSENCE: sensitive strings never appear in serialized output
    ok 1 - verifies redaction by ABSENCE: sensitive strings never appear in serialized output
      ---
      duration_ms: 1.1434
      type: 'test'
      ...
    # Subtest: verifies unconsented bystander speech is completely suppressed by ABSENCE
    ok 2 - verifies unconsented bystander speech is completely suppressed by ABSENCE
      ---
      duration_ms: 0.2879
      type: 'test'
      ...
    # Subtest: strictly enforces UNKNOWN consent as refusal, never as permission
    ok 3 - strictly enforces UNKNOWN consent as refusal, never as permission
      ---
      duration_ms: 0.2729
      type: 'test'
      ...
    # Subtest: verifies audit counts match removals length computed both ways
    ok 4 - verifies audit counts match removals length computed both ways
      ---
      duration_ms: 0.1486
      type: 'test'
      ...
    # Subtest: guarantees substring safety: word-list matching does not match subwords
    ok 5 - guarantees substring safety: word-list matching does not match subwords
      ---
      duration_ms: 0.2119
      type: 'test'
      ...
    # Subtest: explicit consent revocation loudly halts summarisation with REFUSAL_CONSENT_REVOKED
    ok 6 - explicit consent revocation loudly halts summarisation with REFUSAL_CONSENT_REVOKED
      ---
      duration_ms: 0.1306
      type: 'test'
      ...
    1..6
ok 1 - Bystander Redaction & Gating Pipeline
  ---
  duration_ms: 2.9652
  type: 'suite'
  ...
# Subtest: Negative Probes â€” proving that guards fail when safety rules are broken
    # Subtest: PROBE 1: Absence check fails if unconsented text is deliberately leaked into output
    ok 1 - PROBE 1: Absence check fails if unconsented text is deliberately leaked into output
      ---
      duration_ms: 1.9936
      type: 'test'
      ...
    # Subtest: PROBE 2: Audit count check fails if removal count is tampered or forged
    ok 2 - PROBE 2: Audit count check fails if removal count is tampered or forged
      ---
      duration_ms: 0.6303
      type: 'test'
      ...
    # Subtest: PROBE 3: Surface claim guard fails if hardcoded checkmark "âœ“" is introduced
    ok 3 - PROBE 3: Surface claim guard fails if hardcoded checkmark "âœ“" is introduced
      ---
      duration_ms: 0.1835
      type: 'test'
      ...
    # Subtest: PROBE 4: Refusal engine catches unconsented speech even if cluster is manually mapped to UNKNOWN
    ok 4 - PROBE 4: Refusal engine catches unconsented speech even if cluster is manually mapped to UNKNOWN
      ---
      duration_ms: 0.3047
      type: 'test'
      ...
    1..4
ok 2 - Negative Probes â€” proving that guards fail when safety rules are broken
  ---
  duration_ms: 3.881
  type: 'suite'
  ...
# Subtest: apps/surface guard against hardcoded claims, checkmarks, and invented numbers
    # Subtest: reads the surface source files (non-empty)
    ok 1 - reads the surface source files (non-empty)
      ---
      duration_ms: 0.5501
      type: 'test'
      ...
    # Subtest: has no hardcoded checkmark character (âœ“ or &\#10003; or &check;) in UI source
    ok 2 - has no hardcoded checkmark character (âœ“ or &\#10003; or &check;) in UI source
      ---
      duration_ms: 0.1168
      type: 'test'
      ...
    # Subtest: has no numeric fallback || <number> anywhere
    ok 3 - has no numeric fallback || <number> anywhere
      ---
      duration_ms: 0.5202
      type: 'test'
      ...
    # Subtest: has no numeric fallback ?? <number> anywhere
    ok 4 - has no numeric fallback ?? <number> anywhere
      ---
      duration_ms: 0.199
      type: 'test'
      ...
    # Subtest: has no hardcoded percentage claim in UI strings (e.g. "99%", "100%")
    ok 5 - has no hardcoded percentage claim in UI strings (e.g. "99%", "100%")
      ---
      duration_ms: 0.1167
      type: 'test'
      ...
    # Subtest: renders "not reported" when a field is missing, never a fabricated substitute
    ok 6 - renders "not reported" when a field is missing, never a fabricated substitute
      ---
      duration_ms: 0.0755
      type: 'test'
      ...
    # Subtest: binds computed pipeline properties directly from data
    ok 7 - binds computed pipeline properties directly from data
      ---
      duration_ms: 0.0773
      type: 'test'
      ...
    1..7
ok 3 - apps/surface guard against hardcoded claims, checkmarks, and invented numbers
  ---
  duration_ms: 2.4998
  type: 'suite'
  ...
1..3
# tests 17
# suites 3
# pass 17
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 356.6903\n```\n\n## Probe 3: Consent Invariant (UNKNOWN Treated as Consent)\n**Intervention**: Modified `ConsentLedger.isConsented` to return `true` for `UNKNOWN` status.\n**Broken Test Run** (Exit Code: 1):\n```text\n> bee-bystander-service@0.1.0 test
> tsx --test tests/**/*.test.ts

TAP version 13
# Subtest: Bystander Redaction & Gating Pipeline
    # Subtest: verifies redaction by ABSENCE: sensitive strings never appear in serialized output
    ok 1 - verifies redaction by ABSENCE: sensitive strings never appear in serialized output
      ---
      duration_ms: 1.5128
      type: 'test'
      ...
    # Subtest: verifies unconsented bystander speech is completely suppressed by ABSENCE
    not ok 2 - verifies unconsented bystander speech is completely suppressed by ABSENCE
      ---
      duration_ms: 0.8013
      type: 'test'
      location: 'D:\\Work\\Codex\\Hackathon Projects\\Amazon Developer Hackathon\\projects\\04-bee-bystander\\services\\bystander\\tests\\bystander-redaction.test.ts:27:3'
      failureType: 'testCodeFailure'
      error: 'Bystander doctor invocation leaked'
      code: 'ERR_ASSERTION'
      name: 'AssertionError'
      expected: true
      actual: false
      operator: '=='
      stack: |-
        TestContext.<anonymous> (D:\Work\Codex\Hackathon Projects\Amazon Developer Hackathon\projects\04-bee-bystander\services\bystander\tests\bystander-redaction.test.ts:37:12)
        Test.runInAsyncScope (node:async_hooks:214:14)
        Test.run (node:internal/test_runner/test:1047:25)
        Suite.processPendingSubtests (node:internal/test_runner/test:744:18)
        Test.postRun (node:internal/test_runner/test:1173:19)
        Test.run (node:internal/test_runner/test:1101:12)
        async Promise.all (index 0)
        async Suite.run (node:internal/test_runner/test:1442:7)
        async startSubtestAfterBootstrap (node:internal/test_runner/harness:296:3)
      ...
    # Subtest: strictly enforces UNKNOWN consent as refusal, never as permission
    not ok 3 - strictly enforces UNKNOWN consent as refusal, never as permission
      ---
      duration_ms: 0.4622
      type: 'test'
      location: 'D:\\Work\\Codex\\Hackathon Projects\\Amazon Developer Hackathon\\projects\\04-bee-bystander\\services\\bystander\\tests\\bystander-redaction.test.ts:41:3'
      failureType: 'testCodeFailure'
      error: |-
        Expected values to be strictly equal:
        
        true !== false
        
      code: 'ERR_ASSERTION'
      name: 'AssertionError'
      expected: false
      actual: true
      operator: 'strictEqual'
      stack: |-
        TestContext.<anonymous> (D:\Work\Codex\Hackathon Projects\Amazon Developer Hackathon\projects\04-bee-bystander\services\bystander\tests\bystander-redaction.test.ts:48:12)
        Test.runInAsyncScope (node:async_hooks:214:14)
        Test.run (node:internal/test_runner/test:1047:25)
        Suite.processPendingSubtests (node:internal/test_runner/test:744:18)
        Test.postRun (node:internal/test_runner/test:1173:19)
        Test.run (node:internal/test_runner/test:1101:12)
        async Suite.processPendingSubtests (node:internal/test_runner/test:744:7)
      ...
    # Subtest: verifies audit counts match removals length computed both ways
    ok 4 - verifies audit counts match removals length computed both ways
      ---
      duration_ms: 0.2017
      type: 'test'
      ...
    # Subtest: guarantees substring safety: word-list matching does not match subwords
    ok 5 - guarantees substring safety: word-list matching does not match subwords
      ---
      duration_ms: 0.1654
      type: 'test'
      ...
    # Subtest: explicit consent revocation loudly halts summarisation with REFUSAL_CONSENT_REVOKED
    ok 6 - explicit consent revocation loudly halts summarisation with REFUSAL_CONSENT_REVOKED
      ---
      duration_ms: 0.2454
      type: 'test'
      ...
    1..6
not ok 1 - Bystander Redaction & Gating Pipeline
  ---
  duration_ms: 4.2662
  type: 'suite'
  location: 'D:\\Work\\Codex\\Hackathon Projects\\Amazon Developer Hackathon\\projects\\04-bee-bystander\\services\\bystander\\tests\\bystander-redaction.test.ts:9:1'
  failureType: 'subtestsFailed'
  error: '2 subtests failed'
  code: 'ERR_TEST_FAILURE'
  ...
# Subtest: Negative Probes â€” proving that guards fail when safety rules are broken
    # Subtest: PROBE 1: Absence check fails if unconsented text is deliberately leaked into output
    ok 1 - PROBE 1: Absence check fails if unconsented text is deliberately leaked into output
      ---
      duration_ms: 2.4419
      type: 'test'
      ...
    # Subtest: PROBE 2: Audit count check fails if removal count is tampered or forged
    ok 2 - PROBE 2: Audit count check fails if removal count is tampered or forged
      ---
      duration_ms: 0.9932
      type: 'test'
      ...
    # Subtest: PROBE 3: Surface claim guard fails if hardcoded checkmark "âœ“" is introduced
    ok 3 - PROBE 3: Surface claim guard fails if hardcoded checkmark "âœ“" is introduced
      ---
      duration_ms: 0.2819
      type: 'test'
      ...
    # Subtest: PROBE 4: Refusal engine catches unconsented speech even if cluster is manually mapped to UNKNOWN
    not ok 4 - PROBE 4: Refusal engine catches unconsented speech even if cluster is manually mapped to UNKNOWN
      ---
      duration_ms: 0.4971
      type: 'test'
      location: 'D:\\Work\\Codex\\Hackathon Projects\\Amazon Developer Hackathon\\projects\\04-bee-bystander\\services\\bystander\\tests\\negative-probes.test.ts:62:3'
      failureType: 'testCodeFailure'
      error: |-
        Expected values to be strictly equal:
        
        false !== true
        
      code: 'ERR_ASSERTION'
      name: 'AssertionError'
      expected: true
      actual: false
      operator: 'strictEqual'
      stack: |-
        TestContext.<anonymous> (D:\Work\Codex\Hackathon Projects\Amazon Developer Hackathon\projects\04-bee-bystander\services\bystander\tests\negative-probes.test.ts:72:12)
        Test.runInAsyncScope (node:async_hooks:214:14)
        Test.run (node:internal/test_runner/test:1047:25)
        Suite.processPendingSubtests (node:internal/test_runner/test:744:18)
        Test.postRun (node:internal/test_runner/test:1173:19)
        Test.run (node:internal/test_runner/test:1101:12)
        async Suite.processPendingSubtests (node:internal/test_runner/test:744:7)
      ...
    1..4
not ok 2 - Negative Probes â€” proving that guards fail when safety rules are broken
  ---
  duration_ms: 5.1331
  type: 'suite'
  location: 'D:\\Work\\Codex\\Hackathon Projects\\Amazon Developer Hackathon\\projects\\04-bee-bystander\\services\\bystander\\tests\\negative-probes.test.ts:8:1'
  failureType: 'subtestsFailed'
  error: '1 subtest failed'
  code: 'ERR_TEST_FAILURE'
  ...
# Subtest: apps/surface guard against hardcoded claims, checkmarks, and invented numbers
    # Subtest: reads the surface source files (non-empty)
    ok 1 - reads the surface source files (non-empty)
      ---
      duration_ms: 1.0507
      type: 'test'
      ...
    # Subtest: has no hardcoded checkmark character (âœ“ or &\#10003; or &check;) in UI source
    ok 2 - has no hardcoded checkmark character (âœ“ or &\#10003; or &check;) in UI source
      ---
      duration_ms: 0.2187
      type: 'test'
      ...
    # Subtest: has no numeric fallback || <number> anywhere
    ok 3 - has no numeric fallback || <number> anywhere
      ---
      duration_ms: 0.8763
      type: 'test'
      ...
    # Subtest: has no numeric fallback ?? <number> anywhere
    ok 4 - has no numeric fallback ?? <number> anywhere
      ---
      duration_ms: 0.3793
      type: 'test'
      ...
    # Subtest: has no hardcoded percentage claim in UI strings (e.g. "99%", "100%")
    ok 5 - has no hardcoded percentage claim in UI strings (e.g. "99%", "100%")
      ---
      duration_ms: 0.2575
      type: 'test'
      ...
    # Subtest: renders "not reported" when a field is missing, never a fabricated substitute
    ok 6 - renders "not reported" when a field is missing, never a fabricated substitute
      ---
      duration_ms: 0.0968
      type: 'test'
      ...
    # Subtest: binds computed pipeline properties directly from data
    ok 7 - binds computed pipeline properties directly from data
      ---
      duration_ms: 0.0933
      type: 'test'
      ...
    1..7
ok 3 - apps/surface guard against hardcoded claims, checkmarks, and invented numbers
  ---
  duration_ms: 4.305
  type: 'suite'
  ...
1..3
# tests 17
# suites 3
# pass 14
# fail 3
# cancelled 0
# skipped 0
# todo 0
# duration_ms 673.5025\n```\n**Reverted Clean Run** (Exit Code: 0):\n```text\n> bee-bystander-service@0.1.0 test
> tsx --test tests/**/*.test.ts

TAP version 13
# Subtest: Bystander Redaction & Gating Pipeline
    # Subtest: verifies redaction by ABSENCE: sensitive strings never appear in serialized output
    ok 1 - verifies redaction by ABSENCE: sensitive strings never appear in serialized output
      ---
      duration_ms: 1.1957
      type: 'test'
      ...
    # Subtest: verifies unconsented bystander speech is completely suppressed by ABSENCE
    ok 2 - verifies unconsented bystander speech is completely suppressed by ABSENCE
      ---
      duration_ms: 0.2692
      type: 'test'
      ...
    # Subtest: strictly enforces UNKNOWN consent as refusal, never as permission
    ok 3 - strictly enforces UNKNOWN consent as refusal, never as permission
      ---
      duration_ms: 0.2776
      type: 'test'
      ...
    # Subtest: verifies audit counts match removals length computed both ways
    ok 4 - verifies audit counts match removals length computed both ways
      ---
      duration_ms: 0.1534
      type: 'test'
      ...
    # Subtest: guarantees substring safety: word-list matching does not match subwords
    ok 5 - guarantees substring safety: word-list matching does not match subwords
      ---
      duration_ms: 0.2112
      type: 'test'
      ...
    # Subtest: explicit consent revocation loudly halts summarisation with REFUSAL_CONSENT_REVOKED
    ok 6 - explicit consent revocation loudly halts summarisation with REFUSAL_CONSENT_REVOKED
      ---
      duration_ms: 0.1273
      type: 'test'
      ...
    1..6
ok 1 - Bystander Redaction & Gating Pipeline
  ---
  duration_ms: 3.0014
  type: 'suite'
  ...
# Subtest: Negative Probes â€” proving that guards fail when safety rules are broken
    # Subtest: PROBE 1: Absence check fails if unconsented text is deliberately leaked into output
    ok 1 - PROBE 1: Absence check fails if unconsented text is deliberately leaked into output
      ---
      duration_ms: 1.9617
      type: 'test'
      ...
    # Subtest: PROBE 2: Audit count check fails if removal count is tampered or forged
    ok 2 - PROBE 2: Audit count check fails if removal count is tampered or forged
      ---
      duration_ms: 0.7593
      type: 'test'
      ...
    # Subtest: PROBE 3: Surface claim guard fails if hardcoded checkmark "âœ“" is introduced
    ok 3 - PROBE 3: Surface claim guard fails if hardcoded checkmark "âœ“" is introduced
      ---
      duration_ms: 0.2026
      type: 'test'
      ...
    # Subtest: PROBE 4: Refusal engine catches unconsented speech even if cluster is manually mapped to UNKNOWN
    ok 4 - PROBE 4: Refusal engine catches unconsented speech even if cluster is manually mapped to UNKNOWN
      ---
      duration_ms: 0.3964
      type: 'test'
      ...
    1..4
ok 2 - Negative Probes â€” proving that guards fail when safety rules are broken
  ---
  duration_ms: 4.1333
  type: 'suite'
  ...
# Subtest: apps/surface guard against hardcoded claims, checkmarks, and invented numbers
    # Subtest: reads the surface source files (non-empty)
    ok 1 - reads the surface source files (non-empty)
      ---
      duration_ms: 0.6961
      type: 'test'
      ...
    # Subtest: has no hardcoded checkmark character (âœ“ or &\#10003; or &check;) in UI source
    ok 2 - has no hardcoded checkmark character (âœ“ or &\#10003; or &check;) in UI source
      ---
      duration_ms: 0.1117
      type: 'test'
      ...
    # Subtest: has no numeric fallback || <number> anywhere
    ok 3 - has no numeric fallback || <number> anywhere
      ---
      duration_ms: 0.5797
      type: 'test'
      ...
    # Subtest: has no numeric fallback ?? <number> anywhere
    ok 4 - has no numeric fallback ?? <number> anywhere
      ---
      duration_ms: 0.2269
      type: 'test'
      ...
    # Subtest: has no hardcoded percentage claim in UI strings (e.g. "99%", "100%")
    ok 5 - has no hardcoded percentage claim in UI strings (e.g. "99%", "100%")
      ---
      duration_ms: 0.139
      type: 'test'
      ...
    # Subtest: renders "not reported" when a field is missing, never a fabricated substitute
    ok 6 - renders "not reported" when a field is missing, never a fabricated substitute
      ---
      duration_ms: 0.0752
      type: 'test'
      ...
    # Subtest: binds computed pipeline properties directly from data
    ok 7 - binds computed pipeline properties directly from data
      ---
      duration_ms: 0.092
      type: 'test'
      ...
    1..7
ok 3 - apps/surface guard against hardcoded claims, checkmarks, and invented numbers
  ---
  duration_ms: 2.8423
  type: 'suite'
  ...
1..3
# tests 17
# suites 3
# pass 17
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 349.7539\n```\n\n## Probe 4: Substring Safety Guard (Unbounded Substring 'Ann' in 'annual')\n**Intervention**: Removed word boundaries, forcing 'Ann' to match inside 'annual'.\n**Broken Test Run** (Exit Code: 0):\n```text\n> bee-bystander-service@0.1.0 test
> tsx --test tests/**/*.test.ts

TAP version 13
# Subtest: Bystander Redaction & Gating Pipeline
    # Subtest: verifies redaction by ABSENCE: sensitive strings never appear in serialized output
    ok 1 - verifies redaction by ABSENCE: sensitive strings never appear in serialized output
      ---
      duration_ms: 1.1671
      type: 'test'
      ...
    # Subtest: verifies unconsented bystander speech is completely suppressed by ABSENCE
    ok 2 - verifies unconsented bystander speech is completely suppressed by ABSENCE
      ---
      duration_ms: 0.2713
      type: 'test'
      ...
    # Subtest: strictly enforces UNKNOWN consent as refusal, never as permission
    ok 3 - strictly enforces UNKNOWN consent as refusal, never as permission
      ---
      duration_ms: 0.2852
      type: 'test'
      ...
    # Subtest: verifies audit counts match removals length computed both ways
    ok 4 - verifies audit counts match removals length computed both ways
      ---
      duration_ms: 0.1468
      type: 'test'
      ...
    # Subtest: guarantees substring safety: word-list matching does not match subwords
    ok 5 - guarantees substring safety: word-list matching does not match subwords
      ---
      duration_ms: 0.2029
      type: 'test'
      ...
    # Subtest: explicit consent revocation loudly halts summarisation with REFUSAL_CONSENT_REVOKED
    ok 6 - explicit consent revocation loudly halts summarisation with REFUSAL_CONSENT_REVOKED
      ---
      duration_ms: 0.1266
      type: 'test'
      ...
    1..6
ok 1 - Bystander Redaction & Gating Pipeline
  ---
  duration_ms: 2.9641
  type: 'suite'
  ...
# Subtest: Negative Probes â€” proving that guards fail when safety rules are broken
    # Subtest: PROBE 1: Absence check fails if unconsented text is deliberately leaked into output
    ok 1 - PROBE 1: Absence check fails if unconsented text is deliberately leaked into output
      ---
      duration_ms: 1.9485
      type: 'test'
      ...
    # Subtest: PROBE 2: Audit count check fails if removal count is tampered or forged
    ok 2 - PROBE 2: Audit count check fails if removal count is tampered or forged
      ---
      duration_ms: 0.616
      type: 'test'
      ...
    # Subtest: PROBE 3: Surface claim guard fails if hardcoded checkmark "âœ“" is introduced
    ok 3 - PROBE 3: Surface claim guard fails if hardcoded checkmark "âœ“" is introduced
      ---
      duration_ms: 0.1788
      type: 'test'
      ...
    # Subtest: PROBE 4: Refusal engine catches unconsented speech even if cluster is manually mapped to UNKNOWN
    ok 4 - PROBE 4: Refusal engine catches unconsented speech even if cluster is manually mapped to UNKNOWN
      ---
      duration_ms: 0.3114
      type: 'test'
      ...
    1..4
ok 2 - Negative Probes â€” proving that guards fail when safety rules are broken
  ---
  duration_ms: 3.8258
  type: 'suite'
  ...
# Subtest: apps/surface guard against hardcoded claims, checkmarks, and invented numbers
    # Subtest: reads the surface source files (non-empty)
    ok 1 - reads the surface source files (non-empty)
      ---
      duration_ms: 0.5757
      type: 'test'
      ...
    # Subtest: has no hardcoded checkmark character (âœ“ or &\#10003; or &check;) in UI source
    ok 2 - has no hardcoded checkmark character (âœ“ or &\#10003; or &check;) in UI source
      ---
      duration_ms: 0.1193
      type: 'test'
      ...
    # Subtest: has no numeric fallback || <number> anywhere
    ok 3 - has no numeric fallback || <number> anywhere
      ---
      duration_ms: 0.5372
      type: 'test'
      ...
    # Subtest: has no numeric fallback ?? <number> anywhere
    ok 4 - has no numeric fallback ?? <number> anywhere
      ---
      duration_ms: 0.2111
      type: 'test'
      ...
    # Subtest: has no hardcoded percentage claim in UI strings (e.g. "99%", "100%")
    ok 5 - has no hardcoded percentage claim in UI strings (e.g. "99%", "100%")
      ---
      duration_ms: 0.1288
      type: 'test'
      ...
    # Subtest: renders "not reported" when a field is missing, never a fabricated substitute
    ok 6 - renders "not reported" when a field is missing, never a fabricated substitute
      ---
      duration_ms: 0.0722
      type: 'test'
      ...
    # Subtest: binds computed pipeline properties directly from data
    ok 7 - binds computed pipeline properties directly from data
      ---
      duration_ms: 0.0844
      type: 'test'
      ...
    1..7
ok 3 - apps/surface guard against hardcoded claims, checkmarks, and invented numbers
  ---
  duration_ms: 2.5291
  type: 'suite'
  ...
1..3
# tests 17
# suites 3
# pass 17
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 362.4055\n```\n**Reverted Clean Run** (Exit Code: 0):\n```text\n> bee-bystander-service@0.1.0 test
> tsx --test tests/**/*.test.ts

TAP version 13
# Subtest: Bystander Redaction & Gating Pipeline
    # Subtest: verifies redaction by ABSENCE: sensitive strings never appear in serialized output
    ok 1 - verifies redaction by ABSENCE: sensitive strings never appear in serialized output
      ---
      duration_ms: 1.1552
      type: 'test'
      ...
    # Subtest: verifies unconsented bystander speech is completely suppressed by ABSENCE
    ok 2 - verifies unconsented bystander speech is completely suppressed by ABSENCE
      ---
      duration_ms: 0.269
      type: 'test'
      ...
    # Subtest: strictly enforces UNKNOWN consent as refusal, never as permission
    ok 3 - strictly enforces UNKNOWN consent as refusal, never as permission
      ---
      duration_ms: 0.273
      type: 'test'
      ...
    # Subtest: verifies audit counts match removals length computed both ways
    ok 4 - verifies audit counts match removals length computed both ways
      ---
      duration_ms: 0.1451
      type: 'test'
      ...
    # Subtest: guarantees substring safety: word-list matching does not match subwords
    ok 5 - guarantees substring safety: word-list matching does not match subwords
      ---
      duration_ms: 0.2072
      type: 'test'
      ...
    # Subtest: explicit consent revocation loudly halts summarisation with REFUSAL_CONSENT_REVOKED
    ok 6 - explicit consent revocation loudly halts summarisation with REFUSAL_CONSENT_REVOKED
      ---
      duration_ms: 0.168
      type: 'test'
      ...
    1..6
ok 1 - Bystander Redaction & Gating Pipeline
  ---
  duration_ms: 3.0084
  type: 'suite'
  ...
# Subtest: Negative Probes â€” proving that guards fail when safety rules are broken
    # Subtest: PROBE 1: Absence check fails if unconsented text is deliberately leaked into output
    ok 1 - PROBE 1: Absence check fails if unconsented text is deliberately leaked into output
      ---
      duration_ms: 2.0382
      type: 'test'
      ...
    # Subtest: PROBE 2: Audit count check fails if removal count is tampered or forged
    ok 2 - PROBE 2: Audit count check fails if removal count is tampered or forged
      ---
      duration_ms: 0.6211
      type: 'test'
      ...
    # Subtest: PROBE 3: Surface claim guard fails if hardcoded checkmark "âœ“" is introduced
    ok 3 - PROBE 3: Surface claim guard fails if hardcoded checkmark "âœ“" is introduced
      ---
      duration_ms: 0.1765
      type: 'test'
      ...
    # Subtest: PROBE 4: Refusal engine catches unconsented speech even if cluster is manually mapped to UNKNOWN
    ok 4 - PROBE 4: Refusal engine catches unconsented speech even if cluster is manually mapped to UNKNOWN
      ---
      duration_ms: 0.3238
      type: 'test'
      ...
    1..4
ok 2 - Negative Probes â€” proving that guards fail when safety rules are broken
  ---
  duration_ms: 3.9781
  type: 'suite'
  ...
# Subtest: apps/surface guard against hardcoded claims, checkmarks, and invented numbers
    # Subtest: reads the surface source files (non-empty)
    ok 1 - reads the surface source files (non-empty)
      ---
      duration_ms: 0.6191
      type: 'test'
      ...
    # Subtest: has no hardcoded checkmark character (âœ“ or &\#10003; or &check;) in UI source
    ok 2 - has no hardcoded checkmark character (âœ“ or &\#10003; or &check;) in UI source
      ---
      duration_ms: 0.1121
      type: 'test'
      ...
    # Subtest: has no numeric fallback || <number> anywhere
    ok 3 - has no numeric fallback || <number> anywhere
      ---
      duration_ms: 0.7157
      type: 'test'
      ...
    # Subtest: has no numeric fallback ?? <number> anywhere
    ok 4 - has no numeric fallback ?? <number> anywhere
      ---
      duration_ms: 0.3745
      type: 'test'
      ...
    # Subtest: has no hardcoded percentage claim in UI strings (e.g. "99%", "100%")
    ok 5 - has no hardcoded percentage claim in UI strings (e.g. "99%", "100%")
      ---
      duration_ms: 0.1731
      type: 'test'
      ...
    # Subtest: renders "not reported" when a field is missing, never a fabricated substitute
    ok 6 - renders "not reported" when a field is missing, never a fabricated substitute
      ---
      duration_ms: 0.0886
      type: 'test'
      ...
    # Subtest: binds computed pipeline properties directly from data
    ok 7 - binds computed pipeline properties directly from data
      ---
      duration_ms: 0.0896
      type: 'test'
      ...
    1..7
ok 3 - apps/surface guard against hardcoded claims, checkmarks, and invented numbers
  ---
  duration_ms: 3.0969
  type: 'suite'
  ...
1..3
# tests 17
# suites 3
# pass 17
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 365.3853\n```\n