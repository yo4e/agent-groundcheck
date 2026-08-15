# 公開履歴 Corpus Validation — Issue #4

**記録日:** 2026-08-15  
**対象:** AGC001（指示ファイル中のrepository path消失）および AGC002（指示ファイル中のpackage script消失）  
**判断:** **GO（限定的な次段階へ）**

## 結論

本調査は、Issue #4で定めた「実在の公開履歴において、PR時点で新しく発生する指示ドリフトが観測できるか」を検証したものである。[1] 24の公開repository、527件の高signalなbase/head比較を再生した結果、**独立した2 repositoryで、各ruleにつき1件ずつ、再現可能な真陽性を確認した**。[2] [3]

> **GO（限定的）:** AGC001とAGC002はいずれも実際の公開履歴で発生した。したがって、base/head比較という製品契約を維持したまま、最小の有用性検証を続ける根拠がある。ただし、真陽性率は比較あたり **0.379%** と低く、general-purpose instruction linterへの拡張、ルール追加、または「高頻度の市場課題」という主張は正当化されない。

この判断は、Issue #4の停止基準である「約500件で0〜1件ならPIVOT/STOPを真剣に検討する」を満たす標本量の後、**2件の独立した真陽性**を得たことに基づく。[1] ただし2件は最小限の肯定的証拠であり、広範な需要や検出精度の統計的証明ではない。次段階は、maintainer outreachや自動修正ではなく、既存のPR-only・nonblocking契約を保った運用検証に限定する。

## 研究設計

このcorpusは、AGENTS.md、CLAUDE.md、GEMINI.md、`.github/copilot-instructions.md`を含む公開repositoryを、既存のcurated seedとGitHub code search由来の候補から固定した。fork、archived repository、過大なrepositoryは除外し、ファイル形式・言語・repository規模が単一のエコシステムに偏らないように選んだ。これは無作為標本ではなく、**指示ファイルを実際に持つ公開repositoryに対するpurposeful corpus**である。

各repositoryではdefault branchのfirst-parent履歴を最大1,200コミットまで遡った。候補比較は、削除（`D`）、rename（`R`）、または`package.json`・対応指示ファイルの変更（`M`）を含むcommitに限定し、1 repositoryあたり最大25件を選んだ。各候補に対してbaseとheadを別々のGit viewとして評価し、headのfindingがbaseで有効だった同一claimに対応するときだけ`newFindings`として扱った。baseにおける有効性を証明できないfindingは、製品契約どおり`unproven`として非blockingに分類した。

| 項目 | 実施内容 |
|---|---|
| Repository数 | 24 |
| 高signal base/head比較 | 527 |
| 履歴深度 | 各repository最大1,200 first-parent commit |
| 比較上限 | 各repository最大25件 |
| clone方式 | `--full-clone`。lazy blob fetchによる再生遅延を避けるためfilterを使用しない |
| 対象instruction形式 | AGENTS.md、CLAUDE.md、GEMINI.md、`.github/copilot-instructions.md` |
| 実行モード | `pr-check --base <base> --head <head> --format json` |
| raw evidence | `research/corpus/data/scan-final.ndjson` [3] |
| 集計・candidate一覧 | `research/corpus/data/summary-final.json` [2] |

再現時は、まず`pnpm build`でCLIを作成し、`research/corpus/scan.mjs`でscanを行う。CLIはfindingを報告した場合に非ゼロで終了するため、corpus replayは標準出力のJSONを終了コードとは独立に解析する。修正後の再分類には`research/corpus/replay.mjs`を用いる。

```sh
pnpm build
node research/corpus/scan.mjs \
  --repositories 20 --history-depth 1200 --comparisons-per-repository 25 \
  --full-clone --seeds research/corpus/data/repositories-small.ndjson \
  --output research/corpus/data/scan-small-deep.ndjson \
  --workdir /tmp/agent-groundcheck-corpus-deep

node research/corpus/replay.mjs \
  --input research/corpus/data/scan-small-deep.ndjson \
  --output research/corpus/data/scan-small-deep-final.ndjson \
  --workdir /tmp/agent-groundcheck-corpus-deep
```

## Corpus構成

標本は10 repositoryにAGENTS.md、5 repositoryにCLAUDE.md、7 repositoryにGEMINI.md、8 repositoryにCopilot instructionsを含む。複数形式を持つrepositoryは形式ごとに計上している。主言語はTypeScriptが9 repositoryで最も多いが、Python、Go、Shell、Dart、C++、Objective-C、PHP、JavaScript、Vue、HTMLも含めた。[2]

