# Agent Groundcheck — 市場・技術調査報告書

**作成者:** Manus AI  
**調査日:** 2026-08-15  
**対象:** PR時点で新たに発生するコーディングエージェント向け指示ファイルのドリフト

## エグゼクティブサマリー

**結論は「PIVOT」**である。対象問題は実在し、指示ファイルはすでに広く運用されている。`AGENTS.md`は公式サイトで6万超のOSSプロジェクトに使われているとされ、Claude Code、GitHub Copilot、Gemini CLIはいずれも、ファイル階層・パス指定・複数の指示源を持つ実装を公式に提供している。[1] [2] [3] [4] [5] さらに、公開研究は人気OSS 100件の`AGENTS.md`/`CLAUDE.md`を分析し、少なくとも一つの構成上の問題を91件で確認した。特に、古い・矛盾する・過大な指示、目的の説明がない参照、初期生成後に更新されないファイルは、実在する保守問題である。[6]

ただし、**現在状態の静的lint**という発想は競争過多である。agnix、AgentLint、agents-lint、agent-context-lintは、異なる成熟度ながら、指示形式の検証、存在しないパス、欠落したpackage script、品質・構文・矛盾の検査をすでに提供している。[7] [8] [9] [10] `agents-lint`と`agent-context-lint`はパス・scriptの現在状態検査を明示しており、Agent Groundcheckが同じ検査を単に追加するだけでは差別化にならない。[9] [10]

一方で、各公式README・Action・公開ソースを確認した範囲では、**base revisionとhead revisionを別々に評価し、既存の指示負債を除外して「このPRが新たに作ったドリフト」だけを既定で失敗にする**機能は確認できなかった。この不在は「競合が絶対に持たない」という証明ではないが、公開文書上の明確な差別化余地である。promptfooのPR #6538では、`docs/*.md`を`docs/agents/*.md`へ移した際に、root `AGENTS.md`のパスを更新し、参照先の存在確認を作業・テスト計画に含めている。この変更は、PR単位のパス移動が指示ドリフトを生む実例である。[11]

従って、v0.1は**汎用「agent instruction linter」ではなく、ローカル・決定的・API不要のPRドリフト検出器**に絞るべきである。最小MVPは二規則で十分である。第一に、baseで存在しheadで消えた、指示ファイル中の高確信リポジトリ相対パスを報告する。第二に、baseで存在しheadで消えた、明示的なnpm/pnpm/yarn script参照を、正しいworkspace manifestに対して報告する。どちらも既存負債を既定で失敗させず、Gitのrename情報を補助説明に使う。runtime versionの一致、ネストした指示の意味論、一般品質採点、LLM判定、自動書換えは後続に回す。

この位置付けは、四択では**「部分的に提供されているが、有意に差別化できる」**である。実装開始前に、再現可能な公開リポジトリ標本で二規則を走らせ、変更時にのみ発生した真のドリフト率と人手検証精度を測定すべきである。十分な実例と外部maintainerの有用性確認が得られなければ、静的lint市場へ拡張するのではなく停止する。

| 意思決定 | 内容 |
| --- | --- |
| 最終判断 | **PIVOT** — 「指示品質lint」ではなく「PRが新規導入した、確定的な事実ドリフト」へ収束する。 |
| ギャップ判定 | **部分的に提供されているが、有意に差別化できる。** 現在状態のpath/script lintは既存。base/head分類は公開資料で確認できない。 |
| v0.1 | AGC001: PR導入のpath drift、AGC002: PR導入のpackage-script drift。 |
| 明示的に延期 | runtime version、横断形式のscope/precedence矛盾、LLM品質評価、一般Markdown lint、自動書換え。 |
| 次の検証条件 | 公開標本で再現可能な真例、低い誤検知、外部maintainerのCI価値確認。 |

## 1. 直接競合マトリクス

本表の「未検証」は機能が存在しないという意味ではない。公開README、公式Action、公開ソースから、対象機能を**明示的に検証できなかった**ことを表す。重要なのは、競合の宣伝文句からPR差分機能を推測しないことである。スター・npm downloadsは取得日時点のスナップショットであり、利用者数ではない。

