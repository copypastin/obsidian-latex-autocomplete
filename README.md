# obsidian-latex-autocomplete | a command picker for your math notes

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white) ![Obsidian](https://img.shields.io/badge/Obsidian-7C3AED?style=for-the-badge&logo=obsidian&logoColor=white) [![MIT License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)](LICENSE)

> for when you remember what the equation looks like, but not what the command is called

<img width="800" alt="LaTeX autocomplete in Obsidian, with a matrix suggestion and rendered preview" src="assets/preview.gif" />

## concept

the idea is to make writing math in Obsidian a little less dependent on remembering LaTeX syntax. type `\` inside a math block, search by the command or what it does, and preview the result before inserting it.

fractions, matrices, and other templates have editable inputs. fill one in, press Tab, and move on to the next. a 3×3 matrix has nine inputs, in row order.

recommended to be used on top of [LaTeX Suite](https://github.com/artisticat1/obsidian-latex-suite) bc i havent tested it without lol.

## what works today?

- **410 command entries across 16 categories**, including calculus, linear algebra, Greek letters, logic, and equation environments.
- **fuzzy search** across names and descriptions. `\fr` and `\fraction` both find `\frac`.
- **rendered previews** alongside the suggestions, with an example and a short description.
- **Tab navigation** through template inputs, Shift+Tab to go back, and linked editing for repeated inputs.
- **math detection** for inline `$...$`, display `$$...$$`, and fenced `math` or `latex` blocks. suggestions work inside open and closed math delimiters.
- **LaTeX Suite compatibility**, including its snippet edits and keyboard handling.
- **local usage ranking** so commands you use more often move up the list.

## installation

1. download `main.js`, `manifest.json`, and `styles.css` from a release, or build them from source below.
2. create `.obsidian/plugins/latex-autocomplete/` inside your vault and put the three files there.
3. enable **LaTeX Autocomplete** in **Settings → Community plugins**.

when updating, replace the files and turn the plugin off and back on.

## how to use it

inside a math expression, type `\` followed by whatever you remember about the command. choose a suggestion with the arrow keys and press Tab or Enter.

for `\frac`, fill in the numerator, press Tab, and fill in the denominator. for a matrix, keep pressing Tab to work through the cells. after the last input, Tab moves past the inserted command.

| key                       | action                                                                          |
| ------------------------- | ------------------------------------------------------------------------------- |
| `\`                       | open suggestions inside math                                                    |
| Ctrl+Space                | request suggestions after a backslash, even below the minimum-character setting |
| Up / Down                 | select a suggestion                                                             |
| Page Up / Page Down       | move through the suggestion list                                                |
| Tab / Enter               | insert the selected suggestion                                                  |
| Tab, with the menu closed | move to the next input, or leave the completed template                         |
| Shift+Tab                 | return to the previous input and select its value for replacement               |
| Esc                       | close suggestions; when the menu is closed, end template navigation             |

once you finish a template, normal editor and LaTeX Suite Tab handling resumes.

### settings

under **Settings → LaTeX Autocomplete**:

| setting                      | default | options  |
| ---------------------------- | ------- | -------- |
| enable autocomplete          | on      | on / off |
| minimum characters after `\` | `0`     | `0`–`3`  |
| maximum suggestions          | `20`    | `5`–`50` |

to clear the usage ranking, run **LaTeX Autocomplete: Reset autocomplete usage data** from the command palette.

## implementations / tech

- **TypeScript + CodeMirror 6** for completion queries, keyboard handling, and template inputs.
- **Obsidian's math renderer** for the preview card.
- **a bundled command library** with fuzzy matching and locally stored frequency / recency scores.

## development

requires **Node.js 24** and npm. `.nvmrc` records the Node version.

from the repo root:

```sh
npm ci
npm run check
```

for editing:

```sh
npm run dev           # rebuild main.js when source changes
npm run format        # format the project
npm run format:check  # check formatting
npm run typecheck     # check types against the Obsidian API
npm test              # run the tests
npm run build         # typecheck and create the production main.js
```

`main.js` is generated and excluded from Git. `styles.css` in the repo root is the stylesheet source and goes directly into the installed plugin.

### layout

```text
src/                      plugin, completion logic, math detection, and command library
tests/                    automated tests and Obsidian mocks
assets/                   README images
styles.css                plugin styles
manifest.json             Obsidian plugin metadata
TEST_SAMPLE.md            manual test note
esbuild.config.mjs        development and production builds
.github/workflows/ci.yml   formatting, tests, build, and installable artifact
```

### testing / releases

`npm run check` runs formatting checks, the tests, and a production build. the tests cover math detection, search, usage data, automatic suggestions inside closed math, and template navigation across the command library.

tests use `tsconfig.test.json` for the Obsidian mock; production type checking uses the real API declarations through `tsconfig.json`.

[TEST_SAMPLE.md](TEST_SAMPLE.md) has the manual checks for Live Preview, Source mode, and LaTeX Suite.

GitHub Actions runs the same checks on pushes and pull requests, then uploads `main.js`, `manifest.json`, and `styles.css` as the `latex-autocomplete` artifact. for a release, keep the versions in `package.json`, `package-lock.json`, and `manifest.json` consistent, complete the automated and manual checks, and attach those three files to the release.

## license

[MIT](LICENSE) © 2026 Aaron Nguyen.