| Repository | 指示形式 | 主言語 | 比較数 |
|---|---|---:|---:|
| google/adk-python | AGENTS.md | Python | 25 |
| medama-io/medama | AGENTS.md | Go | 25 |
| Nutlope/make-comics | AGENTS.md | TypeScript | 20 |
| lajarre/pi-vim | AGENTS.md | TypeScript | 25 |
| quickemu-project/quickemu | AGENTS.md | Shell | 12 |
| javascript-obfuscator/javascript-obfuscator | CLAUDE.md | TypeScript | 25 |
| SuperClaude-Org/SuperClaude_Framework | AGENTS.md, CLAUDE.md | Python | 25 |
| modelcontextprotocol/servers | AGENTS.md, CLAUDE.md | TypeScript | 25 |
| sebastien/monitoring | AGENTS.md | Python | 17 |
| modelcontextprotocol/inspector | Copilot instructions | TypeScript | 25 |
| labex-labs/python-cheatsheet | GEMINI.md | Vue | 25 |
| thomasnordquist/MQTT-Explorer | Copilot instructions | TypeScript | 25 |
| X-Wei/flutter_catalog | GEMINI.md | Dart | 25 |
| FalconChristmas/fpp | Copilot instructions | C++ | 25 |
| jtblin/kube2iam | GEMINI.md | HTML | 9 |
| AzureAD/microsoft-authentication-library-common-for-objc | Copilot instructions | Objective-C | 25 |
| relaticle/relaticle | GEMINI.md | PHP | 25 |
| rstrouse/nodejs-poolController-dashPanel | Copilot instructions | JavaScript | 25 |
| hyhmrright/brooks-lint | GEMINI.md | JavaScript | 25 |
| nirholas/gitpretty | Copilot instructions | Shell | 12 |
| CherryHQ/cherry-studio | AGENTS.md, CLAUDE.md | TypeScript | 25 |
| inkline/inkline | AGENTS.md, CLAUDE.md, GEMINI.md, Copilot instructions | TypeScript | 25 |
| JustinBeckwith/retry-axios | GEMINI.md | TypeScript | 25 |
| totalhack/zillion-web | Copilot instructions | Vue | 7 |

## 定量結果

最終replayではtool errorを残さなかった。`correctly-clean`は、対象となる構造変更があっても、baseで有効だった指示claimをheadで壊していないことを意味する。`unproven`は、headで無効なclaimを観測しても、baseで同一claimが有効だったことを確定できないため、意図的にblocking findingに昇格させない分類である。

| 分類 | 比較数 | 比率 | 解釈 |
|---|---:|---:|---|
| candidate true positive | 2 | 0.379% | 人手で確認した新規ドリフト。AGC001とAGC002が各1件 |
| correctly clean | 492 | 93.358% | 新規ドリフトなし |
| unproven | 33 | 6.261% | base側の有効性を証明できず、製品契約により非blocking |
| tool error | 0 | 0.000% | 最終replayではなし |
| **合計** | **527** | **100.000%** | 24 repositoryの高signal比較 |

33件の`unproven`比較には、AGC001のunproven finding 589件、AGC002のunproven finding 13件が含まれる。この数は「検出すべき新規ドリフト」の数ではない。たとえばheadで初めて現れたinstruction file、またはbase時点ですでに有効性が確認できないclaimは、base/head差分として安全に帰属できないためである。既存債務・新規instructionの未証明状態をPR blockerにしないことは、設計上の意図である。

## 人手確認した真陽性

### AGC001 — `lajarre/pi-vim`

2026-07-21の比較では、base `a27392d`で`doc/dev/manual-qa.md`が存在し、AGENTS.mdの9行目が同pathを参照していた。head `26495f5`は同ファイルを削除したが、instruction参照は残った。headでpathは存在せず、baseでは存在するため、これはbase/head契約を満たすAGC001真陽性である。[4]

| 証拠項目 | Base | Head |
|---|---|---|
| Commit | `a27392d426f9f6518308c37d8c812703ca8bcfd9` | `26495f5b8a86becb32d4e19189a308f4cb65b0a5` |
| Commit日時 | 2026-07-21 10:24:30 +01:00 | 2026-07-21 12:39:23 +01:00 |
| 変更事実 | `doc/dev/manual-qa.md`が存在 | 同pathを`D`で削除 |
| 指示 | AGENTS.md:9が`doc/dev/manual-qa.md`を参照 | 同じ参照が残存 |
| AGC判定 | 有効 | **AGC001 new finding** |

> Baseで有効だったrepository pathが、同じ比較のheadで消え、coding-agent instructionだけが古いpathを参照し続けた。これはAGC001が対象とする最小の公開履歴事例である。[4]

### AGC002 — `modelcontextprotocol/inspector`