| Tool | Active? | License | Formats | Repo-grounded? | Base/head PR drift? | Path drift | Script drift | Version drift | Scope model | LLM required? | GitHub Action | Adoption evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [agnix](https://github.com/agent-sh/agnix) | **Yes**。1,173 commits、84 releases、最新v0.48.0を確認。 | MIT OR Apache-2.0 | `CLAUDE.md`、`AGENTS.md`、`SKILL.md`、Copilot、Cursor、Gemini、hooks、MCP等。447 rules。 | **Yes**。agent設定・schema・ファイル構造を検証。 | **未検証**。公開README/Actionでbase/head分類の記載なし。 | **未検証**。AGENTS.md対象rulesはあるが、PR起点のpath driftとしては文書化されない。 | **未検証**。 | **未検証**。 | **部分的にYes**。各tool固有のpath-scoped形式・precedence文書化の規則がある。 | **No**。Rust CLI/LSPでローカル実行。 | **Yes**。`agent-sh/agnix@v0`。 | GitHub: 381 stars/32 forks。npm直近30日: 28,742。[7] [16] |
| [AgentLint](https://github.com/samilozturk/agentlint) | **Yes**。205 commits、21 tagsを確認。 | MIT | `AGENTS.md`、`CLAUDE.md`、skills、managed rules、`.github/copilot-instructions.md`。 | **Yes**。workspace scanでstale references、missing types/files、構造変更後の保守必要性を扱うと説明。 | **未検証**。local change signalsには言及するが、base/head二状態評価・既存負債分類は確認できない。 | **主張あり、詳細未検証**。stale referencesを説明するが、削除/renameの判定契約は公開READMEで確認できない。 | **未検証**。 | **未検証**。 | **部分的にYes**。active IDEに応じた配置先へroutingする。 | **No hosted LLM**。MCPを使うがサーバーはread-only/local-first。 | **未検証**。公式READMEにAction利用法なし。 | GitHub: 30 stars/0 forks。npm直近30日: `@agent-lint/cli` 374。[8] [16] |
| [agents-lint](https://github.com/giacomo/agents-lint) | **Yes（小規模）**。20 commits、8 tags、v0.5.0。 | MIT | `AGENTS.md`、`CLAUDE.md`、AI memory files。 | **Yes**。filesystemと`package.json`を検査。 | **No evidence**。PR mode/基準revision/既存債務分類は確認できない。 | **Yes（現在状態）**。記載pathの実在性を検査。 | **Yes（現在状態）**。npm/pnpm/yarn/bun scriptの欠落を検査。 | **限定的**。`old-node-version`規則はソースで確認できるが、指示文と権威configの差分検査ではない。 | **未検証**。 | **No**。TypeScriptの決定的CLIとして確認、LLM依存の記載なし。 | **未検証**。 | GitHub: 13 stars/2 forks。npm直近30日: 3,526。[9] [16] |
| [agent-context-lint](https://github.com/mattschaller/agent-context-lint) | **Yes（初期）**。3 commits、2 tags、v0.1.1。 | MIT | `AGENTS.md`、`CLAUDE.md`、`.cursorrules`、Copilot instructions。 | **Yes**。disk上のpath、`package.json` script、code block import/commandを検査。 | **No evidence**。現行worktreeを検査する設計で、base/head比較の記載なし。 | **Yes（現在状態）**。`check:paths`。 | **Yes（現在状態）**。`check:scripts`。 | **未検証**。 | **未検証**。 | **No**。zero runtime dependenciesのTypeScript実装。 | **Yes**。`mattschaller/agent-context-lint@v0`。 | GitHub: 0 stars/0 forks。npm直近30日: 17。[10] [16] |

### 競合に関する所見

agnixは最も成熟した直接競合であり、447規則、IDE拡張、GitHub Action、autofix、明示的なrule request入口を持つ。[7] Agent Groundcheckが「AGENTS.mdをlintする」「各形式の構文を検査する」「LLMで品質点を付ける」といった方向へ広がれば、agnixと正面衝突し、機能量・保守対象・コミュニティの全てで不利になる。

一方、agents-lintとagent-context-lintは、Agent Groundcheckが候補にしているpath/scriptの**現在状態検査**をすでに提供する。[9] [10] そのため、AGC001/AGC002の価値は、path/scriptという検査対象自体ではなく、次の三つの契約を同時に満たすことにある。

> **PRで変更された事実だけを扱い、baseでは有効だった参照がheadで無効化された場合のみ既定で失敗させ、既存不良は別表示にする。**

この契約は導入時の「過去の文書債務を一括修正しないとCIを有効化できない」障壁を下げる。競合が将来同様の機能を追加する可能性はあるため、公開仕様・fixture・Action体験を先に明文化し、名前ではなく再現可能な振る舞いで差別化する必要がある。

`instrlint`については、指定名と近似名をGitHub・一般検索で探索したが、2026-08-15時点で評価可能なアクティブな公式リポジトリ又はpackageを確認できなかった。これは不存在の証明ではないため、競合表には載せていない。

## 2. 隣接競合と「単なる束ね直し」ではない理由

| 隣接ツール / 分野 | すでに解いている部分 | Agent Groundcheckで重複すべきでない部分 | 残る統合ギャップ |
| --- | --- | --- | --- |
| [Lychee](https://github.com/lycheeverse/lychee) | Markdown/HTML/text中のURL・メールアドレスの壊れをCLI、library、Actionで検査。 | HTTP link checkerを再実装しない。 | Markdown中の**repo-relative operational path**を、Gitのbase/headとinstruction semanticsに接続しない。[17] |
| [actionlint](https://github.com/rhysd/actionlint) | GitHub Actions YAMLの構文・式・action inputs・shell scripts等を静的に検査。 | workflow lintやShellCheck連携を複製しない。 | workflowで変わったscript/runner/configが、agent instructionの記述を新たに偽にしたかは判定しない。[18] |
| package manager / JSON parser | `package.json`のscript集合、workspace設定、enginesを機械可読に取得できる。 | commandを実行して「動くか」を証明しない。 | 指示内の明示コマンドを正しいmanifestへ解決し、**baseからheadで消えた**scriptだけをPR annotationにする統合がない。 |
| Git / GitHub Action | tree、blob、rename情報、PR annotationを提供する。 | hosted SaaSや外部repository送信を必須にしない。 | 指示claim、repo fact、二revisionのfinding fingerprintを一つのローカルCLIに結合する実装が必要。 |

従って、価値提案は「dead-link checker + script checker」では足りない。**指示という特殊な運用文書を、対象toolの公式意味論に従って発見し、PRによる新規の事実不一致として分類するワークフロー**が統合価値である。これは現在状態lintだけを束ねることとは異なる。

## 3. 問題が実在する証拠 — 具体例

以下は、公開PR、公開研究、及びその複製データから確認した事例である。「agent/developer failure」は、一次資料が明示しない場合に推測しない。特に、変更起因のpath/script driftの厳密な公開事例はまだ少なく、一般的な構成不全と分けて表示する。

| 証拠強度 | リポジトリ / 時点 | 指示の問題（正確な引用又は要約） | それと矛盾するrepo事実 | 期間 / 実害 | 既存ツールで捕捉できるか |
| --- | --- | --- | --- | --- | --- |
| **強：PRで確認** | [promptfoo/promptfoo #6538](https://github.com/promptfoo/promptfoo/pull/6538)、2025-12 | root `AGENTS.md`が`docs/*.md`を参照する構成。 | PRは`docs/agents/*.md`を新設し、rootの全参照を`docs/*.md`から更新。PRは「No broken references」を目標・test planに明記。 | 期間は不明。存在しない参照を防ぐため同一PRで修正。agent失敗は明示なし。 | 現在状態path lintはheadで捕捉可能。**baseで有効→headで無効**のため、提案するAGC001は新規ドリフトとして正確に捕捉。[11] |
| **強：PRで確認** | [CherryHQ/cherry-studio #12943](https://github.com/CherryHQ/cherry-studio/pull/12943)、2026-02 | `CLAUDE.md`に詳細なPR workflowがあり、毎sessionで読込。 | PRはworkflowを`gh-create-pr` skillへ移し、shared skillsのwhitelist/sync/checkとCI検証を導入。 | PR本文が不要token消費と標準化不足を明示。期間・失敗件数は不明。 | 一般的なcontext/skill lintなら候補。v0.1のpath/script driftには**対象外**。将来、skill file消失の確定的検査は候補。[12] |
| **強：研究で手動確認** | [google/adk-python](https://github.com/google/adk-python)、研究標本（2026-01 snapshot） | `AGENTS.md`の`Python Style Guide`にindent、line length、naming、docstrings、importsを記載。 | 研究後にmaintainerが同sectionを別skillへ移動したと論文が報告。 | 期間・agent失敗は不明。重複した常時指示を整理した実例。 | agnix/AgentLint等の品質規則に近い。v0.1では対象外。[6] |
| **強：研究で手動確認** | [inkline/inkline](https://github.com/inkline/inkline)、研究標本 | 「components should be placed in `packages/ui/components`」と「create a new folder in `packages/components`」が同居。 | 同じ構成内でcomponent作成先が二つに矛盾。 | 期間・実害は不明。agentは両方を同時に満たせない。 | LLM/semantic contradiction検出は可能だが、研究での人手確認後precisionは57%。v0.1には不適。[6] |
| **中：研究で手動確認** | [SuperClaude-Org/SuperClaude_Framework](https://github.com/SuperClaude-Org/SuperClaude_Framework)、研究標本 | `See docs/plugin-reorg.md for details.` | 参照の目的・適用条件が書かれず、agentはfileを読まないとplugin architectureを理解できない。 | 期間・実害は不明。Blind Referenceとして確認。 | pathの存在だけでは捕捉不能。意味理解を必要とするためv0.1では対象外。[6] |
| **中：研究で手動確認** | [quickemu-project/quickemu](https://github.com/quickemu-project/quickemu)、研究標本 | `Adding a new OS to quickget`の詳細手順が`AGENTS.md`に常駐。 | これは限られたtaskにしか必要でないのに全sessionで読込。 | 期間・実害は不明。context肥大の根拠。 | quality/skill linterは候補。v0.1では対象外。[6] |
| **中：研究で手動確認** | [javascript-obfuscator/javascript-obfuscator](https://github.com/javascript-obfuscator/javascript-obfuscator)、研究標本 | `CLAUDE.md`が1,477行、27 section。 | 論文は繰返し読込には大きすぎ、重要指示の取りこぼしを招くと評価。 | 期間・個別失敗は不明。 | token-budget/quality lintは候補。v0.1では対象外。[6] |
| **集計証拠** | 100件の公開標本、2026-01収集 | 42件context bloat、29件確認済skill leakage、58件確認済lint leakage、14件確認済blind reference、24件init fossilization、16件確認済conflicting instructions。 | 91/100のファイルに少なくとも一つのsmell。 | 研究の手法・標本制約あり。path/script削除の発生率を示すものではない。 | 問題領域の実在性を支持するが、v0.1の規則選定は別途corpusで検証する。[6] [13] |

この証拠は、**指示ファイルの保守問題自体は確実にあるが、path/script/versionの各ドリフトがどれほど頻繁で、CI blockerとして歓迎されるかはまだ未証明**であることを示す。したがって、製品の実装は小さく始め、公開corpusで率を測るべきである。

## 4. エコシステム規模とトレンド

| 形式 | 公式に確認できる採用・可用性 | 測定日 / 方法 | 解釈上の制約 |
| --- | --- | --- | --- |
| `AGENTS.md` | AGENTS.mdサイトは「over 60k open-source projects」と表示し、GitHubの`path:AGENTS.md NOT is:fork NOT is:archived`検索へのリンクを示す。 | 2026-08-15に公式サイトを確認。[1] | その検索式はfile hitとrepositoryを厳密に同一視するかが明記されず、nested filesもあり得る。**他形式の数と加算してunique repositoriesとしない。** |
| `CLAUDE.md` | Anthropicはmanaged/user/project/localの全範囲と、祖先・下位directoryの読込を公式化。 | 2026-08-15、公式documentation。[3] | 公開採用数を示す公式カウンタは確認できない。研究標本の61/100は人気repoを意図的に選んだ非ランダム標本であり、市場比率ではない。[6] |
| `.github/copilot-instructions.md` / `.github/instructions/*.instructions.md` | GitHubはrepository-wideとpath-specific instructionを公式対応。複数の関連instructionを併用し、PR reviewではhead branchのinstructionsを読む。 | 2026-08-15、GitHub Docs。[4] | 公式の公開repo数は確認できない。Copilot導入repo総数から推計してはならない。 |
| `GEMINI.md` | Gemini CLIはglobal/workspace/JITの階層、`@` import、カスタムfilename一覧を公式対応。 | 2026-08-15、Gemini CLI Docs。[5] | 公式の採用数は確認できない。設定で`AGENTS.md`も採用できるため、形式数は重複し得る。 |

実務的なアドレス可能性は、少なくとも「6万超」という`AGENTS.md`の公開シグナルと、主要agentが複数のinstruction sourceを正式サポートする事実から支持される。[1] [3] [4] [5] しかし、公開で再現可能な**形式横断のunique repository数**は見つからなかった。従って、現時点の市場見積りは「十分に大きい可能性がある」と留め、MVP検証では実測した対応形式・リポジトリ数・PR hit rateを別々に開示する。

## 5. 指示形式の意味論

> **設計原則:** 「Markdownだから同じ」と扱わない。ファイル発見、階層化、複数適用、import、path scope、symlinkの意味は形式ごとに異なるため、adapterを形式ごとに分離する。

| 形式 / 公式source | Canonical filename・scope | ネスト・優先順位・複数適用 | path-specific / import・symlink | 構文・更新上の公式指針 | v0.1に対する含意 |
| --- | --- | --- | --- | --- | --- |
| Codex `AGENTS.md` | globalは通常`~/.codex/AGENTS.md`（`AGENTS.override.md`優先）。projectではrootから作業directoryまで探索。 | 各directoryでoverride、`AGENTS.md`、fallbackの順に**最大一つ**を選択。上位から下位へ連結し、近いファイルが後に来る。 | fallback filenameを構成可能。公式ページでsymlink/importを対象仕様としては確認できない。 | empty fileをskipし、既定32KiBで読込停止。上限に達すればネストで分割するよう案内。 | `AGENTS.md` adapterは「directory当たり一つ」の選択と`override`を扱う。scope driftはv0.1では実装しない。[2] |
| Claude Code `CLAUDE.md` | managed、`~/.claude/CLAUDE.md`、`./CLAUDE.md`又は`./.claude/CLAUDE.md`、`CLAUDE.local.md`。 | 祖先directoryを上へ探索し、見つけた`CLAUDE.md`とlocalを**連結**。rootからworkdirに近い順で後者が後置。下位は対象fileを読む時にon-demand。 | `@path/to/import`（相対/絶対、再帰は最大4 hops）、`.claude/rules/**/*.md`、`paths` frontmatter、symlink rules、`claudeMdExcludes`を公式対応。 | under 200 linesを目標にし、具体的・簡潔に。古い又は矛盾する指示を定期reviewするよう案内。 | import targetを「単なるpath reference」と誤検出してはならない。import解決・rule globはpost-MVP。[3] |
| GitHub Copilot | repo-wide `.github/copilot-instructions.md`、path-specific `.github/instructions/NAME.instructions.md`、agent instructionsとして任意場所の`AGENTS.md`、rootの`CLAUDE.md`/`GEMINI.md`も対応。 | repository-wideとpath-specificは同時適用可能。personal > repository > organizationの順に優先し、すべて関連instructionsを提供。`AGENTS.md`はnearestが優先。 | `.instructions.md`冒頭にYAML frontmatter `applyTo`（glob）、複数pattern、`excludeAgent`。import/symlinkは当該公式ページでは確認できない。 | 自然言語Markdown。Copilot PR reviewは**head branch**のinstructions/skillsを読む。 | path-specificファイルのglob誤りは将来対象。v0.1は`copilot-instructions.md`中の確定path/scriptに限定し、scope整合性は後回し。[4] |
| Gemini CLI `GEMINI.md` | global `~/.gemini/GEMINI.md`、workspaceと親directory、JIT directory/ancestor。default名は設定で変更可能。 | 見つかったすべてを指定順に**連結**して毎promptへ送信。JITはtoolがdirectory/fileへアクセスした時にtrusted rootまで探索。 | `@file.md`で相対/絶対import。`settings.json`の`context.fileName`を文字列又は名前一覧にでき、`AGENTS.md`も選択可能。symlinkは当該pageで確認できない。 | 任意Markdown。`/memory show`と`/memory reload`で有効な階層contextを確認できる。 | 同じfileが`GEMINI.md`とcustom nameで存在し得る。discoveryは設定依存のため、v0.1のfirst-class supportは延期。[5] |

この表から、最初の対応対象は**root及び明示的に選んだinstruction fileの内容検査**に限定するのが安全である。全形式に対して「scope drift」を一つの規則として実装すると、Claudeの連結、Codexのdirectory当たり一つの選択、Copilotのglob適用、GeminiのJIT連結を混同し、誤検知の方が価値を上回る。

## 6. LLMなしの技術実現性と誤検知分析

| 要件 | LLMなしの実現性 | 推奨する決定的契約 | 主な誤検知・難所 | 判断 |
| --- | --- | --- | --- | --- |
| 高確信のrepo-relative path抽出 | **高** | Markdown ASTでinline code、Markdown linkのrelative destination、fenced code block内の明示的な`./`・`../`・拡張子/末尾`/`を候補化。URL、glob、shell option、placeholderを除外。 | prose中のslash、外部URL、docs例、glob、変数、Windows path、generated files、case sensitivity。 | **v0.1採用。** raw regexではなくAST+限定grammar+line provenanceを必須にする。 |
| baseで存在しheadで削除/renameされたpath | **高** | `git ls-tree`/`git cat-file`でB/Hの存在を判定。B=true/H=falseのみ新規候補。`git diff --name-status -M B...H`のrenameは説明補助で、判定根拠にしない。 | rename閾値、copy、case-only rename、submodule、symlink、sparse checkout。 | **v0.1採用。** rename hintがなければ「missing」とだけ報告する。 |
| npm/pnpm/yarn script抽出とworkspace解決 | **中〜高** | `npm run NAME`、`pnpm run NAME`、`yarn NAME`等の**明示script名**のみ抽出。指示fileから最も近いpackage rootを既定にし、`--workspace`等は限定対応。Bのscript存在/Hの不在で報告。 | `pnpm test`のbinary fallback、workspace protocol、catalog、package managerの省略形、root script、変更されたworking directory。 | **v0.1採用。ただし安全側。** 不明なmanifest解決はfindingを出さずinfo/skipにする。 |
| Node/Python版数と権威configの比較 | **中** | 明示的な`Node 22`/`Python 3.12`だけを抽出し、単一の高優先度設定と厳密比較。複数設定が矛盾すればinstructionを責めず「config ambiguity」。 | `.nvmrc`、`.node-version`、`package.json#engines`、Volta、mise、`.tool-versions`、Docker、CI、range表現の優先順位がrepoにより異なる。 | **延期。** 公式形式意味論ではなくruntime authorityのpolicyが必要で、真例corpusも不足。 |
| nested instruction scope | **形式別なら中、横断規則は低** | 形式adapterが発見・適用関係を返し、cross-formatでは比較しない。 | Codex/Claude/Copilot/Geminiの連結・override・JIT・glob・import・symlinkが異なる。 | **延期。** まずcontent claimの確定検査を成立させる。 |
| GitHub PR annotation | **高** | JavaScript Action又はCLIが`::error file=...,line=...::`等のworkflow commandとjob summaryを出力。network API/hosted serviceは不要。 | fork PR token権限、shallow fetch、base refの不在、annotation上限、Windows path。 | **v0.1後半で採用。** first CLI fixtureを先に固める。 |

技術的核心は自然言語理解ではなく、**claimを少なく抽出し、repository factを二revisionで復元し、finding fingerprintを差分化する**ことである。Markdownに含まれるあらゆるpath・commandを理解しようとすると誤検知が増える。反対に、baseで真、headで偽という強い条件を加えれば、現在状態lintより高い信頼度を得られる。

## 7. 推奨MVP — 二規則だけ

### AGC001 — PR導入のstale repository path

| 観点 | 内容 |
| --- | --- |
| User value | file移動・削除・再構成のPRで、次のagentが読もうとする指示上のpathだけを、当該Markdown行に紐づけて知らせる。既存の壊れた参照は既定でblockingしない。 |
| 実例 | promptfoo #6538はdocs再構成と`AGENTS.md`内pathの一括更新、参照先の存在確認を同一PRに含めた。[11] |
| 最も近い競合 | agents-lint/agent-context-lintは現在状態のmissing pathを検査する。[9] [10] |
| 差別化 | Bで存在しHで消えた時だけ報告し、rename hintを補助表示、baseline debtを分離する。 |
| 誤検知リスク | **低〜中。** URL/glob/example/変数を除外し、inline code・relative Markdown link・限定code blockだけを扱えば低減可能。 |
| 技術難度 | **中。** Git object view、AST、path normalization、fingerprint、fixtureが必要。 |
| なぜv0.1か | 変更起因の直接例があり、価値・実装可能性・説明可能性が最も揃う。 |

### AGC002 — PR導入のstale package script

| 観点 | 内容 |
| --- | --- |
| User value | `pnpm test:e2e`等の指示が、同PRで削除・改名されたscriptを参照し続ける事故を、正しいworkspace manifestに対して検出する。 |
| 実例 | 指示ファイルがbuild/test commandを含むことは主要形式の公式例で明白であり、agents-lintとagent-context-lintが現在状態の欠落scriptを独立規則にしている。[1] [9] [10] ただし、公開のPR起点script driftの強い個別事例は本調査で未確認。 |
| 最も近い競合 | agents-lintの`no-missing-script`、agent-context-lintの`check:scripts`。[9] [10] |
| 差別化 | baseにscriptが存在したという履歴的根拠、workspace解決、既存欠落の非blockingが差分。 |
| 誤検知リスク | **中。** package manager shorthand、binary fallback、monorepoの実行directoryにより上がる。明示`run NAME`を優先し、不確実な解決をskipする。 |
| 技術難度 | **中。** manifest境界・workspace option・base/head manifestの復元が必要。 |
| なぜv0.1か | 指示に頻出し、機械可読な権威sourceがあり、AGC001と同じbase/head engineを再利用できる。 |

**AGC003（runtime version drift）はv0.1に入れない。** repo内に複数のNode/Python version sourceが共存し、範囲と優先順位が未確定なままにすると、明確に誤っているinstructionより設定の曖昧さを誤判定する危険が高い。v0.1の実利用データから、どの権威sourceが実際に採用されているかを測ってから追加する。

## 8. 明示的に作らないもの

次の機能は魅力的に見えるが、v0.1で追加すると既存競合との重複又はノイズ増大を招く。

| 作らない機能 | 理由 |
| --- | --- |
| generic Markdown lint、文体・文法・token score | agnix、AgentLint、agent-context-lintの品質規則に近く、PRの新規事実ドリフトという契約を薄める。[7] [8] [10] |
| LLMによる矛盾・曖昧さ・「良い指示」判定 | 研究でも矛盾検出は手動確認後precision 57%であり、再現性・privacy・説明可能性を損なう。[6] |
| full scope/precedence lint | 各形式の意味論が異なる。誤ったuniversal modelは危険。 |
| 任意shell commandの実行・存在保証 | 安全性、platform差、CI非再現性のため。v0.1はpackage script名の存在だけを検証する。 |
| 自動書換え | rename hintは出せるが、instructionの意味・scope・意図を勝手に書換えない。最初は診断とremediationのみ。 |
| hosted SaaS、repo content送信、LLM必須化 | private repoでの導入障壁と信頼コストを増やす。local Git+filesystemのみで成立する。 |

## 9. 軽量なユーザー検証計画

検証の目的は星・downloadを作ることではなく、**この二つのPR指摘がmaintainerにとってCIに残す価値を持つか**を判定することである。

| 段階 | 方法 | 合格シグナル | 中止 / 再設計シグナル |
| --- | --- | --- | --- |
| 1. 再現可能corpus | `AGENTS.md`/`CLAUDE.md`を持つ、fork/archivedを除く公開repoを200件程度、言語・monorepo有無を層化して固定。各repoの直近一定期間のpath/script変更commitをbase/headとして回す。対象repo、commit SHA、除外理由を公開。 | AGC001/2が発見し、人手で「base有効、head無効、指示更新漏れ」と確認できる真例が複数出る。 | ほぼ全件が既存債務・例示・曖昧commandで、厳格抽出後に真例が出ない。 |
| 2. 精度計測 | 各findingを2人で盲検レビューし、根拠line、B/H存在、workspace解決、判定を保存。意見不一致を公開し、再計算可能にする。 | blocking候補で高いprecisionを維持し、誤検知理由が抑制又はgrammar改良で対処可能。 | 対象形式ごとにfalse positiveの構造要因が残り、suppressionsが主な利用形態になる。 |
| 3. 非spamのmaintainer確認 | 真例があるrepoに限り、既存のissue/PR慣行を尊重して短い再現内容を共有する。勝手にissueを大量作成しない。 | 「この種のPR checkなら有用」「CIで試す」の明示的反応、又は外部rule request。 | 指摘を不要・誤り・迷惑とみなす反応が主。 |
| 4. CLI spike | `agent-groundcheck pr-check --base B --head H --format json`だけを公開し、fixtures、privacy statement、suppression rationaleを整備。Actionはその後に追加。 | 自分以外のrepoで任意導入、外部issue/PR、releaseに対する再現報告。 | owner以外での利用がなく、同等機能が既存toolで十分だと確認される。 |

外部への連絡は、実在かつ再現可能な指摘がある場合だけに限定する。人工的なstar、download、spam outreach、架空の利用実績は行わない。

## 10. 名称・OSSポジショニング

`agent-groundcheck`、`agent-ground-check`、`agentgroundcheck`は、2026-08-15にnpm registryおよびPyPI JSON APIでいずれも未登録（HTTP 404）だった。一般検索では同名の主要開発者向け製品は見つからなかった。一方で、`GroundCheck.ai`は顧客/取引先確認サービス、`ground-check`はagentのprovenance/fact-checking層であり、短縮名「groundcheck」は意味の混同余地がある。

現時点では**名称変更を推奨しない**。`agent-groundcheck`は対象がagent instructionsであることを補足し、CLIとして説明的である。README冒頭で「PR-introduced instruction drift checker」「not a fact-checking service」と定義すれば混同をかなり減らせる。公開直前にnpm/GitHub/商標・会社名の再確認を行うべきであり、これは法的助言ではない。

ライセンスについては、直接競合の小規模TypeScript CLIにMITが多く、agnixはMIT OR Apache-2.0を採る。[7] [8] [9] [10] MITは短く、著作権・許諾表示を条件とする広い利用許諾である。[20] Apache-2.0は明示的な特許許諾、変更の明示、NOTICE保持、特許訴訟時の終了を含む。[19] 単独作者が早く採用されやすいCLIを目指すならMITで十分に慣行に沿う。企業寄与と特許条項の明示を重視するならApache-2.0又はdual licenseを検討できる。どちらもpermissiveであり、最終選択は権利者・所属方針に照らして行う。

外部maintainerに魅力的なOSSにするには、ライセンスだけでなく、以下を揃える必要がある。ruleごとの正確な契約、tiny Git fixture、false-positive/false-negative policy、安定したJSON、suppressionsに理由を要求する方式、compatibility matrix、公開changelog、security/privacy statement、rule request templateを初回公開から含める。agnixが`explain`、autofix、rule request、contribution guideを公開していることは、保守可能なlint toolの実務的な参考になる。[7]

## 11. Codex for Open Sourceへの関連性

OpenAIの現行公式ページは、活動中のOSSのprimary/core maintainerを対象とし、meaningful usage、broad adoption、又はecosystem importanceを見ている。申請ではrepository usage、active maintenance（PR review、issue triage、release management等）、maintainer roleが考慮される。明示されたスター数・download数の閾値はない。[21] [22]

Agent Groundcheckが正当に積み上げられる証拠は、以下である。

| 証拠 | 初期に積み上げる具体策 |
| --- | --- |
| 意味ある外部利用 | owner外repositoryでの任意導入、Action又はCLIの明示的な利用例。 |
| package adoption | versioned release、正確なinstall手順、npm downloadsの時系列を補助指標として公開。 |
| active maintenance | issue triage、reproducible bug fix、release notes、dependency/security maintenance。 |
| 外部共同作業 | external issue、rule request、PR、compatibility reportを歓迎し、応答履歴を残す。 |
| ecosystem importance | agent instruction formatsの公式意味論と実務的なPR safetyをつなぐ、再現可能なcorpus/fixturesを公開。 |

これらはプロダクトの独立した価値を高める行為であり、プログラム向けの数字作りではない。申請はrolling reviewであり、選定・benefitはOpenAIの裁量で、応募が採択を保証しない。[21] [23]

## 12. 最終推奨

**PIVOTして実装を進める。ただし、二規則のcorpus検証をゲートにする。**

現在の製品ブリーフの「PR-time、deterministic、local、API-free」という核は維持すべきである。一方で、「AGENTS.md/CLAUDE.md linter」という表現と、AGC003/AGC004を早期に入れる前提は削る。最初のrelease candidateは、rootの`AGENTS.md`と`CLAUDE.md`の高確信path/script claimに限定し、B/H二revisionを評価してnew/fixed/existingを分類するCLIとfixtureを提供する。

Go条件は、公開corpusで真のPR起点driftが複数見つかり、blocking対象の人手確認precisionが高く、少なくとも一人の外部maintainerが「CIに残す価値がある」と判断することである。これらが得られない場合は、agnix等の静的lint競合と重なる拡張をせず、**STOP**又は別の決定的なrepo factへの再PIVOTを選ぶべきである。

---

## 参考文献・一次ソース

すべてのリンクのアクセス日は **2026-08-15** である。npm download APIは2026-07-11〜2026-08-09の直近30日ウィンドウを取得した。

[1]: https://agents.md/ "AGENTS.md — open instruction format"
[2]: https://learn.chatgpt.com/docs/agent-configuration/agents-md "OpenAI: Custom instructions with AGENTS.md"
[3]: https://code.claude.com/docs/en/memory "Anthropic: How Claude remembers your project"
[4]: https://docs.github.com/en/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot "GitHub Docs: Adding repository custom instructions for GitHub Copilot"
[5]: https://geminicli.com/docs/cli/gemini-md/ "Gemini CLI: Provide context with GEMINI.md files"
[6]: https://arxiv.org/html/2606.15828v3 "Santos et al. (2026), Configuration Smells in AGENTS.md Files"
[7]: https://github.com/agent-sh/agnix "agent-sh/agnix — official repository and README"
[8]: https://github.com/samilozturk/agentlint "samilozturk/agentlint — official repository and README"
[9]: https://github.com/giacomo/agents-lint "giacomo/agents-lint — official repository and README"
[10]: https://github.com/mattschaller/agent-context-lint "mattschaller/agent-context-lint — official repository and README"
[11]: https://github.com/promptfoo/promptfoo/pull/6538 "promptfoo/promptfoo PR #6538"
[12]: https://github.com/CherryHQ/cherry-studio/pull/12943 "CherryHQ/cherry-studio PR #12943"
[13]: https://doi.org/10.5281/zenodo.20600327 "Replication package: Configuration Smells in AGENTS.md Files"
[14]: https://github.com/lycheeverse/lychee "lycheeverse/lychee — official repository"
[15]: https://github.com/rhysd/actionlint "rhysd/actionlint — official repository"
[16]: https://api.npmjs.org/downloads/point/last-month/agnix "npm downloads API — agnix (the same endpoint was queried for each package)"
[17]: https://github.com/lycheeverse/lychee "lycheeverse/lychee — CLI, library, and GitHub Action"
[18]: https://github.com/rhysd/actionlint "rhysd/actionlint — static checker for GitHub Actions workflows"
[19]: https://www.apache.org/licenses/LICENSE-2.0 "Apache License, Version 2.0"
[20]: https://opensource.org/license/mit "Open Source Initiative: MIT License"
[21]: https://developers.openai.com/community/codex-for-oss "OpenAI: Codex for Open Source"
[22]: https://openai.com/form/codex-for-oss/ "OpenAI: Codex for Open Source application form and criteria"
[23]: https://developers.openai.com/codex/codex-for-oss-terms "OpenAI: Codex for Open Source Program Terms"

> **調査上の制約:** 競合の機能は、公開時点のREADME、Action、公開ソースで検証した。非公開SaaS機能、未文書機能、将来のreleaseは評価していない。特に「base/head PR driftが未検証」は不存在を意味しない。市場規模は形式横断の重複を解消できないため、合計値を提示していない。