2026-07-27の大規模構成変更では、base `ac3c1a1`のroot `package.json`に`dev` scriptが存在した。head `25106dc`はrootの`dev` scriptを削除したが、AGENTS.mdの262行目にrootで実行される`npm run dev`の参照を残した。baseでscriptは有効、headで不在であるため、AGC002真陽性である。[5]

| 証拠項目 | Base | Head |
|---|---|---|
| Commit | `ac3c1a122a5e072a200c99869fc0cd8bfa660ece` | `25106dcce481b3c839f93f95d8ae2e4cfef97930` |
| Commit日時 | 2026-07-17 19:54:09 -07:00 | 2026-07-27 23:25:08 -04:00 |
| root `package.json`の`dev` | `node client/bin/start.js --dev` | 不在 |
| 指示 | AGENTS.mdのroot `npm run dev`参照は有効 | AGENTS.md:262の参照が残存 |
| AGC判定 | 有効 | **AGC002 new finding** |

この比較には別の`cd clients/web && npm run dev`参照も含まれていた。これはheadの`clients/web/package.json`で有効であり、初期抽出器がroot manifestとして解決したため誤検知となった。後述の修正後、nested working directoryを正しく解決し、残るroot `npm run dev`だけがAGC002として確認された。[5]

## 誤検知・計測修正

調査は製品境界と研究harnessの両方で2点の修正を導いた。いずれも機能拡張ではなく、真陽性の解釈を守るためのprecision修正である。

| 発見 | 原因 | 対応 | 回帰検証 |
|---|---|---|---|
| corpusの2比較が`tool-error` | CLIはfindingを報告すると非ゼロ終了するが、有効なJSONをstdoutへ出力する。harnessが終了コードだけで失敗扱いした | `scan.mjs`と`replay.mjs`でstdout JSONを終了コードと独立に解析 | 旧tool error 2件を再生し、2件のcandidateを確認。最終replayはtool error 0 |
| `cd clients/web && npm run dev`がroot scriptとして誤検出 | AGC002のmanifest解決がinstruction fileの近傍またはrootだけを見ていた | 安全な静的`cd relative/path &&`だけをclaimのworking directoryとして保持し、そのpackage manifestを優先 | unit testとPR-mode integration testを追加。`clients/web/package.json`のscript削除を正しく検出 |

後者はshellの一般的な解釈器を追加するものではない。動的なpath、親directory traversal、複雑なshell構文には拡張せず、静的で相対的な`cd <path> &&`という限定されたpackage-script文脈のみを扱う。これにより「generic instruction linter」へ問題設定をすり替えず、AGC002の明確な誤帰属だけを除去した。

## 限界と次の検証

本corpusは公開repository、default branch、first-parent commit、現在clone可能な履歴に限られる。検索・curationに基づくpurposeful samplingであり、private repository、enterprise monorepo、merge commit内だけに現れる変更、削除後に速やかにinstructionを更新したケースは十分に代表しない。また、1 repositoryあたり25件の上限は比較量を均衡化するが、変更量に比例した推定ではない。

真陽性は2件のみである。したがって、次段階で有効なのは、実際のPR workflowにbase/headモードを接続して、maintainerが提示された証拠を有用と判断するかを少数の実運用で確認することである。公開outreach、PR投稿、または自動修正はowner boundaryであり、この調査からは実施しない。

| 判断候補 | 根拠 | 結論 |
|---|---|---|
| STOP | 約500比較で真陽性が0〜1件の場合に検討 | 不採用。527比較で独立した真陽性が2件ある |
| PIVOT | 明確なドリフトが観測されない場合に検討 | 不採用。ただし頻度は低く、範囲拡張の根拠にはしない |
| **GO** | AGC001・AGC002ともbase/headで実証済み | **採用。ただしPR-only・nonblocking・2 ruleのまま最小検証を続ける** |

## References

[1]: https://github.com/yo4e/agent-groundcheck/issues/4 "Issue #4 — public-history corpus validation"
[2]: ../research/corpus/data/summary-final.json "Final 24-repository corpus summary"
[3]: ../research/corpus/data/scan-final.ndjson "Final replayed corpus records"
[4]: https://github.com/lajarre/pi-vim/compare/a27392d426f9f6518308c37d8c812703ca8bcfd9...26495f5b8a86becb32d4e19189a308f4cb65b0a5 "lajarre/pi-vim AGC001 provenance"
[5]: https://github.com/modelcontextprotocol/inspector/compare/ac3c1a122a5e072a200c99869fc0cd8bfa660ece...25106dcce481b3c839f93f95d8ae2e4cfef97930 "modelcontextprotocol/inspector AGC002 provenance"
